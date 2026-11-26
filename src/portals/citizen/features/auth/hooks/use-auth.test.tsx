import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import { authService } from '@/portals/citizen/features/auth/lib/auth';
import {
  IDLE_CHECK_INTERVAL_MS,
  IDLE_TIMEOUT_MS,
  encodeRecoveryFlag,
} from '@/portals/citizen/features/auth/lib/session-policy';

type Listener = (user: { id: string } | null, event?: string) => void;
let listener: Listener | null = null;

// The subject is what the provider makes of the session's auth events; the
// service it reads them from is Supabase underneath.
vi.mock('@/portals/citizen/features/auth/lib/auth', () => ({
  authService: {
    getCurrentUser: vi.fn(async () => null),
    onAuthChange: vi.fn((cb: Listener) => {
      listener = cb;
      return () => {};
    }),
    ensureCitizenProfile: vi.fn(async () => 'exists'),
    login: vi.fn(async () => ({ id: 'USER-B' })),
    signup: vi.fn(async () => ({ status: 'signed-in', user: { id: 'USER-B' } })),
    logout: vi.fn(async () => {}),
  },
}));

// One router for the whole run, as Next's is: a new one per render would
// re-run the provider's bootstrap effect on every render.
const router = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/',
}));

const mount = async () => {
  const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

/** A reset link was opened in this browser: Supabase's recovery session is live. */
const openResetLink = async () => {
  const hook = await mount();
  act(() => listener!({ id: 'USER-A' }, 'PASSWORD_RECOVERY'));
  expect(hook.result.current.isPasswordRecovery).toBe(true);
  return hook;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  listener = null;
});

describe('AuthProvider password recovery', () => {
  // Issue #16. A recovery flag left behind after the recovery session ends
  // treated the next citizen to sign in on this browser as mid-reset, and
  // /reset-password's form sets a new password without the current one.
  it('ends the recovery when the session is signed out from the server', async () => {
    const hook = await openResetLink();
    act(() => listener!(null, 'SIGNED_OUT'));
    expect(hook.result.current.isPasswordRecovery).toBe(false);

    hook.unmount();
    const nextTab = await mount();
    expect(nextTab.result.current.isPasswordRecovery).toBe(false);
  });

  // Signing in proves the password, so whatever reset was pending on this
  // browser is over, whoever started it.
  it('ends the recovery when a citizen signs in', async () => {
    const hook = await openResetLink();
    await act(() => hook.result.current.login('b@example.com', 'Correct-horse-1'));
    expect(hook.result.current.isPasswordRecovery).toBe(false);

    hook.unmount();
    const nextTab = await mount();
    expect(nextTab.result.current.isPasswordRecovery).toBe(false);
  });

  // Signing up sets a password too (when email confirmation is off and the
  // sign-up returns a session).
  it('ends the recovery when a citizen signs up', async () => {
    const hook = await openResetLink();
    await act(() => hook.result.current.signup({} as Parameters<typeof hook.result.current.signup>[0]));
    expect(hook.result.current.isPasswordRecovery).toBe(false);

    hook.unmount();
    const nextTab = await mount();
    expect(nextTab.result.current.isPasswordRecovery).toBe(false);
  });

  // Issue #41. Closing the browser ends a recovery session with no auth event,
  // and a citizen confirming a new account is signed in by the email link's
  // code exchange rather than login(). Neither clears the flag, so the flag
  // has to know whose reset it is.
  it('does not treat a different account signed in by a link as mid-reset', async () => {
    const hook = await openResetLink();
    act(() => listener!({ id: 'USER-B' }, 'SIGNED_IN'));
    expect(hook.result.current.isPasswordRecovery).toBe(false);
  });

  it('does not treat a different account as mid-reset on the next load', async () => {
    const hook = await openResetLink();
    hook.unmount();
    vi.mocked(authService.getCurrentUser).mockResolvedValueOnce({ id: 'USER-B', email: '', name: '' });
    const nextLoad = await mount();
    expect(nextLoad.result.current.user?.id).toBe('USER-B');
    expect(nextLoad.result.current.isPasswordRecovery).toBe(false);
  });

  it('keeps the reset for its own account on the next load', async () => {
    const hook = await openResetLink();
    hook.unmount();
    vi.mocked(authService.getCurrentUser).mockResolvedValueOnce({ id: 'USER-A', email: '', name: '' });
    const nextLoad = await mount();
    expect(nextLoad.result.current.isPasswordRecovery).toBe(true);
  });

  // What must NOT end a recovery. auth-js emits SIGNED_IN when it restores a
  // stored session and a null INITIAL_SESSION after a passing error, so ending
  // the recovery on either would let a reload turn it into a normal session.
  it.each([
    ['a restored session', 'SIGNED_IN'],
    ['a token refresh', 'TOKEN_REFRESHED'],
  ])('keeps the reset through %s', async (_, event) => {
    const hook = await openResetLink();
    act(() => listener!({ id: 'USER-A' }, event));
    expect(hook.result.current.isPasswordRecovery).toBe(true);
  });

  it('keeps the reset through an empty initial session', async () => {
    const hook = await openResetLink();
    act(() => listener!(null, 'INITIAL_SESSION'));
    act(() => listener!({ id: 'USER-A' }, 'SIGNED_IN'));
    expect(hook.result.current.isPasswordRecovery).toBe(true);
  });
});

describe('AuthProvider sign-up', () => {
  const signupData = {} as Parameters<ReturnType<typeof useAuth>['signup']>[0];

  it('signs the citizen in and closes the modal when the sign-up has a session', async () => {
    const hook = await mount();
    act(() => hook.result.current.openAuthModal('signup'));
    let outcome: unknown;
    await act(async () => { outcome = await hook.result.current.signup(signupData); });
    expect(outcome).toBe('signed-in');
    expect(hook.result.current.user).toMatchObject({ id: 'USER-B' });
    expect(hook.result.current.showAuthModal).toBe(false);
  });

  // Issue #65. With email confirmation on there is no session yet: the
  // citizen is not signed in, and the modal stays open to say so.
  it('leaves the citizen signed out with the modal open while the email awaits confirmation', async () => {
    vi.mocked(authService.signup).mockResolvedValueOnce({ status: 'confirm-email' });
    const hook = await mount();
    act(() => hook.result.current.openAuthModal('signup'));
    let outcome: unknown;
    await act(async () => { outcome = await hook.result.current.signup(signupData); });
    expect(outcome).toBe('confirm-email');
    expect(hook.result.current.user).toBeNull();
    expect(hook.result.current.showAuthModal).toBe(true);
    expect(localStorage.getItem('lucena_last_activity')).toBeNull();
  });
});

// Issues #55 and #56. A sign-out the citizen site does on its own says why:
// the Sign In modal opens with the reason, on any page.
describe('AuthProvider sign-out reason', () => {
  it('signs a staff account out to the home page with the Sign In modal open and the wrong-portal reason', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValueOnce({ id: 'STAFF-1', email: '', name: '' });
    vi.mocked(authService.ensureCitizenProfile).mockResolvedValueOnce('not-a-citizen');
    const hook = await mount();
    await waitFor(() => expect(hook.result.current.signOutReason).toBe('wrong-portal'));
    expect(hook.result.current.user).toBeNull();
    expect(hook.result.current.showAuthModal).toBe(true);
    expect(hook.result.current.authMode).toBe('login');
    expect(router.push).toHaveBeenCalledWith('/');
  });
  // The idle cap runs on every page, public ones included: usePathname is '/'.
  it('opens the Sign In modal with the idle reason when the idle cap signs the citizen out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce({ id: 'USER-A', email: '', name: '' });
      const hook = await mount();
      expect(hook.result.current.user?.id).toBe('USER-A');
      await act(async () => { vi.advanceTimersByTime(IDLE_TIMEOUT_MS + IDLE_CHECK_INTERVAL_MS); });
      await waitFor(() => expect(hook.result.current.signOutReason).toBe('idle'));
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.showAuthModal).toBe(true);
      expect(hook.result.current.authMode).toBe('login');

      // The reason outlives a reload, and the modal opens again with it.
      hook.unmount();
      const nextLoad = await mount();
      expect(nextLoad.result.current.signOutReason).toBe('idle');
      expect(nextLoad.result.current.showAuthModal).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('signs out an expired password recovery without a reason or the modal', async () => {
    localStorage.setItem('lucena_pw_recovery_pending', encodeRecoveryFlag('USER-A', Date.now() - 31 * 60 * 1000));
    const hook = await mount();
    await waitFor(() => expect(authService.logout).toHaveBeenCalled());
    expect(hook.result.current.signOutReason).toBeNull();
    expect(hook.result.current.showAuthModal).toBe(false);
  });

  it('has no reason on an ordinary load', async () => {
    const hook = await mount();
    expect(hook.result.current.signOutReason).toBeNull();
    expect(hook.result.current.showAuthModal).toBe(false);
  });

  const signedOutAsStaff = async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValueOnce({ id: 'STAFF-1', email: '', name: '' });
    vi.mocked(authService.ensureCitizenProfile).mockResolvedValueOnce('not-a-citizen');
    const hook = await mount();
    await waitFor(() => expect(hook.result.current.signOutReason).toBe('wrong-portal'));
    return hook;
  };

  it('clears the reason when the modal is closed, so the next Sign In shows none', async () => {
    const hook = await signedOutAsStaff();
    act(() => hook.result.current.closeAuthModal());
    expect(hook.result.current.signOutReason).toBeNull();
    act(() => hook.result.current.openAuthModal('login'));
    expect(hook.result.current.signOutReason).toBeNull();
  });

  it('clears the reason on a successful sign-in', async () => {
    const hook = await signedOutAsStaff();
    await act(() => hook.result.current.login('juan@example.com', 'Correct-horse-1'));
    expect(hook.result.current.signOutReason).toBeNull();
  });

  it('clears the reason on a sign-up that signs in', async () => {
    const hook = await signedOutAsStaff();
    await act(async () => { await hook.result.current.signup({} as Parameters<typeof hook.result.current.signup>[0]); });
    expect(hook.result.current.signOutReason).toBeNull();
  });

  it('does not bring the idle reason back on a reload once the modal was closed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(authService.getCurrentUser).mockResolvedValueOnce({ id: 'USER-A', email: '', name: '' });
      const hook = await mount();
      await act(async () => { vi.advanceTimersByTime(IDLE_TIMEOUT_MS + IDLE_CHECK_INTERVAL_MS); });
      await waitFor(() => expect(hook.result.current.signOutReason).toBe('idle'));
      act(() => hook.result.current.closeAuthModal());

      hook.unmount();
      const nextLoad = await mount();
      expect(nextLoad.result.current.signOutReason).toBeNull();
      expect(nextLoad.result.current.showAuthModal).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  // #65: awaiting email confirmation is a successful sign-up too, and the
  // "Check Your Email" panel's Sign In button must not bring the old line back.
  it('clears the reason on a sign-up that awaits email confirmation', async () => {
    const hook = await signedOutAsStaff();
    vi.mocked(authService.signup).mockResolvedValueOnce({ status: 'confirm-email' });
    await act(async () => { await hook.result.current.signup({} as Parameters<typeof hook.result.current.signup>[0]); });
    expect(hook.result.current.signOutReason).toBeNull();
  });

  it('clears the reason on Logout', async () => {
    const hook = await signedOutAsStaff();
    await act(() => hook.result.current.logout());
    expect(hook.result.current.signOutReason).toBeNull();
  });

  it('keeps the reason when the modal switches to Sign Up and back', async () => {
    const hook = await signedOutAsStaff();
    act(() => hook.result.current.setAuthMode('signup'));
    act(() => hook.result.current.setAuthMode('login'));
    expect(hook.result.current.signOutReason).toBe('wrong-portal');
  });
});
