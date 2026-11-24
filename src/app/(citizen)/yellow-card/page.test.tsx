import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YellowCardPage from '@/app/(citizen)/yellow-card/page';
import { yellowCardService, YellowCardSubmitError } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import type { MyYellowCard, MyYellowCardApplication } from '@/portals/citizen/features/yellow-card/types';
import { catalogService } from '@/portals/citizen/lib/supabase/catalogs';

const push = vi.fn();
let searchParams = new URLSearchParams();

// The provider itself talks to authService and Supabase on mount; the subject
// under test is what the page renders once a citizen is signed in.
vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'citizen-1' },
    loading: false,
    isPasswordRecovery: false,
    openAuthModal: vi.fn(),
  }),
}));

// No App Router is mounted under test; see the Citizen CLAUDE.md Testing section.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/yellow-card',
  useSearchParams: () => searchParams,
}));

// jsdom has no scrollIntoView; the page scrolls a validation message into view.
Element.prototype.scrollIntoView = vi.fn();

const LOAD_ERROR = 'Could not load your Yellow Card information right now. Please try again later.';

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('YellowCardPage when the applications check fails', () => {
  // The regression this pins: a failed read used to become `[]`, so a citizen
  // with a live application got the form and was refused only after filling it
  // in and uploading their document.
  it('shows the error with a way to retry and a way back, and never the form', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications').mockRejectedValue(new Error(LOAD_ERROR));

    render(<YellowCardPage />);

    expect(await screen.findByText(LOAD_ERROR)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Application' })).not.toBeInTheDocument();
  });

  // The gate must hold whatever was thrown: an error with no text to show is
  // still a failed check, not a citizen with no applications.
  it.each([
    ['an error with no message', new Error('')],
    ['something that is not an error', 'offline'],
  ])('falls back to the load error and keeps the form closed for %s', async (_label, thrown) => {
    vi.spyOn(yellowCardService, 'getMyApplications').mockRejectedValue(thrown);

    render(<YellowCardPage />);

    expect(await screen.findByText(LOAD_ERROR)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Application' })).not.toBeInTheDocument();
  });

  it('shows the checking state on "Try again", then the form when the citizen has no application', async () => {
    const getMyApplications = vi
      .spyOn(yellowCardService, 'getMyApplications')
      .mockRejectedValueOnce(new Error(LOAD_ERROR));
    let finishRead: (applications: MyYellowCardApplication[]) => void = () => {};
    getMyApplications.mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));

    render(<YellowCardPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Checking your application status…')).toBeInTheDocument();
    expect(screen.queryByText(LOAD_ERROR)).not.toBeInTheDocument();

    finishRead([]);

    expect(await screen.findByRole('button', { name: 'Submit Application' })).toBeInTheDocument();
    expect(screen.queryByText(LOAD_ERROR)).not.toBeInTheDocument();
  });

  it('shows the live-application notice on "Try again" when the citizen has one', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications')
      .mockRejectedValueOnce(new Error(LOAD_ERROR))
      .mockResolvedValueOnce([
        { id: 'app-1', reference_number: 'YC-2026-000091', status: 'pending' } as MyYellowCardApplication,
      ]);

    render(<YellowCardPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(/YC-2026-000091/)).toBeInTheDocument();
    expect(screen.queryByText(LOAD_ERROR)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Application' })).not.toBeInTheDocument();
  });

  it('stays on the error state when the retry fails too', async () => {
    const getMyApplications = vi
      .spyOn(yellowCardService, 'getMyApplications')
      .mockRejectedValue(new Error(LOAD_ERROR));

    render(<YellowCardPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(getMyApplications).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(LOAD_ERROR)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Application' })).not.toBeInTheDocument();
  });

  // A failed catalog read during the same outage would otherwise leave the form
  // with empty dropdowns once the retry gets through.
  it('reloads the form catalogs on "Try again"', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications')
      .mockRejectedValueOnce(new Error(LOAD_ERROR))
      .mockResolvedValueOnce([]);
    vi.spyOn(catalogService, 'getBarangays')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{ code: 'BRGY-1', label: 'Barangay Uno' }]);

    render(<YellowCardPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('option', { name: 'Barangay Uno' })).toBeInTheDocument();
  });

  it('goes to the Dashboard from the error state', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications').mockRejectedValue(new Error(LOAD_ERROR));

    render(<YellowCardPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Go to Dashboard' }));

    expect(push).toHaveBeenCalledWith('/dashboard');
  });
});

describe('YellowCardPage when the applications check succeeds', () => {
  it('shows the form for an empty read', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications').mockResolvedValue([]);

    render(<YellowCardPage />);

    expect(await screen.findByRole('button', { name: 'Submit Application' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  // No spies: with no Supabase env the real service returns [] without error.
  it('shows the form in mock mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');

    render(<YellowCardPage />);

    expect(await screen.findByRole('button', { name: 'Submit Application' })).toBeInTheDocument();
  });
});

/**
 * Ticket #171 (ADR 0011): a Citizen holding an active card corrects its details
 * through a Correction, a new application prefilled from the approved one.
 */
const APPROVED: MyYellowCardApplication = {
  id: 'app-approved',
  reference_number: 'YC-2026-000050',
  status: 'approved',
  needs_dedup_review: false,
  first_name: 'Kin',
  middle_name: null,
  last_name: 'Tester',
  suffix: null,
  date_of_birth: '1990-01-15',
  gender_code: 'male',
  civil_status_code: 'single',
  barangay_code: 'bocohan',
  barangay_name: 'Bocohan',
  complete_address: '123 Rizal Street',
  contact_number: '09171234567',
  email_address: 'kin@example.com',
  years_of_residency: 5,
  voter_id_number: '123-456-789',
  privacy_consent: true,
  submitted_at: '2026-08-07T01:00:00Z',
  sla_target_hours: 72,
  due_at: null,
  decided_at: '2026-08-08T01:00:00Z',
  current_decision: 'approved',
  current_reason: null,
  current_reviewed_at: '2026-08-08T01:00:00Z',
  document_count: 1,
  is_correction: false,
  replaces_card_id: null,
  replaced_card_number: null,
  correction_note: null,
  holds_printed_card: true,
  printed_card_number: '0457',
};

const ACTIVE_CARD: MyYellowCard = {
  id: 'card-1',
  card_number: 'LC-2026-000004',
  verification_token: 'tok-1',
  status: 'active',
  application_id: 'app-approved',
  holder_name: 'TESTER, KIN',
  barangay_name: 'Bocohan',
  valid_from: '2026-08-08',
  expires_at: null,
  revoked_reason: null,
};

function stubCatalogs() {
  vi.spyOn(catalogService, 'getGenders').mockResolvedValue([{ code: 'male', label: 'Male' }]);
  vi.spyOn(catalogService, 'getCivilStatuses').mockResolvedValue([{ code: 'single', label: 'Single' }]);
  vi.spyOn(catalogService, 'getBarangays').mockResolvedValue([{ code: 'bocohan', label: 'Bocohan' }]);
  vi.spyOn(catalogService, 'getYellowCardConfig').mockResolvedValue(null);
  vi.spyOn(catalogService, 'getYellowCardDocumentTypes').mockResolvedValue([]);
}

function holdsActiveCard(applications: MyYellowCardApplication[] = [APPROVED]) {
  stubCatalogs();
  vi.spyOn(yellowCardService, 'getMyApplications').mockResolvedValue(applications);
  vi.spyOn(yellowCardService, 'getMyCards').mockResolvedValue([ACTIVE_CARD]);
}

async function uploadVoterId(container: HTMLElement) {
  const input = container.querySelector('#idFileInput') as HTMLInputElement;
  // validateUploadFile reads the magic bytes, so this has to start like a PDF.
  await userEvent.upload(input, new File(['%PDF-1.4'], 'voter-id.pdf', { type: 'application/pdf' }));
  await screen.findByText('✓ voter-id.pdf');
}

const NOTE = /What needs correcting\?/;

describe('YellowCardPage in Correction mode', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams('mode=correction');
  });

  it('opens the form prefilled from the approved application, with the earlier printed-card answer', async () => {
    holdsActiveCard();

    render(<YellowCardPage />);

    expect(await screen.findByRole('heading', { name: 'Correct Your Card Details' })).toBeInTheDocument();
    expect(screen.getByText(/LC-2026-000004 stays valid until this Correction is decided/)).toBeInTheDocument();
    expect(screen.getByLabelText(/First Name/)).toHaveValue('Kin');
    expect(screen.getByLabelText(/Last Name/)).toHaveValue('Tester');
    expect(screen.getByLabelText(/Complete Address/)).toHaveValue('123 Rizal Street');
    expect(screen.getByLabelText(/Voter's ID Number/)).toHaveValue('123-456-789');
    expect(screen.getByRole('checkbox', { name: 'I already hold a printed Yellow Card' })).toBeChecked();
    expect(screen.getByLabelText(/Printed card number/)).toHaveValue('0457');
    expect(screen.getByRole('textbox', { name: NOTE })).toHaveValue('');
  });

  it('will not submit without a note', async () => {
    holdsActiveCard();
    const submit = vi.spyOn(yellowCardService, 'submitApplication');
    const { container } = render(<YellowCardPage />);
    await screen.findByRole('heading', { name: 'Correct Your Card Details' });

    await uploadVoterId(container);
    await userEvent.click(screen.getByRole('checkbox', { name: /Data Privacy Consent/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit Correction' }));

    expect(screen.getByRole('alert')).toHaveTextContent('A Correction must say what needs correcting.');
    expect(submit).not.toHaveBeenCalled();
  });

  // The catalog here marks no document required, and a Correction still asks for one.
  it("will not submit without a Voter's ID upload", async () => {
    holdsActiveCard();
    const submit = vi.spyOn(yellowCardService, 'submitApplication');
    render(<YellowCardPage />);
    await screen.findByRole('heading', { name: 'Correct Your Card Details' });

    await userEvent.type(screen.getByRole('textbox', { name: NOTE }), 'My last name is misspelled.');
    await userEvent.click(screen.getByRole('checkbox', { name: /Data Privacy Consent/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit Correction' }));

    expect(screen.getByRole('alert')).toHaveTextContent("Please upload your Voter's ID.");
    expect(submit).not.toHaveBeenCalled();
  });

  it('files a Correction and says the card stays valid until a decision', async () => {
    holdsActiveCard();
    const submit = vi
      .spyOn(yellowCardService, 'submitApplication')
      .mockResolvedValue({ id: 'app-2', reference_number: 'YC-2026-000091' });
    const upload = vi.spyOn(yellowCardService, 'uploadVoterIdDocument').mockResolvedValue();
    const { container } = render(<YellowCardPage />);
    await screen.findByRole('heading', { name: 'Correct Your Card Details' });

    await userEvent.clear(screen.getByLabelText(/Last Name/));
    await userEvent.type(screen.getByLabelText(/Last Name/), 'Testers');
    await userEvent.type(screen.getByRole('textbox', { name: NOTE }), 'My last name is misspelled.');
    await uploadVoterId(container);
    await userEvent.click(screen.getByRole('checkbox', { name: /Data Privacy Consent/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit Correction' }));

    expect(await screen.findByRole('heading', { name: 'Card Correction Submitted' })).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        lastName: 'Testers',
        firstName: 'Kin',
        isCorrection: true,
        correctionNote: 'My last name is misspelled.',
        holdsPrintedCard: true,
        printedCardNumber: '0457',
      }),
    );
    expect(upload).toHaveBeenCalledWith('app-2', expect.any(File), expect.any(Object));
    expect(screen.getByText(/LC-2026-000004 stays valid until we decide on this Correction/)).toBeInTheDocument();
    expect(screen.queryByText(/claim your Yellow Card at the City Hall or via mail/)).not.toBeInTheDocument();
  });

  it('shows the Citizen copy for a refused second Correction', async () => {
    holdsActiveCard();
    vi.spyOn(yellowCardService, 'submitApplication').mockRejectedValue(
      new YellowCardSubmitError(
        'You already have a Correction waiting for a decision. You can file another once it is decided or withdrawn.',
      ),
    );
    const { container } = render(<YellowCardPage />);
    await screen.findByRole('heading', { name: 'Correct Your Card Details' });

    await userEvent.type(screen.getByRole('textbox', { name: NOTE }), 'Address.');
    await uploadVoterId(container);
    await userEvent.click(screen.getByRole('checkbox', { name: /Data Privacy Consent/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit Correction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/^You already have a Correction waiting/);
  });

  it('shows the waiting Correction instead of a second form', async () => {
    holdsActiveCard([
      { ...APPROVED, id: 'app-2', reference_number: 'YC-2026-000091', status: 'pending', is_correction: true },
      APPROVED,
    ]);

    render(<YellowCardPage />);

    expect(await screen.findByText('Under review')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Correct Your Card Details' })).not.toBeInTheDocument();
  });
});

describe('YellowCardPage beside an active card', () => {
  it("shows a waiting Correction's status beside the card", async () => {
    holdsActiveCard([
      { ...APPROVED, id: 'app-2', reference_number: 'YC-2026-000091', status: 'revision_requested', is_correction: true },
      APPROVED,
    ]);

    render(<YellowCardPage />);

    expect(await screen.findByRole('heading', { name: 'You already have a Yellow Card' })).toBeInTheDocument();
    expect(screen.getByText('Needs your changes')).toBeInTheDocument();
    expect(
      screen.getByText(/Your Correction #YC-2026-000091 was sent back for changes\..*Card #LC-2026-000004 stays valid/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Revise & Resubmit' }));
    expect(push).toHaveBeenCalledWith('/yellow-card/app-2/revise');
  });
});

describe('YellowCardPage: an ordinary application', () => {
  it('asks the printed-card question, sends the answer, and points to the Digital Card', async () => {
    stubCatalogs();
    vi.spyOn(yellowCardService, 'getMyApplications').mockResolvedValue([]);
    vi.spyOn(yellowCardService, 'getMyCards').mockResolvedValue([]);
    const submit = vi
      .spyOn(yellowCardService, 'submitApplication')
      .mockResolvedValue({ id: 'app-1', reference_number: 'YC-2026-000001' });
    vi.spyOn(yellowCardService, 'uploadVoterIdDocument').mockResolvedValue();
    const { container } = render(<YellowCardPage />);
    await screen.findByRole('button', { name: 'Submit Application' });

    expect(screen.queryByRole('textbox', { name: NOTE })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Voter's ID Number/), '123-456-789');
    await userEvent.type(screen.getByLabelText(/First Name/), 'Juan');
    await userEvent.type(screen.getByLabelText(/Last Name/), 'Dela Cruz');
    await userEvent.type(screen.getByLabelText(/Date of Birth/), '1990-01-15');
    await userEvent.selectOptions(screen.getByLabelText(/Sex/), 'male');
    await userEvent.selectOptions(screen.getByLabelText(/Civil Status/), 'single');
    await userEvent.selectOptions(screen.getByLabelText(/Barangay/), 'bocohan');
    await userEvent.type(screen.getByLabelText(/Complete Address/), '123 Rizal Street');
    await userEvent.type(screen.getByLabelText(/Contact Number/), '9171234567');
    await userEvent.type(screen.getByLabelText(/Email Address/), 'juan@example.com');
    await userEvent.type(screen.getByLabelText(/Years of Residency/), '5');
    await userEvent.click(screen.getByRole('checkbox', { name: 'I already hold a printed Yellow Card' }));
    await userEvent.type(screen.getByLabelText(/Printed card number/), '0457');
    await uploadVoterId(container);
    await userEvent.click(screen.getByRole('checkbox', { name: /Data Privacy Consent/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Submit Application' }));

    expect(
      await screen.findByRole('heading', { name: 'Yellow Card Application Submitted Successfully!' }),
    ).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ isCorrection: false, holdsPrintedCard: true, printedCardNumber: '0457' }),
    );
    expect(screen.queryByText(/claim your Yellow Card at the City Hall or via mail/)).not.toBeInTheDocument();
    expect(screen.getByText(/Digital Yellow Card appears in your profile/)).toBeInTheDocument();
  });
});
