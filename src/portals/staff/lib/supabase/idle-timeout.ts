// src/portals/staff/lib/supabase/idle-timeout.ts
//
// The idle half of the session policy (ISO-6; ISO/IEC 27002:2022 A.5.17,
// A.8.5). The other half — auth cookies that die with the browser — is
// src/shared/supabase/session-cookie.ts.
//
// One clock, shared by every tab: a session-scoped cookie holding the time of
// the last thing a person did. Two sides use it.
//
// - The browser writes it (markActivity), from <IdleTimeout /> on real input
//   and from the sign-in screens on success, and signs the tab out when it
//   goes stale.
// - The request guard only reads it (src/shared/guard/idle-clock.ts, on
//   Staff's row in src/shared/guard/portals.ts). A stale clock ends the
//   session before the request is served, which covers a tab whose timers the
//   browser froze.
//
// The browser's clock is not the server's, and a desk PC twenty minutes slow
// would otherwise look idle on every request. The guard measures the gap on
// the first request that carries a clock, keeps it in a second cookie, and
// reads every later value through it. Sign-in drops the old gap so it is
// measured again (restartIdleClock).
//
// Both cookies are unsigned and a missing clock fails open, so this defends
// against an unattended desk, not against the person holding the session.
//
// Requests deliberately do not count as activity. The queue pages poll a
// server action on an interval, so a request-driven clock would keep an
// unattended queue signed in forever.
//
// A cookie rather than localStorage because the guard has to read it.

import { parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";

import { IDLE_SIGNOUT_REASON } from "@/shared/guard/decide";
import { CLOCK_OFFSET_COOKIE, LAST_ACTIVITY_COOKIE } from "@/shared/guard/idle-clock";
import { PORTAL_PREFIX } from "@/shared/guard/portals";

export { CLOCK_OFFSET_COOKIE, IDLE_SIGNOUT_REASON, LAST_ACTIVITY_COOKIE };

/** Idle time after which the session is ended. Staff's guard row carries the
 * same 15 minutes. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** How often an open tab checks the clock. Coarse on purpose: an idle session
 * is not a race, and a 60s tick keeps a background tab from spinning. */
export const IDLE_CHECK_INTERVAL_MS = 60 * 1000;

/** DOM events counted as activity. `visibilitychange` is included so returning
 * to a tab is checked at once (leaving one is not activity); scroll and mousemove are deliberately excluded,
 * as a nudged mouse on an unattended desk is not a person using the portal. */
export const ACTIVITY_EVENTS = ["click", "keydown", "touchstart", "visibilitychange"] as const;

/** `/staff/login?reason=idle` tells the sign-in screen why the person is there. */
export const IDLE_SIGNOUT_PATH = `${PORTAL_PREFIX.staff}/login?reason=${IDLE_SIGNOUT_REASON}`;

/**
 * Pure: has the session been idle past the cap?
 *
 * A missing or unparseable timestamp is NOT treated as idle. Failing open is
 * deliberate: the alternative signs out every session that predates the
 * cookie, and the absolute backstop is the session-scoped auth cookie and the
 * Supabase refresh-token expiry, not this clock.
 */
export function isIdleExpired(lastActivityRaw: string | undefined, now: number): boolean {
  const last = parseInstant(lastActivityRaw);
  if (last === null) return false;
  // A clock that moved backwards (an NTP correction) would otherwise produce
  // a negative age and never expire.
  if (last > now) return false;
  return now - last > IDLE_TIMEOUT_MS;
}

function parseInstant(raw: string | undefined): number | null {
  if (!raw) return null;
  const instant = Number(raw);
  return Number.isFinite(instant) && instant > 0 ? instant : null;
}

/** Browser only: record that a person did something at `now`. No Max-Age, so
 * the clock dies with the browser session, like the auth cookies it guards. */
export function markActivity(now: number): void {
  document.cookie = serializeCookieHeader(LAST_ACTIVITY_COOKIE, String(now), {
    path: "/",
    sameSite: "lax",
  });
}

/** Browser only: a new session's clock. Drops the old offset too, so the
 * guard measures the gap again rather than trusting one from a session
 * this browser's clock may since have been corrected under. */
export function restartIdleClock(now: number): void {
  markActivity(now);
  document.cookie = serializeCookieHeader(CLOCK_OFFSET_COOKIE, "", { path: "/", maxAge: 0 });
}

/** Browser only: the raw clock, for isIdleExpired. */
export function readLastActivity(): string | undefined {
  return parseCookieHeader(document.cookie).find((c) => c.name === LAST_ACTIVITY_COOKIE)?.value;
}
