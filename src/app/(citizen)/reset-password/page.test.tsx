import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '@/app/(citizen)/reset-password/page';
import { RESET_LINK_UNUSABLE_MESSAGE } from '@/portals/citizen/features/auth/lib/auth';

const openAuthModal = vi.fn();
const replace = vi.fn();
const push = vi.fn();
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
    push,
    replace,
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
  window.history.replaceState(null, '', '/reset-password');
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

  // Issue #16. A citizen who is simply signed in has not opened a reset link,
  // and the form would let anyone at their unattended browser set a new
  // password without the current one. Profile asks for it first.
  it('sends a signed-in citizen without a recovery session to Security & Password', () => {
    authState = { user: { id: 'USER-1' }, loading: false, isPasswordRecovery: false };
    render(<ResetPasswordPage />);
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/profile?tab=security');
  });

  // supabase-js reports the exchanged session (INITIAL_SESSION) before it
  // fires PASSWORD_RECOVERY on a later tick, so a page opened from the link
  // briefly looks signed in without a recovery session. Redirecting then
  // would throw away a genuine reset.
  it('waits for the recovery session when opened from a reset link', () => {
    window.history.replaceState(null, '', '/reset-password?code=abc');
    authState = { user: { id: 'USER-1' }, loading: false, isPasswordRecovery: false };
    const { rerender } = render(<ResetPasswordPage />);
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    authState = { ...authState, isPasswordRecovery: true };
    rerender(<ResetPasswordPage />);
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
  });

  // A used or expired link on a browser that is already signed in: supabase-js
  // keeps the existing session and never flags a recovery.
  it('points a signed-in citizen whose link produced no recovery to Security & Password', async () => {
    window.history.replaceState(null, '', '/reset-password?code=stale');
    authState = { user: { id: 'USER-1' }, loading: false, isPasswordRecovery: false };
    render(<ResetPasswordPage />);
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go to Security & Password' }));
    expect(push).toHaveBeenCalledWith('/profile?tab=security');
  });

  it('shows neither state while the session is still being checked', () => {
    authState = { user: null, loading: true, isPasswordRecovery: false };
    render(<ResetPasswordPage />);
    expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
    expect(screen.queryByText(RESET_LINK_UNUSABLE_MESSAGE)).not.toBeInTheDocument();
  });
});
