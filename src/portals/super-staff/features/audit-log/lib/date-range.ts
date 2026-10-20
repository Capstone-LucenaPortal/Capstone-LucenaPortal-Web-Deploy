// Single-timezone portal: audit timestamps carry the Philippine +08:00 offset.
// These helpers bridge the two `type="date"` inputs (bare YYYY-MM-DD) and the
// ISO bounds the filter compares against — always at the fixed PH offset.
const PH_OFFSET = "+08:00";
const PH_SHIFT_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DateRange = { fromDate: string; toDate: string };
export type IsoBounds = { fromIso: string | null; toIso: string | null };

/** PH calendar date (YYYY-MM-DD) of an absolute instant, timezone-stable. */
function phDate(instant: Date): string {
  return new Date(instant.getTime() + PH_SHIFT_MS).toISOString().slice(0, 10);
}

/** Default filter window: the 30 days ending on the anchor's PH date. */
export function defaultDateRange(anchor: Date): DateRange {
  return {
    fromDate: phDate(new Date(anchor.getTime() - 30 * DAY_MS)),
    toDate: phDate(anchor),
  };
}

/** Date-input values → inclusive ISO day bounds; "" → null (unbounded). */
export function dateRangeToBounds(range: DateRange): IsoBounds {
  return {
    fromIso: range.fromDate ? `${range.fromDate}T00:00:00${PH_OFFSET}` : null,
    toIso: range.toDate ? `${range.toDate}T23:59:59${PH_OFFSET}` : null,
  };
}
