import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from '@/app/(citizen)/profile/page';
import { profileService } from '@/portals/citizen/features/profile/lib/profile';
import type { MyProfile } from '@/portals/citizen/features/profile/types';
import { yellowCardService } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import type { MyYellowCardApplication } from '@/portals/citizen/features/yellow-card/types';

// The provider itself talks to authService and Supabase on mount; the subject
// under test is what the page renders once a citizen is signed in.
vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'citizen-1', name: 'Juan Dela Cruz', email: 'juan@example.com' },
    loading: false,
    isPasswordRecovery: false,
    openAuthModal: vi.fn(),
    logout: vi.fn(),
  }),
}));

// No App Router is mounted under test; see the Citizen CLAUDE.md Testing section.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/profile',
  useSearchParams: () => new URLSearchParams(),
}));

const YELLOW_CARD_ERROR = 'Could not load your Yellow Card information right now. Please try again later.';

const profile = {
  id: 'citizen-1',
  email: 'juan@example.com',
  first_name: 'Juan',
  last_name: 'Dela Cruz',
  anonymised_at: null,
} as unknown as MyProfile;

const application = {
  id: 'app-1',
  reference_number: 'YC-2026-000110',
  status: 'pending',
  submitted_at: '2026-11-10T02:00:00Z',
  first_name: 'Juan',
  last_name: 'Dela Cruz',
  barangay_name: 'Barangay Uno',
  document_count: 1,
} as unknown as MyYellowCardApplication;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(profileService, 'getMyProfile').mockResolvedValue(profile);
  vi.spyOn(yellowCardService, 'getMyApplications').mockResolvedValue([application]);
  vi.spyOn(yellowCardService, 'getMyCards').mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function openYellowCardTab() {
  await userEvent.click(screen.getByRole('button', { name: 'Yellow Card Details' }));
}

describe('ProfilePage Yellow Card Details when a Yellow Card read fails', () => {
  it.each([
    ['applications', 'getMyApplications'],
    ['cards', 'getMyCards'],
  ] as const)('shows the error with a way to retry when the %s read fails, and never "Apply Now"', async (_read, method) => {
    vi.spyOn(yellowCardService, method).mockRejectedValue(new Error(YELLOW_CARD_ERROR));

    render(<ProfilePage />);
    await openYellowCardTab();

    expect(await screen.findByRole('alert')).toHaveTextContent(YELLOW_CARD_ERROR);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText(/You haven.t applied for a Yellow Card yet/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply Now' })).not.toBeInTheDocument();
  });

  it('leaves Account Details as it is', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications').mockRejectedValue(new Error(YELLOW_CARD_ERROR));

    render(<ProfilePage />);

    expect(await screen.findByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();
    expect(screen.getByText('Juan')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('re-reads only the Yellow Card data on "Try again", keeping unsaved Account Details edits', async () => {
    const getMyApplications = vi
      .spyOn(yellowCardService, 'getMyApplications')
      .mockRejectedValueOnce(new Error(YELLOW_CARD_ERROR))
      .mockResolvedValueOnce([application]);

    render(<ProfilePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }));
    const firstName = screen.getByLabelText('First Name');
    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Juanito');

    await openYellowCardTab();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Yellow Card Application Status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getMyApplications).toHaveBeenCalledTimes(2);
    expect(yellowCardService.getMyCards).toHaveBeenCalledTimes(2);
    expect(profileService.getMyProfile).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Account Details' }));
    expect(screen.getByLabelText('First Name')).toHaveValue('Juanito');
  });

  it('stays on the error state when the retry fails too', async () => {
    const getMyApplications = vi
      .spyOn(yellowCardService, 'getMyApplications')
      .mockRejectedValue(new Error(YELLOW_CARD_ERROR));

    render(<ProfilePage />);
    await openYellowCardTab();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(getMyApplications).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent(YELLOW_CARD_ERROR);
    expect(screen.queryByRole('button', { name: 'Apply Now' })).not.toBeInTheDocument();
  });
});

describe('ProfilePage Yellow Card Details when the reads succeed', () => {
  it('shows "Apply Now" for a citizen with no application', async () => {
    vi.spyOn(yellowCardService, 'getMyApplications').mockResolvedValue([]);

    render(<ProfilePage />);
    await openYellowCardTab();

    expect(await screen.findByRole('button', { name: 'Apply Now' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
