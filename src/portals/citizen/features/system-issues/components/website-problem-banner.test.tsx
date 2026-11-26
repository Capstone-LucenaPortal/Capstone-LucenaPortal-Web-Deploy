import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WebsiteProblemBanner } from '@/portals/citizen/features/system-issues/components/website-problem-banner';

const submitSystemIssue = vi.fn();
const attachSystemIssueScreenshot = vi.fn();

// The data module is the boundary a submit crosses; its own tests cover the
// mock store, the argument mapping and the error copy.
vi.mock('@/portals/citizen/features/system-issues/lib/system-issues', () => {
  class SystemIssueSubmitError extends Error {}
  class SystemIssueScreenshotError extends Error {}
  return {
    submitSystemIssue: (...args: unknown[]) => submitSystemIssue(...args),
    attachSystemIssueScreenshot: (...args: unknown[]) => attachSystemIssueScreenshot(...args),
    SystemIssueSubmitError,
    SystemIssueScreenshotError,
  };
});

vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'citizen-1', email: 'juan@example.com', name: 'Juan' } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function openDialog() {
  render(<WebsiteProblemBanner />);
  await userEvent.click(screen.getByRole('button', { name: 'Report a website problem' }));
  return screen.getByRole('dialog', { name: /report a problem with this website/i });
}

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const png = (name: string) => new File([new Uint8Array(PNG_BYTES)], name, { type: 'image/png' });
const screenshotInput = (dialog: HTMLElement) => within(dialog).getByLabelText(/add a screenshot/i);
/** A change event, not userEvent.upload, which drops a file the input's `accept` does not list. */
const choose = (dialog: HTMLElement, file: File) => fireEvent.change(screenshotInput(dialog), { target: { files: [file] } });

async function fillIn(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole('radio', { name: 'Yellow Card' }));
  await userEvent.type(within(dialog).getByLabelText(/what went wrong/i), 'Submit does nothing.');
}

describe('WebsiteProblemBanner', () => {
  it('asks whether the problem is with the website, and opens the form in a dialog', async () => {
    render(<WebsiteProblemBanner />);
    expect(screen.getByRole('button', { name: 'Report a website problem' }).parentElement).toHaveTextContent(
      "Is the problem with this website, not the city? Something won't load or won't submit?",
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Report a website problem' }));

    expect(screen.getByRole('dialog', { name: /report a problem with this website/i })).toBeInTheDocument();
  });

  it('offers the five parts of the website', async () => {
    const dialog = await openDialog();
    const parts = within(dialog).getAllByRole('radio').map((r) => r.closest('label')!.textContent);
    expect(parts).toEqual(['Yellow Card', 'Incidents', 'LCC Bookings', 'Accounts & sign-in', 'The website in general']);
  });

  it('tells the Citizen what is sent without asking, and who they report as', async () => {
    const dialog = await openDialog();
    expect(within(dialog).getByText(/the page you came from/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/your browser and device/i)).toBeInTheDocument();
    expect(within(dialog).getByText('juan@example.com')).toBeInTheDocument();
    expect(within(dialog).getByText(/let you know when it.s fixed/i)).toBeInTheDocument();
  });

  it('enables Send report only once both a part and a description are given', async () => {
    const dialog = await openDialog();
    const send = within(dialog).getByRole('button', { name: 'Send report' });
    expect(send).toBeDisabled();

    await userEvent.click(within(dialog).getByRole('radio', { name: 'Yellow Card' }));
    expect(send).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/what went wrong/i), '   ');
    expect(send).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/what went wrong/i), 'Submit does nothing.');
    expect(send).toBeEnabled();
  });

  it('sends the report with the captured page and browser, then thanks them with the reference', async () => {
    submitSystemIssue.mockResolvedValue({ referenceNumber: 'SI-2026-000007', mode: 'live' });
    const dialog = await openDialog();
    await fillIn(dialog);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));

    expect(submitSystemIssue).toHaveBeenCalledWith({
      category: 'yellow_card',
      description: 'Submit does nothing.',
      page: expect.stringMatching(/^\//),
      userAgent: navigator.userAgent,
    });
    expect(await within(dialog).findByText('SI-2026-000007')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Send report' })).not.toBeInTheDocument();
  });

  it('starts an empty form again on Report something else', async () => {
    submitSystemIssue.mockResolvedValue({ referenceNumber: 'SI-2026-000007', mode: 'live' });
    const dialog = await openDialog();
    await fillIn(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));

    await userEvent.click(await within(dialog).findByRole('button', { name: 'Report something else' }));

    expect(within(dialog).getByLabelText(/what went wrong/i)).toHaveValue('');
    expect(within(dialog).getByRole('radio', { name: 'Yellow Card' })).not.toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'Send report' })).toBeDisabled();
  });

  it("shows the data module's own copy when the report is refused, and keeps what was typed", async () => {
    const { SystemIssueSubmitError } = await import('@/portals/citizen/features/system-issues/lib/system-issues');
    const helpdesk =
      "You've sent 5 reports in the last 24 hours. If something is still wrong, please email helpdesk@lucena-city.gov.ph.";
    submitSystemIssue.mockRejectedValue(new SystemIssueSubmitError(helpdesk));
    const dialog = await openDialog();
    await fillIn(dialog);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(helpdesk);
    expect(within(dialog).getByLabelText(/what went wrong/i)).toHaveValue('Submit does nothing.');
  });

  it('shows a plain message for an unexpected failure, never its text', async () => {
    submitSystemIssue.mockRejectedValue(new Error('TypeError: Failed to fetch'));
    const dialog = await openDialog();
    await fillIn(dialog);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('We could not send your report right now. Please try again later.');
    expect(alert).not.toHaveTextContent(/failed to fetch/i);
  });

  it('closes on the close button', async () => {
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('the optional screenshot', () => {
    beforeEach(() => {
      submitSystemIssue.mockResolvedValue({ issueId: 'si-1', referenceNumber: 'SI-2026-000007', mode: 'live' });
      attachSystemIssueScreenshot.mockResolvedValue(undefined);
    });

    it('attaches the chosen image to the report once it is filed', async () => {
      const dialog = await openDialog();
      await fillIn(dialog);
      const shot = png('broken-button.png');
      choose(dialog, shot);
      expect(await within(dialog).findByText('broken-button.png')).toBeInTheDocument();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));

      expect(await within(dialog).findByText('SI-2026-000007')).toBeInTheDocument();
      expect(attachSystemIssueScreenshot).toHaveBeenCalledWith('si-1', shot);
      expect(within(dialog).queryByText(/screenshot didn.t attach/i)).not.toBeInTheDocument();
    });

    it('sends no screenshot when none is chosen, or the chosen one is removed', async () => {
      const dialog = await openDialog();
      await fillIn(dialog);
      choose(dialog, png('broken-button.png'));
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Remove screenshot' }));
      expect(within(dialog).queryByText('broken-button.png')).not.toBeInTheDocument();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));

      expect(await within(dialog).findByText('SI-2026-000007')).toBeInTheDocument();
      expect(attachSystemIssueScreenshot).not.toHaveBeenCalled();
    });

    it('refuses a non-image with the incident photo message, and keeps nothing', async () => {
      const dialog = await openDialog();
      choose(dialog, new File(['%PDF-1.7'], 'notes.pdf', { type: 'application/pdf' }));

      expect(await within(dialog).findByText('Please upload a JPG or PNG image.')).toBeInTheDocument();
      expect(within(dialog).queryByText('notes.pdf')).not.toBeInTheDocument();
    });

    it('refuses a file over 5 MB with the incident photo message', async () => {
      const dialog = await openDialog();
      const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
      choose(dialog, big);

      expect(await within(dialog).findByText('File size must be 5 MB or less.')).toBeInTheDocument();
      expect(within(dialog).queryByText('huge.png')).not.toBeInTheDocument();
    });

    it('still gives the reference when the screenshot fails to attach, and says it did not', async () => {
      const { SystemIssueScreenshotError } = await import('@/portals/citizen/features/system-issues/lib/system-issues');
      attachSystemIssueScreenshot.mockRejectedValue(new SystemIssueScreenshotError("Your screenshot didn't attach."));
      const dialog = await openDialog();
      await fillIn(dialog);
      choose(dialog, png('broken-button.png'));
      await within(dialog).findByText('broken-button.png');

      await userEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));

      expect(await within(dialog).findByText('SI-2026-000007')).toBeInTheDocument();
      expect(within(dialog).getByText(/screenshot didn.t attach/i)).toBeInTheDocument();
    });

    it('says the screenshot did not attach after an unexpected upload failure too', async () => {
      attachSystemIssueScreenshot.mockRejectedValue(new Error('TypeError: Failed to fetch'));
      const dialog = await openDialog();
      await fillIn(dialog);
      choose(dialog, png('broken-button.png'));
      await within(dialog).findByText('broken-button.png');

      await userEvent.click(within(dialog).getByRole('button', { name: 'Send report' }));

      expect(await within(dialog).findByText('SI-2026-000007')).toBeInTheDocument();
      expect(within(dialog).getByText(/screenshot didn.t attach/i)).toBeInTheDocument();
      expect(within(dialog).queryByText(/failed to fetch/i)).not.toBeInTheDocument();
    });
  });
});
