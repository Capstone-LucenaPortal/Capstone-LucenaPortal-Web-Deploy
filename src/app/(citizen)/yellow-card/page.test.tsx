import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YellowCardPage from '@/app/(citizen)/yellow-card/page';
import { yellowCardService } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import type { MyYellowCardApplication } from '@/portals/citizen/features/yellow-card/types';
import { catalogService } from '@/portals/citizen/lib/supabase/catalogs';

const push = vi.fn();

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
  useSearchParams: () => new URLSearchParams(),
}));

const LOAD_ERROR = 'Could not load your Yellow Card information right now. Please try again later.';

beforeEach(() => {
  vi.clearAllMocks();
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
