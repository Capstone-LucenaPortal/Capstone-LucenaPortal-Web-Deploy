import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalShell, { ModalCloseButton } from '@/portals/citizen/components/ui/modal-shell';

function Harness({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell labelledBy="heading" onClose={onClose}>
      <ModalCloseButton onClose={onClose} />
      <h2 id="heading">Sign In</h2>
      <input aria-label="Email" />
      <input aria-label="Password" />
      <button type="button">Submit</button>
    </ModalShell>
  );
}

describe('ModalShell', () => {
  it('is a labelled modal dialog', () => {
    render(<Harness onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // The name comes from the heading, so a screen reader announces "Sign In
    // dialog" rather than dropping the user into an unnamed region.
    expect(dialog).toHaveAccessibleName('Sign In');
  });

  it('moves focus to the first control on open, not the panel', async () => {
    render(<Harness onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close dialog/i })).toHaveFocus();
    });
  });

  it('offers a visible, labelled close button', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The trap is the whole point: without it a keyboard user tabs straight out
  // of the dialog into the page behind, with nothing to signal they have left.
  it('wraps focus from the last control back to the first', async () => {
    render(<Harness onClose={vi.fn()} />);
    const close = screen.getByRole('button', { name: /close dialog/i });
    const submit = screen.getByRole('button', { name: 'Submit' });

    submit.focus();
    await userEvent.tab();
    expect(close).toHaveFocus();
  });

  it('wraps focus backwards from the first control to the last', async () => {
    render(<Harness onClose={vi.fn()} />);
    const close = screen.getByRole('button', { name: /close dialog/i });
    const submit = screen.getByRole('button', { name: 'Submit' });

    close.focus();
    await userEvent.tab({ shift: true });
    expect(submit).toHaveFocus();
  });

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(<Harness onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('returns focus to whatever opened it', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Open';
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<Harness onClose={vi.fn()} />);
    unmount();

    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });
});
