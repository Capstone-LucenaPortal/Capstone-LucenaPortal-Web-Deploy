import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '@/app/(citizen)/reset-password/page';
import { RESET_LINK_UNUSABLE_MESSAGE } from '@/portals/citizen/features/auth/lib/auth';

const openAuthModal = vi.fn();
let authState: { user: { id: string } | null; loading: boolean; isPasswordRecovery: boolean };

// The provider itself talks to authService and Supabase on mount; the subject
// under test here is what the page renders for a given session state.
vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ ...authState, logout: vi.fn(), openAuthModal }),
}));

// No App Router is mounted under test. EndUser's vitest.setup.ts stubbed this
// for every test; the app's shared setup does not, since other Portals' tests
// rely on the real redirect()/notFound().
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/reset-password',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  authState = { user: null, loading: false, isPasswordRecovery: false };
});

describe('ResetPasswordPage', () => {
  // The regression this pins: a reset link opened in a browser without the
  // PKCE code verifier lands here with no session. The form still rendered,
  // and submitting it could only fail with a generic "Something went wrong".
  it('explains the link is unusable instead of showing the form when there is no session', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByText(RESET_LINK_UNUSABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
  });

  it('offers to request a new link from the forgot-password form', async () => {
    render(<ResetPasswordPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Request a New Link' }));
    expect(openAuthModal).toHaveBeenCalledWith('forgot');
  });

  it('shows the form once the recovery session is established', () => {
    authState = { user: { id: 'USER-1' }, loading: false, isPasswordRecovery: true };
    render(<ResetPasswordPage />);
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.queryByText(RESET_LINK_UNUSABLE_MESSAGE)).not.toBeInTheDocument();
  });

  it('shows neither state while the session is still being checked', () => {
    authState = { user: null, loading: true, isPasswordRecovery: false };
    render(<ResetPasswordPage />);
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
    expect(screen.queryByText(RESET_LINK_UNUSABLE_MESSAGE)).not.toBeInTheDocument();
  });
});
