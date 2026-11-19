// Single-timezone portal: audit timestamps carry the Philippine +08:00 offset.
// These helpers bridge the two `type="date"` inputs (bare YYYY-MM-DD) and the
// ISO bounds the filter compares against — always at the fixed PH offset.
const PH_OFFSET = "+08:00";
const PH_SHIFT_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DateRange = { fromDate: string; toDate: string };
/**
 * `fromIso` is inclusive (an entry at that instant is in range); `beforeIso` is
 * exclusive (an entry must be strictly before it). Either is null when unbounded.
 */
export type IsoBounds = { fromIso: string | null; beforeIso: string | null };

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

/** The calendar date after a bare YYYY-MM-DD, timezone-stable. */
function nextDate(date: string): string {
  // A date-only ISO string parses as UTC midnight, so this never sees local time.
  return new Date(Date.parse(date) + DAY_MS).toISOString().slice(0, 10);
}

/**
 * Date-input values → ISO bounds at the PH offset; "" → null (unbounded).
 * From D starts at PH midnight of D. To D ends before PH midnight of D+1, so the
 * whole To day is in range down to any fraction of a second.
 */
export function dateRangeToBounds(range: DateRange): IsoBounds {
  return {
    fromIso: range.fromDate ? `${range.fromDate}T00:00:00${PH_OFFSET}` : null,
    beforeIso: range.toDate
      ? `${nextDate(range.toDate)}T00:00:00${PH_OFFSET}`
      : null,
  };
}

/**
 * True only when both dates are set and From is after To. From equal to To is a
 * valid one-day range; an empty box leaves that side unbounded, so it can't be
 * reversed. Bare YYYY-MM-DD values compare correctly as strings.
 */
export function isReversedRange(range: DateRange): boolean {
  return (
    range.fromDate !== "" &&
    range.toDate !== "" &&
    range.fromDate > range.toDate
  );
}
