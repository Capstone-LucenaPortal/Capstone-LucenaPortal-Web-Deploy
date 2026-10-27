/**
 * Session-lifetime policy for the citizen portal, kept as pure functions and
 * constants so it can be unit-tested under the suite's `node` environment.
 * `AuthContext` owns the wiring (listeners, timers, sign-out).
 *
 * Why this file exists at all: `docs/SECURITY.md` names shared/kiosk computers
 * — barangay halls and internet cafés — as threat #4, but only the Admin portal
 * (session-scoped cookies) actually mitigated it. The citizen portal, the one
 * most likely to be used from a shared device, ran supabase-js defaults:
 * `persistSession: true` into `localStorage`, no idle timeout, no absolute cap.
 * Closing the tab left the next person signed in as the previous citizen.
 */

/** Idle time after which the session is ended. Chosen to outlast filling in
 * the longest form in the portal (the LCC booking wizard) without leaving a
 * signed-in session on an unattended machine for a whole afternoon. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** How often the idle check runs. Coarse on purpose — an idle session is not
 * a race, and a 60s tick keeps a background tab from spinning. */
export const IDLE_CHECK_INTERVAL_MS = 60 * 1000;

/** Shared across tabs, like the Supabase session itself. A per-tab
 * (`sessionStorage`) timestamp would let a forgotten background tab expire a
 * session the citizen is actively using in another tab. */
export const LAST_ACTIVITY_KEY = 'lucena_last_activity';

/** Set when a session ends because it went idle, so the next page load can say
 * so instead of silently presenting a signed-out portal. Consumed once. */
export const IDLE_SIGNOUT_NOTICE_KEY = 'lucena_idle_signout';

/** DOM events counted as activity. `visibilitychange` is included so returning
 * to a tab refreshes the clock; scroll/mousemove are deliberately excluded, as
 * a nudged mouse on an unattended kiosk is not a person using the portal. */
export const ACTIVITY_EVENTS = ['click', 'keydown', 'touchstart', 'visibilitychange'] as const;

/**
 * Pure: has the session been idle past the cap?
 *
 * A missing or unparseable timestamp is NOT treated as idle. Failing open here
 * is deliberate: the alternative signs out every citizen whose first page load
 * predates this key existing, and the absolute protection is the Supabase
 * refresh-token expiry, not this clock.
 */
export function isIdleExpired(lastActivityRaw: string | null, now: number): boolean {
  if (!lastActivityRaw) return false;
  const last = Number(lastActivityRaw);
  if (!Number.isFinite(last) || last <= 0) return false;
  // A clock that moved backwards (NTP correction, timezone-fiddling user)
  // would otherwise produce a negative age and never expire.
  if (last > now) return false;
  return now - last > IDLE_TIMEOUT_MS;
}

/** A password-recovery flag as read back. 'active' names the account whose
 * reset link was opened: the flag is not this browser's, it is that user's. */
export type RecoveryFlag =
  | { state: 'none' }
  | { state: 'expired' }
  | { state: 'active'; userId: string };

/**
 * Pure: what to do with a password-recovery flag of a given age.
 *
 * 'expired' is a distinct outcome from 'none' precisely because the two demand
 * opposite handling. The flag's TTL was meant to stop an abandoned reset from
 * locking a citizen out forever, but the Supabase session underneath it — a
 * fully valid, auto-refreshing access + refresh token pair — never expired with
 * it. So on expiry the old code cleared the flag and returned false, and
 * `ProtectedRoute` then admitted a session that had never presented a password
 * to /dashboard, /profile, and every Yellow Card screen. Anyone who opened a
 * reset link on a shared inbox or family device and simply waited got a live
 * citizen session. Deleting the localStorage key by hand did the same thing
 * instantly.
 *
 * 'expired' therefore means "sign this session out", never "carry on".
 */
export function recoveryFlagState(raw: string | null, now: number, ttlMs: number): RecoveryFlag {
  if (!raw) return { state: 'none' };
  const sep = raw.indexOf(':');
  const setAt = Number(sep === -1 ? raw : raw.slice(0, sep));
  const userId = sep === -1 ? '' : raw.slice(sep + 1);
  // An unparseable flag cannot be aged, and one that names no account cannot
  // be matched to the session (issue #41). A recovery session must never be
  // given the benefit of the doubt — treat either as expired and sign out.
  if (!Number.isFinite(setAt) || setAt <= 0 || !userId) return { state: 'expired' };
  if (now - setAt > ttlMs) return { state: 'expired' };
  return { state: 'active', userId };
}

/** Pure: the flag's stored form — when the reset link was opened, and for
 * which account. Read back with `recoveryFlagState`. */
export function encodeRecoveryFlag(userId: string, setAt: number): string {
  return `${setAt}:${userId}`;
}
