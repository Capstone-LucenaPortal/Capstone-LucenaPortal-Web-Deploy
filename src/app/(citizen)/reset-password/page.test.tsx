import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '@/app/(citizen)/reset-password/page';
import Nav from '@/portals/citizen/components/layout/navbar';
import { authService, RESET_LINK_UNUSABLE_MESSAGE } from '@/portals/citizen/features/auth/lib/auth';

const openAuthModal = vi.fn();
const replace = vi.fn();
const push = vi.fn();
const logout = vi.fn<() => Promise<void>>();
let authState: { user: { id: string } | null; loading: boolean; isPasswordRecovery: boolean };

// The provider itself talks to authService and Supabase on mount; the subject
// under test here is what the page renders for a given session state.
vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ ...authState, logout, openAuthModal }),
}));

// The navbar fetches the unread badge for any session; not under test here.
vi.mock('@/portals/citizen/features/notifications/lib/notifications', () => ({
  notificationService: { getMine: () => Promise.resolve([]) },
  unreadCount: () => 0,
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
  logout.mockResolvedValue(undefined);
});

const RECOVERY = { user: { id: 'USER-1' }, loading: false, isPasswordRecovery: true };

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

  // Issue #44: a citizen who opened the link by mistake, or changed their
  // mind, can leave the reset without finishing it.
  describe('Cancel and sign out', () => {
    it('signs out, then takes the citizen home', async () => {
      authState = RECOVERY;
      render(<ResetPasswordPage />);
      await userEvent.click(screen.getByRole('button', { name: 'Cancel and sign out' }));
      expect(logout).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith('/');
      expect(logout.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0]);
    });

    it('still takes the citizen home when the sign-out fails', async () => {
      authState = RECOVERY;
      logout.mockRejectedValue(new Error('network'));
      render(<ResetPasswordPage />);
      await userEvent.click(screen.getByRole('button', { name: 'Cancel and sign out' }));
      expect(push).toHaveBeenCalledWith('/');
    });

    it('cannot be pressed while the new password is saving', async () => {
      authState = RECOVERY;
      vi.spyOn(authService, 'updatePassword').mockReturnValue(new Promise(() => {}));
      render(<ResetPasswordPage />);
      await userEvent.type(screen.getByLabelText('New Password'), 'Str0ng!Passw0rd');
      await userEvent.type(screen.getByLabelText('Confirm New Password'), 'Str0ng!Passw0rd');
      await userEvent.click(screen.getByRole('button', { name: 'Update Password' }));
      expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel and sign out' })).toBeDisabled();
    });

    // logout() clears the session before the page navigates away, and a
    // signed-out /reset-password otherwise reads as an unusable link.
    it.each([
      ['the form', 'Cancel and sign out'],
      ['the navbar', 'Sign out'],
    ])('never says the link is unusable during a cancel from %s', async (_, button) => {
      authState = RECOVERY;
      let finishSignOut!: () => void;
      logout.mockImplementation(() => new Promise<void>((resolve) => { finishSignOut = resolve; }));
      const ui = () => (
        <>
          <Nav />
          <ResetPasswordPage />
        </>
      );
      const { rerender } = render(ui());
      await userEvent.click(screen.getByRole('button', { name: button }));

      // Mid sign-out: the session is already gone.
      authState = { user: null, loading: false, isPasswordRecovery: false };
      rerender(ui());
      expect(screen.queryByText(RESET_LINK_UNUSABLE_MESSAGE)).not.toBeInTheDocument();

      await act(async () => finishSignOut());
      rerender(ui());
      expect(push).toHaveBeenCalledWith('/');
      expect(screen.queryByText(RESET_LINK_UNUSABLE_MESSAGE)).not.toBeInTheDocument();
    });
  });

  // Issue #151: the navbar's "Sign out" follows the same rule as the form's
  // cancel, so a sign-out can't race a new password that is still saving.
  describe("the navbar's Sign out during a password update", () => {
    const withNav = () => (
      <>
        <Nav />
        <ResetPasswordPage />
      </>
    );
    const STRONG = 'Str0ng!Passw0rd';

    async function submitNewPassword(password = STRONG, confirm = STRONG) {
      await userEvent.type(screen.getByLabelText('New Password'), password);
      await userEvent.type(screen.getByLabelText('Confirm New Password'), confirm);
      await userEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    }

    it('is turned off while the new password is saving', async () => {
      authState = RECOVERY;
      vi.spyOn(authService, 'updatePassword').mockReturnValue(new Promise(() => {}));
      render(withNav());
      await submitNewPassword();

      const signOut = screen.getByRole('button', { name: 'Sign out' });
      expect(signOut).toBeDisabled();
      await userEvent.click(signOut);
      expect(logout).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    it('shows "Password Updated" once the save and the sign-out after it go through', async () => {
      authState = RECOVERY;
      vi.spyOn(authService, 'updatePassword').mockResolvedValue(undefined);
      render(withNav());
      await submitNewPassword();
      expect(await screen.findByText('Password Updated')).toBeInTheDocument();
    });

    it('works again after the save fails', async () => {
      authState = RECOVERY;
      vi.spyOn(authService, 'updatePassword').mockRejectedValue(new Error('The new password could not be saved.'));
      render(withNav());
      await submitNewPassword();
      expect(await screen.findByText('The new password could not be saved.')).toBeInTheDocument();

      const signOut = screen.getByRole('button', { name: 'Sign out' });
      expect(signOut).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Cancel and sign out' })).toBeEnabled();
      await userEvent.click(signOut);
      expect(logout).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith('/');
    });

    it.each([
      ['fails the password policy', 'short', 'short'],
      ['does not match', STRONG, `${STRONG}x`],
    ])('is never turned off by a submit that %s', async (_, password, confirm) => {
      authState = RECOVERY;
      const updatePassword = vi.spyOn(authService, 'updatePassword');
      render(withNav());
      await submitNewPassword(password, confirm);
      expect(updatePassword).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
    });

    it('works again if the page leaves mid-save', async () => {
      authState = RECOVERY;
      vi.spyOn(authService, 'updatePassword').mockReturnValue(new Promise(() => {}));
      const { rerender } = render(withNav());
      await submitNewPassword();
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled();

      // The citizen navigates away while the save is still pending.
      rerender(<Nav />);
      const signOut = screen.getByRole('button', { name: 'Sign out' });
      expect(signOut).toBeEnabled();
      await userEvent.click(signOut);
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });
});
