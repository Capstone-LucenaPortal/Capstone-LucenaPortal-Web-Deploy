// src/portals/admin/lib/dates.ts
import { MANILA_TIME_ZONE } from "@/shared/dates/manila";

// The five analytics date-range presets. Cross-cutting — consumed by
// components/ui/date-filter-bar.tsx as well as every analytics page, so it
// belongs here rather than inside any one feature slice.
export type DateRangeKey = "Today" | "Week" | "Month" | "Quarter" | "Annual";

// This is a Philippines deployment (UTC+8, no DST). `submitted_at` is
// timestamptz, but export_yellow_card_applications(p_from date, p_to date)
// compares it against `date` bounds, which Postgres casts to timestamptz
// using the *session* timezone — UTC on this project. A date built from the
// browser's (or server's) local getters therefore does not name a Manila
// calendar day, and the RPC's `submitted_at >= p_from` silently clips the
// first eight hours of every "day" (00:00-08:00 Manila = 16:00-23:59 UTC the
// prior day). This is the same defect class fixed in the DB repo at l24's
// public_venue_availability and, more directly on point, l31's
// submit_booking / submit_downpayment — l31's migration header spells out
// exactly this shift: a UTC session zone moves everything eight hours and
// defeats the intended comparison. Both anchor to Asia/Manila instead of the
// host/session zone; this does the same in TypeScript, since there is no
// "at time zone" here — only Intl.DateTimeFormat.
// en-CA's locale format is already YYYY-MM-DD, so formatting with it against
// the Asia/Manila zone directly yields the ISO string for the Manila
// calendar day containing `date` — no arithmetic needed for "today".
const manilaIsoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Numeric (year, 0-indexed month, day) fields for the Manila calendar day
// containing `date`, so callers can do calendar arithmetic (start-of-week,
// start-of-month, ...) without falling back to a local Date getter.
function manilaDateParts(date: Date): { year: number; month: number; day: number } {
  const [year, month, day] = manilaIsoFormatter.format(date).split("-").map(Number);
  return { year, month: month - 1, day };
}

// Renders (year, month, day) as an ISO date string. Built via Date.UTC so
// out-of-range fields (e.g. day 0, or day -5 for "5 days before the 1st")
// normalize the same way a local Date would, but without ever reading the
// host's local timezone.
function isoDateFromParts(year: number, month: number, day: number): string {
  const normalized = new Date(Date.UTC(year, month, day));
  const y = normalized.getUTCFullYear();
  const m = String(normalized.getUTCMonth() + 1).padStart(2, "0");
  const d = String(normalized.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Day-of-week (0 = Sunday .. 6 = Saturday) for a Manila calendar date.
// Weekday is a pure function of (year, month, day) — it does not depend on
// which timezone computes it — so building it via Date.UTC is safe even
// though the real instant for that Manila midnight is 16:00 UTC the prior
// day.
function manilaDayOfWeek(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}

// Concrete from/to bounds for a named preset, anchored on `now` (defaults to
// the real current time; callers — and tests — may pin it). These are the
// bounds sent to the audited export RPC, so "Month" must mean a real calendar
// month and never null: an unbounded export under a preset that LOOKS bounded
// is exactly the hole this function exists to close. What this function
// guarantees is that every non-Custom preset resolves to real, non-null
// bounds instead of silently falling through to "no filter."
//
// TODO: the "Custom" date-range path (see the page's customStart/customEnd
// state) builds its bounds straight from the <input type="date"> values and
// has the same UTC-session-cast exposure this function was built to close.
// Out of scope for this fix; tracked separately.
export function presetDateRange(
  preset: DateRangeKey,
  now: Date = new Date()
): { from: string; to: string } {
  const { year, month, day } = manilaDateParts(now);
  const to = isoDateFromParts(year, month, day);
  switch (preset) {
    case "Today":
      return { from: to, to };
    case "Week": {
      // Monday-start week, matching the ISO week convention used elsewhere
      // in the portal's date filters.
      const dayOfWeek = manilaDayOfWeek(year, month, day); // 0 = Sunday .. 6 = Saturday
      const daysSinceMonday = (dayOfWeek + 6) % 7;
      return { from: isoDateFromParts(year, month, day - daysSinceMonday), to };
    }
    case "Month":
      return { from: isoDateFromParts(year, month, 1), to };
    case "Quarter": {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      return { from: isoDateFromParts(year, quarterStartMonth, 1), to };
    }
    case "Annual":
      return { from: isoDateFromParts(year, 0, 1), to };
  }
}

// Validates the Custom preset's from/to pair before it is sent anywhere that
// matters — above all the audited export RPC, whose bounds are otherwise the
// raw <input type="date"> strings. Named presets never need this: their
// bounds come out of presetDateRange, which only produces well-formed ISO
// dates. Returns a user-facing message describing the first problem found, or
// null when the range is usable. The non-existent-day check works because
// Date.UTC normalizes out-of-range fields (Feb 30 becomes Mar 2), so a value
// that fails to round-trip back to its own string never named a real day.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return isoDateFromParts(year, month - 1, day) === value;
}

export function customRangeError(from: string, to: string): string | null {
  if (!from || !to) {
    return "Select both a start and an end date.";
  }
  if (!isRealIsoDate(from) || !isRealIsoDate(to)) {
    return "Enter valid calendar dates.";
  }
  if (from > to) {
    return "The start date must be on or before the end date.";
  }
  return null;
}

// Renders a timestamptz/date string as a human-readable Manila calendar day
// (e.g. "Aug 1, 2026") for on-screen display and CSV export. Every call site
// that used to build this with `new Date(value).toLocaleDateString("en-PH",
// ...)` and no `timeZone` option was reading the HOST's local timezone, not
// Manila — the same defect class as presetDateRange/filterByDateRange above,
// just in the render layer instead of the filtering layer. Filtering and
// bucketing are Manila-anchored; a row filterByDateRange correctly places in
// August must not then render as "Jul 31" in a browser or CI runner set to a
// negative UTC offset (e.g. TZ=UTC still clips the first eight hours of a
// Manila day the same way the filtering bug did). Returns "—" for a null
// value and the raw string for one that fails to parse, matching the
// call sites' own prior fallback behavior.
// Deliberately NOT hoisted to a module-level Intl.DateTimeFormat singleton:
// a DateTimeFormat resolves (and caches) its default timeZone at
// construction time, so a singleton built at module-import time would keep
// whatever zone was in effect then, immune to any TZ change afterward. That
// caching quirk is exactly why the explicit `timeZone: MANILA_TIME_ZONE`
// below matters — it is what makes the resolved zone Manila regardless of
// construction time, host, or default zone, rather than accidentally
// correct-by-coincidence on a host whose default already happens to be
// Manila.
export function formatManilaDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

// Renders a from/to pair as a human-readable Manila range, e.g.
// "Aug 1, 2026 – Aug 9, 2026", collapsing to a single date when both bounds
// name the same day.
//
// This lived as a private helper inside src/portals/admin/features/sla/lib/sla.ts (feeding
// SlaRangeStats.rangeLabel). It moved here because the three analytics pages
// need the same label for their panel subtitles, which used to read a fixed
// "this month" no matter which preset was selected — so an Annual or Custom
// range described itself as a month. One implementation, one place, rather
// than three pages growing their own.
//
// The Custom preset's from/to come straight from <input type="date">, which
// is transiently "" while the user is mid-edit (the same gap
// previousPeriodRange in src/portals/admin/lib/aggregate.ts guards against), so an
// unformattable bound falls back to the raw strings rather than letting
// Intl.DateTimeFormat throw on an Invalid Date.
export function formatManilaRangeLabel(range: { from: string; to: string }): string {
  const fromDate = new Date(`${range.from}T00:00:00Z`);
  const toDate = new Date(`${range.to}T00:00:00Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return `${range.from} – ${range.to}`;
  }
  const from = manilaRangeLabelFormatter.format(fromDate);
  if (range.from === range.to) return from;
  return `${from} – ${manilaRangeLabelFormatter.format(toDate)}`;
}

const manilaRangeLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Renders an instant (a "last successful fetch" timestamp, not a row field)
// as a human-readable Manila date + time, e.g. "Aug 27, 2026, 3:45 PM", for
// the "Updated {time} (Asia/Manila)" freshness stamp each page shows once its
// data has actually loaded (Admin Portal Fix Plan, Task 4.3). Reuses
// MANILA_TIME_ZONE for the same reason formatManilaDate/
// formatManilaRangeLabel above do — a browser or CI runner in a different
// zone must not silently relabel the instant. Deliberately NOT hoisted to a
// module-level Intl.DateTimeFormat singleton, for the same caching-quirk
// reason documented on formatManilaDate above. Callers are expected to pass
// a real Date (the moment a fetch resolved), so there is no null/invalid
// path to guard here the way the string-parsing formatters above need.
export function formatManilaTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// Filters `rows` to those whose accessor-derived date falls within `range`,
// inclusive at both ends, comparing Manila calendar days rather than raw UTC
// timestamps or Date objects — the same anchoring as presetDateRange, and for
// the same reason: comparing a UTC instant against a browser-local or
// UTC-derived calendar day silently drops records filed in the first eight
// hours of a Manila day (00:00-08:00 Manila = 16:00-23:59 UTC the prior day).
// A `null` range means "no filter" (every row, including those with no date).
// A row whose accessor returns `null` is dropped whenever a range is active,
// since it cannot be placed inside or outside any bound.
export function filterByDateRange<T>(
  rows: T[],
  getDate: (row: T) => string | null,
  range: { from: string; to: string } | null
): T[] {
  if (!range) return rows;
  return rows.filter((row) => {
    const value = getDate(row);
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    const { year, month, day } = manilaDateParts(parsed);
    const manilaDate = isoDateFromParts(year, month, day);
    return manilaDate >= range.from && manilaDate <= range.to;
  });
}
