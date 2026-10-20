// src/shared/guard/idle-clock.ts
//
// The server's reading of the idle clock, for Portals whose guard row has an
// idle timeout (ADR 0006). Taken from the Staff Portal's idle-timeout module;
// the browser side — writing the clock on real input, signing a stale tab
// out — stays with the Portals that use it.
//
// One clock, shared by every tab: a session-scoped cookie holding the time of
// the last thing a person did, written by the browser and only read here.
// Requests deliberately do not count as activity: queue pages poll on an
// interval, so a request-driven clock would keep an unattended queue signed
// in forever.
//
// The browser's clock is not the server's, and a desk PC twenty minutes slow
// would otherwise look idle on every request. The guard measures the gap on
// the first request that carries a clock, keeps it in a second cookie, and
// reads every later value through it.
//
// Both cookies are unsigned and a missing clock fails open, so this defends
// against an unattended desk, not against the person holding the session.

export const LAST_ACTIVITY_COOKIE = "lucena_last_activity";

/** Server time minus browser time, in ms, as measured by the guard. */
export const CLOCK_OFFSET_COOKIE = "lucena_clock_offset";

/**
 * Pure: the browser's last-activity cookie, read in server time.
 *
 * With no usable offset, this request is the anchor: the gap between the two
 * clocks is measured here and returned as `offset` for the caller to keep,
 * and no activity time is reported — the clock was written moments ago, at
 * sign-in or page load, so this reading is not idle.
 */
export function readIdleClock(
  lastActivityRaw: string | undefined,
  offsetRaw: string | undefined,
  serverNow: number,
): { lastActivity?: number; offset?: number } {
  const last = parseInstant(lastActivityRaw);
  if (last === null) return {};
  const offset = offsetRaw ? Number(offsetRaw) : NaN;
  if (!Number.isFinite(offset)) return { offset: serverNow - last };
  return { lastActivity: last + offset };
}

function parseInstant(raw: string | undefined): number | null {
  if (!raw) return null;
  const instant = Number(raw);
  return Number.isFinite(instant) && instant > 0 ? instant : null;
}
