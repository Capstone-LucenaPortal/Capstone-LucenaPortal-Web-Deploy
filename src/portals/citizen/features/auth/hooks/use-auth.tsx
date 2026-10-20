'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/portals/citizen/features/auth/lib/auth';
import {
  ACTIVITY_EVENTS,
  IDLE_CHECK_INTERVAL_MS,
  IDLE_SIGNOUT_NOTICE_KEY,
  LAST_ACTIVITY_KEY,
  isIdleExpired,
  recoveryFlagState,
} from '@/portals/citizen/features/auth/lib/session-policy';
import type { User, SignupData } from '@/portals/citizen/features/auth/types';

// Session storage is per-tab; the Supabase session it gates lives in a
// cookie (ADR 0007) and is shared across every tab of this origin. Using
// localStorage here closes the gap where opening a fresh tab mid-reset
// would see the session (via the cookie) but miss the recovery flag (via
// sessionStorage), letting an unfinished reset browse the app normally.
const RECOVERY_FLAG_KEY = 'lucena_pw_recovery_pending';
// An abandoned reset (tab closed mid-flow, never completed) must not lock
// the citizen out of the app forever on their next unrelated visit — the
// flag self-expires well past how long finishing the form actually takes.
const RECOVERY_FLAG_TTL_MS = 30 * 60 * 1000;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** True from the moment a password-recovery link's session is detected
   * until the reset completes (or the user signs out). While true, the
   * session proves only that this browser opened the reset email — it must
   * not be treated as a normal signed-in session anywhere in the app. */
  isPasswordRecovery: boolean;
  /** Set once when a session was ended by the idle timeout, so the UI can say
   * why the citizen is suddenly signed out. Cleared by `dismissIdleNotice`. */
  idleSignOutNotice: boolean;
  dismissIdleNotice: () => void;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  openAuthModal: (mode?: 'login' | 'signup' | 'forgot') => void;
  closeAuthModal: () => void;
  showAuthModal: boolean;
  authMode: 'login' | 'signup' | 'forgot';
  setAuthMode: (mode: 'login' | 'signup' | 'forgot') => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [idleSignOutNotice, setIdleSignOutNotice] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const router = useRouter();
  const pathname = usePathname();

  /** Best-effort sign-out for the security paths (idle cap, expired recovery
   * flag, wrong portal). Unlike the user-initiated `logout`, this must never
   * throw or leave the UI showing a signed-in state — the whole point is to
   * end a session that should not still be live. */
  const hardSignOut = useCallback(async (reason: 'idle' | 'recovery-expired' | 'wrong-portal') => {
    try {
      await authService.logout();
    } catch {
      // signOut can fail on a flaky network. The local artifacts are already
      // cleared by authService.logout's own finally block, and the server-side
      // token expiry covers the rest. Never re-admit the session on failure.
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(RECOVERY_FLAG_KEY);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        if (reason === 'idle') localStorage.setItem(IDLE_SIGNOUT_NOTICE_KEY, '1');
      }
      setUserState(null);
      setIsPasswordRecovery(false);
      if (reason === 'idle') setIdleSignOutNotice(true);
    }
  }, []);

  // Read through a ref so `reconcileProfile` stays stable for the provider's
  // lifetime: the bootstrap effect below subscribes to auth changes exactly
  // once, and must not tear that subscription down on every navigation.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  /**
   * Reconcile the session against the citizens table on every auth change.
   *
   * Two outcomes need routing, not just reporting:
   *
   * - 'not-a-citizen' — a staff account signed into the citizen portal. Every
   *   `my_*` view correctly returns 200 with `[]` for them, which is
   *   indistinguishable from a brand-new empty account, so without this they
   *   land on a dashboard that simply looks broken. Sign out and say where to
   *   go instead.
   * - 'incomplete' — a live session with no `citizens` row, e.g.
   *   `create_citizen_profile` failed after `signUp` succeeded. Their PII is
   *   still sitting in `user_metadata` and nothing was routing them anywhere,
   *   leaving a dead-end account. Send them to /complete-signup to finish.
   */
  const reconcileProfile = useCallback(async () => {
    let outcome: Awaited<ReturnType<typeof authService.ensureCitizenProfile>>;
    try {
      outcome = await authService.ensureCitizenProfile();
    } catch {
      // A transient read failure must not bounce a legitimate citizen out of
      // the portal — leave them where they are and retry on the next change.
      return;
    }
    if (outcome === 'not-a-citizen') {
      await hardSignOut('wrong-portal');
      router.push('/?wrong-portal=staff');
      return;
    }
    if (outcome === 'incomplete' && pathnameRef.current !== '/complete-signup') {
      router.push('/complete-signup');
    }
  }, [hardSignOut, router]);

  // ---- Session bootstrap + password-recovery consistency ----
  useEffect(() => {
    let cancelled = false;

    // A recovery flag that has aged out does NOT simply lapse into a normal
    // session — the underlying Supabase tokens are still perfectly valid and
    // no password was ever set, so it has to be signed out. See
    // `recoveryFlagState` for the full description of the bypass this closes.
    const flagState = recoveryFlagState(
      typeof window === 'undefined' ? null : localStorage.getItem(RECOVERY_FLAG_KEY),
      Date.now(),
      RECOVERY_FLAG_TTL_MS,
    );
    if (flagState === 'expired') {
      void hardSignOut('recovery-expired');
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    if (flagState === 'active') setIsPasswordRecovery(true);

    if (typeof window !== 'undefined' && localStorage.getItem(IDLE_SIGNOUT_NOTICE_KEY)) {
      localStorage.removeItem(IDLE_SIGNOUT_NOTICE_KEY);
      setIdleSignOutNotice(true);
    }

    authService
      .getCurrentUser()
      .then((u) => {
        if (cancelled) return;
        setUserState(u);
        setLoading(false);
        if (u) void reconcileProfile();
      })
      .catch(() => {
        if (cancelled) return;
        setUserState(null);
        setLoading(false);
      });

    const unsub = authService.onAuthChange((u, event) => {
      setUserState(u);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') {
        if (typeof window !== 'undefined') {
          localStorage.setItem(RECOVERY_FLAG_KEY, String(Date.now()));
        }
        setIsPasswordRecovery(true);
      }
      if (u) void reconcileProfile();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [hardSignOut, reconcileProfile]);

  // ---- Cross-tab recovery-flag consistency ----
  // The PASSWORD_RECOVERY event fires in exactly one tab, but the session it
  // creates is shared across every tab of the origin. A tab that was already
  // open when the reset link was clicked never sees the event, so without this
  // it would hold `isPasswordRecovery: false` over a recovery-only session and
  // let it browse the app normally. Re-checking on every storage change (and on
  // mount, above) keeps every tab agreeing about what the session actually is.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== RECOVERY_FLAG_KEY) return;
      const state = recoveryFlagState(
        localStorage.getItem(RECOVERY_FLAG_KEY),
        Date.now(),
        RECOVERY_FLAG_TTL_MS,
      );
      if (state === 'expired') void hardSignOut('recovery-expired');
      else setIsPasswordRecovery(state === 'active');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [hardSignOut]);

  // ---- Idle-session cap (shared/kiosk devices) ----
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const touch = () => {
      // `visibilitychange` fires on the way out as well as the way in; only a
      // tab becoming visible is evidence of a person at the keyboard.
      if (document.visibilityState === 'hidden') return;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    };
    touch();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, touch, { passive: true });
    }

    const tick = window.setInterval(() => {
      if (isIdleExpired(localStorage.getItem(LAST_ACTIVITY_KEY), Date.now())) {
        void hardSignOut('idle');
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, touch);
      window.clearInterval(tick);
    };
  }, [user, hardSignOut]);

  const setUser = (u: User | null) => setUserState(u);

  const dismissIdleNotice = () => setIdleSignOutNotice(false);

  const login = async (email: string, password: string) => {
    const u = await authService.login(email, password);
    setUserState(u);
    setIdleSignOutNotice(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      localStorage.removeItem(IDLE_SIGNOUT_NOTICE_KEY);
    }
    setShowAuthModal(false);
  };

  const signup = async (data: SignupData) => {
    const u = await authService.signup(data);
    setUserState(u);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }
    setShowAuthModal(false);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // signOut can fail (network/server); local session artifacts are already
      // cleared by authService.logout's finally. Server-side token expiry covers
      // the rest — never leave the UI showing a signed-in state.
    } finally {
      setUserState(null);
      setIsPasswordRecovery(false);
      setIdleSignOutNotice(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(RECOVERY_FLAG_KEY);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        localStorage.removeItem(IDLE_SIGNOUT_NOTICE_KEY);
      }
    }
  };

  const openAuthModal = (mode: 'login' | 'signup' | 'forgot' = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const closeAuthModal = () => setShowAuthModal(false);

  return (
    <AuthContext.Provider value={{
      user, loading, isPasswordRecovery, idleSignOutNotice, dismissIdleNotice,
      setUser, login, signup, logout,
      openAuthModal, closeAuthModal, showAuthModal,
      authMode, setAuthMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
