import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import { authService } from '@/portals/citizen/features/auth/lib/auth';

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
    signup: vi.fn(async () => ({ id: 'USER-B' })),
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
