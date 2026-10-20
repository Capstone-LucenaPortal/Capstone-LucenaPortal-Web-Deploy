// Display formatters for server instants, pinned to Manila time. The city
// runs on Philippine time (UTC+8, no DST), and the DB has followed that rule
// since l65. Most pages render on the server, and a hosted server runs in UTC,
// so the zone is set explicitly rather than left to the host or the browser.
//
// Each formatter is built per call, not hoisted to a module-level singleton:
// a DateTimeFormat resolves and caches its zone when it is constructed (see
// src/portals/admin/lib/dates.ts).
//
// Admin's formatManila* and Staff's formatDate/formatDateTime were already
// pinned before this module existed, and stay where they are. Admin's returns
// the raw string for an unparseable value rather than a dash (its tests pin
// that, and its CSV exports carry it), and sits beside the Manila day-key
// helpers.
// Staff's date-time shows a 2-digit hour ("07:00 AM"), which this module's
// timeStyle does not.
//
// MANILA_TIME_ZONE is the one place the zone is named. Every Portal imports
// it rather than writing the literal, so a missing or mistyped zone can be
// found by grepping for this name.
export const MANILA_TIME_ZONE = "Asia/Manila";

export type DateInput = string | number | Date;

/** "long" is "August 1, 2026"; "medium" is "Aug 1, 2026". */
export type ManilaDateStyle = "long" | "medium";

/**
 * What every formatter here renders for a missing or unparseable value. A
 * dash, not "Invalid Date" and not a thrown RangeError, so one bad row cannot
 * take down a server-rendered page. `null` needs its own check: `new Date(null)`
 * is the epoch and would render as "January 1, 1970". A caller that wants to
 * hide the element instead checks the value before formatting.
 */
export const NO_DATE = "—";

/**
 * `value` in Manila time with any other Intl fields, for the odd caller that
 * needs a format the two presets below do not cover (a weekday, a time alone).
 */
export function formatInManila(
  value: DateInput | null | undefined,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone">,
): string {
  if (value == null || value === "") return NO_DATE;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return NO_DATE;
  return new Intl.DateTimeFormat("en-PH", { timeZone: MANILA_TIME_ZONE, ...options }).format(date);
}

/** The Manila calendar day containing `value`, e.g. "August 1, 2026". */
export function formatManilaDate(
  value: DateInput | null | undefined,
  style: ManilaDateStyle = "long",
): string {
  return formatInManila(value, { dateStyle: style });
}

/** The Manila date and clock time of `value`, e.g. "Aug 1, 2026, 7:00 AM". */
export function formatManilaDateTime(
  value: DateInput | null | undefined,
  style: ManilaDateStyle = "long",
): string {
  return formatInManila(value, { dateStyle: style, timeStyle: "short" });
}
