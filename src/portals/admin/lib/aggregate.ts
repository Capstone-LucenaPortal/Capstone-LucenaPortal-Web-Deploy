// src/portals/admin/lib/aggregate.ts
//
// Pure, synchronous aggregations over rows the admin pages have already
// fetched (via listApplications / listIncidents / listBookings / listVenues).
// Nothing here calls createClient or does I/O — every function is a plain
// array-in, array-out transform, so it needs no mocking to test.
//
// These replace the chart-panel mock data left behind by earlier tasks, and
// (further down this file) the per-preset KPI range-stats functions that
// used to live in the now-deleted mock data modules.
//
// None of these functions knows or cares whether `rows` is the full fetched
// set or an already status/date-filtered subset — that choice belongs to
// the caller. The three pages pass their tab+date `filtered` rows to
// barangayCoverage/categoryMix/eventTypeMix/barangayIncidentRows, so those
// panels agree with the table and CSV export beneath them, but pass the raw
// unfiltered `rows` to recentMonthlyCounts, since a multi-month trend chart
// fed an already date-narrowed array would collapse to ~1 bucket. See the
// comment at each page's recentMonthlyCounts call site for the same rule
// spelled out in-context.
import { MANILA_TIME_ZONE } from "@/shared/dates/manila";
import { filterByDateRange } from "@/portals/admin/lib/dates";
import type { BookingRow } from "@/portals/admin/features/booking/lib/bookings";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { VenueRow } from "@/portals/admin/lib/supabase/catalogs";
import type { ClosureReasonValue } from "@/portals/admin/lib/status-labels";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import { REVIEWABLE_STATUSES } from "@/portals/staff/features/yellow-card/lib/status";
import { NEEDS_ACTION_STATUSES } from "@/portals/staff/features/booking/lib/status";
import type {
  ConventionDateBasis,
  ConventionRangeStats,
  EventTypeSlice,
  VenueBooking,
} from "@/portals/admin/features/booking/types";
import type {
  BarangayIssueRow,
  IssueCategorySlice,
  IssueDateBasis,
  IssueRangeStats,
} from "@/portals/admin/features/incidents/types";
import type {
  BarangayCoverage,
  YellowCardDateBasis,
  YellowCardRangeStats,
} from "@/portals/admin/features/yellow-card/types";

export interface MonthlyReportCount {
  month: string;
  count: number;
  spike?: boolean;
}

type DateRange = { from: string; to: string };

// This mirrors the Manila-anchoring technique in src/portals/admin/lib/dates.ts's internal
// manilaDateParts/manilaIsoFormatter: month bucketing must never fall back to
// Date.getMonth()/getFullYear(), which read the host (or CI runner's) local
// timezone. On this UTC+8 deployment a record filed at 00:30 Manila on the
// 1st is 16:30 UTC on the PRIOR day, so a UTC- or local-getter-based bucket
// silently files it under the wrong month — the exact defect class fixed by
// migrations l24 and l31, and by src/portals/admin/lib/dates.ts itself. src/portals/admin/lib/dates.ts does not
// export its parts helper (and this task must not modify src/portals/admin/lib/dates.ts), so
// the same Intl.DateTimeFormat-against-Asia/Manila technique is repeated here
// rather than reaching past the module boundary.
//
// en-CA renders as YYYY-MM for a (year, month) formatter, which sorts
// oldest-first as a plain string — no separate numeric key needed.
const manilaMonthKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});
const manilaMonthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA_TIME_ZONE,
  month: "short",
});

function manilaMonthKey(date: Date): string {
  return manilaMonthKeyFormatter.format(date);
}

function manilaMonthLabel(date: Date): string {
  return manilaMonthLabelFormatter.format(date);
}

// The row date each page's date type picks. That one accessor drives the KPI
// tiles, the date-filtered rows (table, panels, client-side Export) and the
// monthly chart, so the tiles and the table can't count different rows. A
// row whose picked date is null (a pending application has no decided_at,
// an open incident no resolved_at) drops out of all of them. Kept in Records
// so each date type always returns the same function, which the pages
// memoise on.
const YELLOW_CARD_DATE: Record<YellowCardDateBasis, (row: YellowCardRow) => string | null> = {
  application: (row) => row.submitted_at,
  completion: (row) => row.decided_at,
};
const ISSUE_DATE: Record<IssueDateBasis, (row: IncidentRow) => string | null> = {
  report: (row) => row.submitted_at,
  resolution: (row) => row.resolved_at,
};
const CONVENTION_DATE: Record<ConventionDateBasis, (row: BookingRow) => string | null> = {
  booking: (row) => row.submitted_at,
  event: (row) => row.event_date,
  // When the booking's clock stopped (l121): SLA Reports' Resolution Date for
  // a booking, so its Finished late link keeps its date type here (#175).
  decision: (row) => row.sla_stopped_at,
};

export function yellowCardDateAccessor(basis: YellowCardDateBasis): (row: YellowCardRow) => string | null {
  return YELLOW_CARD_DATE[basis];
}

export function issueDateAccessor(basis: IssueDateBasis): (row: IncidentRow) => string | null {
  return ISSUE_DATE[basis];
}

export function conventionDateAccessor(basis: ConventionDateBasis): (row: BookingRow) => string | null {
  return CONVENTION_DATE[basis];
}

/** Sum of the three status buckets — a pure arithmetic helper components
 * (BarangayCoverageTable) can import directly, with no mock module. */
export function barangayTotal(row: BarangayCoverage): number {
  return row.approved + row.pending + row.rejected;
}

/**
 * Per-barangay approved/pending/rejected counts for the Yellow Card coverage
 * panels.
 *
 * A barangay with zero counted applications in `rows` is simply never added
 * to the map, so it is absent from the result — not present with all-zero
 * counts. That absence is deliberate: BarangayCoverageTable already renders
 * "no applicants" for a barangay it's told about, and a barangay this
 * function never mentions is filtered out of the ranked view entirely, which
 * is the intended behaviour for a coverage panel driven by real submissions.
 *
 * The three UI buckets don't map 1:1 onto the six-value
 * yellow_card_application_status enum: "approved" and "rejected" are their
 * own buckets, "pending", "resubmitted" and "revision_requested" (still
 * genuinely in flight, plus a null status) all read as "pending" here, since
 * there is no fourth bucket in BarangayCoverage for any of them to land in
 * and none is a rejection.
 *
 * "withdrawn" is deliberately excluded from ALL THREE buckets, not folded
 * into "pending": a withdrawn application is terminal — the citizen took it
 * back — so it is not coverage anyone is waiting on, and counting it as
 * pending would inflate the backlog figure this panel exists to report. A
 * barangay whose only applications were withdrawn is therefore absent from
 * the result, same as one that filed nothing at all.
 */
export function barangayCoverage(rows: YellowCardRow[]): BarangayCoverage[] {
  const byBarangay = new Map<string, BarangayCoverage>();

  for (const row of rows) {
    if (row.status === "withdrawn") continue;

    const barangay = row.barangay_name ?? row.barangay_code ?? "Unknown barangay";
    const entry = byBarangay.get(barangay) ?? { barangay, approved: 0, pending: 0, rejected: 0 };
    if (row.status === "approved") {
      entry.approved += 1;
    } else if (row.status === "rejected") {
      entry.rejected += 1;
    } else {
      entry.pending += 1;
    }
    byBarangay.set(barangay, entry);
  }

  return [...byBarangay.values()];
}

/**
 * Buckets `rows` into Manila calendar months via `getDate`, oldest-first.
 *
 * `getDate` returns the raw timestamptz string (e.g. `submitted_at`); rows
 * with a null or unparseable date are skipped rather than falling into a
 * bogus bucket. The result only contains months that actually have at least
 * one row — there is no zero-fill for months the caller "expects" to see,
 * since a pure function over `rows` alone has no notion of "now" or a
 * desired window; callers wanting a fixed trailing window (e.g. "last 6
 * months") slice the (already oldest-first) result themselves.
 */
export function monthlyCounts<T>(
  rows: T[],
  getDate: (row: T) => string | null
): MonthlyReportCount[] {
  const buckets = new Map<string, { label: string; count: number }>();

  for (const row of rows) {
    const value = getDate(row);
    if (!value) continue;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) continue;

    const key = manilaMonthKey(parsed);
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { label: manilaMonthLabel(parsed), count: 1 });
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, bucket]) => ({ month: bucket.label, count: bucket.count }));
}

/**
 * The "… by month · Last 6 months" chart: monthlyCounts over `rows`, capped
 * at the current Manila month, then the trailing 6 months present.
 *
 * The cap matters for a date that can lie ahead, such as Convention Center's
 * event_date: an upcoming booking would otherwise fill the window with future
 * months and push the past ones out. It compares Manila month keys, never UTC
 * or the browser's zone, for the reason given above manilaMonthKeyFormatter.
 */
export function recentMonthlyCounts<T>(
  rows: T[],
  getDate: (row: T) => string | null,
  now: Date = new Date()
): MonthlyReportCount[] {
  const currentMonth = manilaMonthKey(now);
  const upToNow = rows.filter((row) => {
    const value = getDate(row);
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && manilaMonthKey(parsed) <= currentMonth;
  });
  return monthlyCounts(upToNow, getDate).slice(-6);
}

/**
 * Share of incidents per `category_code`, most-common first.
 *
 * A category with no rows never enters the map, so it's omitted rather than
 * shown with count 0. Rows with a null category_code are grouped under
 * "uncategorized" rather than dropped, so the slice total still equals
 * `rows.length`.
 */
export function categoryMix(rows: IncidentRow[]): IssueCategorySlice[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const category = row.category_code ?? "uncategorized";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([aCategory, aCount], [bCategory, bCount]) => bCount - aCount || aCategory.localeCompare(bCategory))
    .map(([category, count]) => ({ category, count }));
}

/**
 * Share of bookings per `event_type_code`, most-common first. Same shape and
 * same omit-if-absent rule as categoryMix, over the booking rows instead of
 * incident rows.
 */
export function eventTypeMix(rows: BookingRow[]): EventTypeSlice[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const type = row.event_type_code ?? "uncategorized";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([aType, aCount], [bType, bCount]) => bCount - aCount || aType.localeCompare(bType))
    .map(([type, count]) => ({ type, count }));
}

/**
 * Booking requests per venue, for the "Booking requests per venue" panel
 * (metrics sheet C7). The page passes the rows its range and status tab
 * already filter, so the panel agrees with the table under it (#118).
 *
 * Unlike barangayCoverage, this is driven by `venues` (from listVenues()),
 * not by which codes happen to appear in `rows` — a venue with zero requests
 * in range is still a real, nameable venue and a real signal ("nobody booked
 * this"), so it appears with `bookings: 0` rather than being silently
 * dropped. `capacityLabel` and `venue` (the display name) come from the venue
 * catalog too, since admin_booking_analytics carries only `venue_code`, never
 * a label or capacity.
 *
 * There is no fill figure: admin_booking_analytics has `estimated_headcount`
 * per booking, but no venue capacity NUMBER — `booking_venues.capacity_label`
 * is free text (e.g. "1000 classroom / 500 table"), not a figure to divide
 * by. `chip` is never set here — public_booking_venues carries no
 * promotional-badge data — but stays optional on the returned shape so a
 * future data source can populate it without a prop change.
 */
export function bookingRequestsPerVenue(rows: BookingRow[], venues: VenueRow[]): VenueBooking[] {
  const bookingsByVenueCode = new Map<string, number>();

  for (const row of rows) {
    if (!row.venue_code) continue;
    bookingsByVenueCode.set(row.venue_code, (bookingsByVenueCode.get(row.venue_code) ?? 0) + 1);
  }

  return venues.map((venue) => ({
    venue: venue.label ?? venue.code ?? "Unknown venue",
    capacityLabel: venue.capacity_label ?? "",
    bookings: venue.code ? bookingsByVenueCode.get(venue.code) ?? 0 : 0,
    barClass: "bg-blue-800",
  }));
}

/**
 * Per-barangay incident totals with each barangay's leading category, for
 * the "Reports by barangay" hotspot table.
 *
 * Ties are broken deterministically rather than by whichever category a
 * Map happens to iterate first (which is insertion order, i.e. row order in
 * `rows` — an accident of fetch order, not a meaningful tiebreak): both the
 * barangay ranking and the per-barangay top-category pick break ties by
 * ascending code/name, so the same `rows` always produce the same output
 * regardless of how the rows were ordered going in.
 */
export function barangayIncidentRows(rows: IncidentRow[]): BarangayIssueRow[] {
  const byBarangay = new Map<string, { reports: number; categories: Map<string, number> }>();

  for (const row of rows) {
    const barangay = row.barangay_name ?? row.barangay_code ?? "Unknown barangay";
    const category = row.category_code ?? "uncategorized";

    const entry = byBarangay.get(barangay) ?? { reports: 0, categories: new Map<string, number>() };
    entry.reports += 1;
    entry.categories.set(category, (entry.categories.get(category) ?? 0) + 1);
    byBarangay.set(barangay, entry);
  }

  return [...byBarangay.entries()]
    .map(([barangay, { reports, categories }]) => {
      const [topCategory, topCategoryCount] = [...categories.entries()].sort(
        ([aCategory, aCount], [bCategory, bCount]) => bCount - aCount || aCategory.localeCompare(bCategory)
      )[0];
      return { barangay, reports, topCategory, topCategoryCount };
    })
    .sort((a, b) => b.reports - a.reports || a.barangay.localeCompare(b.barangay));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The date range immediately preceding `range`, with the same span in days —
 * the baseline every KPI tile's "vs previous period" delta below compares
 * against. `range.from`/`range.to` are plain ISO calendar-date strings
 * (YYYY-MM-DD, the shape presetDateRange/filterByDateRange already produce
 * and consume), so shifting them via Date.UTC-based arithmetic is safe here
 * even though the rest of this file is careful to anchor "now" to
 * Asia/Manila: there is no "now" or host timezone read by shifting one
 * already-resolved calendar date by a fixed number of days, only arithmetic
 * on the date strings themselves.
 *
 * The Custom preset's from/to come straight from <input type="date">, which
 * is transiently "" while the user is mid-edit (the same "Mid-edit the date
 * inputs can be empty or invalid" gap the old mock's customSlaRangeStats
 * fallback handled) — an unparseable range has no well-defined predecessor,
 * so this returns `range` itself unchanged rather than constructing an
 * Invalid Date and throwing. Every KPI tile's delta then reads as "no
 * change", a harmless flash on the frame the input is empty rather than a
 * crash.
 */
export function previousPeriodRange(range: DateRange): DateRange {
  const fromMs = Date.parse(`${range.from}T00:00:00Z`);
  const toMs = Date.parse(`${range.to}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return range;

  const spanDays = Math.max(1, Math.round((toMs - fromMs) / 86_400_000) + 1);
  const prevToMs = fromMs - 86_400_000;
  const prevFromMs = prevToMs - (spanDays - 1) * 86_400_000;
  return { from: isoDateFromMs(prevFromMs), to: isoDateFromMs(prevToMs) };
}

function isoDateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * A KPI tile's "vs previous period" note: the words, and which way the figure
 * moved as those words show it. `movement` is null when the note shows no
 * movement — no change at the rounding shown, or no previous figure to
 * compare with — so a tile never calls a "+0%" better or worse. KpiTile turns
 * the movement into "better" or "worse" only for a figure that passes a
 * direction (an effectiveness figure); a volume figure's note stays as written.
 */
export interface Delta {
  text: string;
  movement: "up" | "down" | null;
}

function movementOf(diff: number): Delta["movement"] {
  return diff > 0 ? "up" : diff < 0 ? "down" : null;
}

/**
 * Relative percent change from `previous` to `current`, formatted as a KPI
 * tile note. `previous === 0` has no percentage baseline to divide by, so it
 * reads as "New activity" (current > 0) or "No activity" (current === 0)
 * rather than an Infinity/NaN.
 */
export function percentDelta(current: number, previous: number, suffix = "vs previous period"): Delta {
  if (previous === 0) {
    return { text: current === 0 ? `No activity ${suffix}` : `New activity ${suffix}`, movement: null };
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  const sign = pct >= 0 ? "+" : "";
  return { text: `${sign}${pct}% ${suffix}`, movement: movementOf(pct) };
}

/** Absolute percentage-point change, for KPI tiles reporting a rate. */
export function pointsDelta(current: number, previous: number, suffix = "vs previous period"): Delta {
  const diff = round1(current - previous);
  const sign = diff >= 0 ? "+" : "";
  return { text: `${sign}${diff} pts ${suffix}`, movement: movementOf(diff) };
}

/**
 * pointsDelta, but for a possibly-null rate — decidedRatePct/resolutionOf
 * (and the per-service SLA compliance in sla.ts) return `null`
 * when their denominator is 0, e.g. no decided applications yet in a "Today"
 * preset. With no rate on one or both sides there is no meaningful swing to
 * report — this reads "No comparable data" rather than coercing null to 0
 * and reporting a fabricated (and often huge) delta.
 */
export function ratePointsDelta(current: number | null, previous: number | null, suffix = "vs previous period"): Delta {
  if (current === null || previous === null) return { text: `No comparable data ${suffix}`, movement: null };
  return pointsDelta(current, previous, suffix);
}

/**
 * Renders a possibly-null rate (decidedRatePct/resolutionOf, or the
 * per-service SLA compliance figures in sla.ts) for on-screen
 * display: "—" when there is no denominator to compute a rate from, the
 * rounded percentage otherwise. Every KPI tile that shows a rate must go
 * through this rather than `${value}%` or `value ?? 0`, so a genuine
 * "no data yet" period (a quiet Sunday, an empty "Today" preset) can never
 * be misread as "0% compliance" — the false signal this task exists to fix.
 */
export function formatRate(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

/**
 * Renders a possibly-null mean duration in days (averageResolutionDays, and
 * the size of a daysDelta swing) for on-screen display, picking the unit
 * from the value: days at a day or more ("1.4d", "2d"), hours under a day
 * ("5.2h"), whole minutes under an hour ("27 min", "<1 min"). Rounding up
 * into the next unit shows that unit ("1d", not "24h"; "1h", not "60 min").
 * `null` — nothing in range was resolved — is "—", following formatRate's
 * rule. Every Avg time to resolve surface must go through this rather than
 * `${value}d`, so a 27-minute mean can never read as "0d".
 */
export function formatDuration(days: number | null): string {
  if (days === null) return "—";
  const minutes = days * 1440;
  if (minutes < 1) return "<1 min";
  const wholeMinutes = Math.round(minutes);
  if (wholeMinutes < 60) return `${wholeMinutes} min`;
  const hours = round1(days * 24);
  if (hours < 24) return `${hours}h`;
  return `${round1(days)}d`;
}

/** Absolute integer change, for KPI tiles reporting a small count (e.g. SLA
 * violations) where a percentage swing would be noisy or undefined at 0. */
export function countDelta(current: number, previous: number, suffix = "vs previous period"): Delta {
  const diff = current - previous;
  const sign = diff >= 0 ? "+" : "";
  return { text: `${sign}${diff} ${suffix}`, movement: movementOf(diff) };
}

/**
 * Change in a mean duration in days (e.g. average response time), phrased
 * as faster/slower rather than signed, since "-0.2 pts" reads oddly for a
 * duration. The swing is worked out from the unrounded means and written
 * through formatDuration ("16.3h faster", "1.1d slower"); under one minute
 * reads "No change". A `null` mean on either side (nothing resolved in that
 * period — see averageResolutionDays) has no swing to report, so it reads
 * "No comparable data", as ratePointsDelta does for a null rate.
 */
export function daysDelta(current: number | null, previous: number | null): Delta {
  if (current === null || previous === null) return { text: "No comparable data vs previous period", movement: null };
  const diff = current - previous;
  if (Math.abs(diff) * 1440 < 1) return { text: "No change vs previous period", movement: null };
  const direction = diff < 0 ? "faster" : "slower";
  return { text: `${formatDuration(Math.abs(diff))} ${direction} vs previous period`, movement: movementOf(diff) };
}

/**
 * Average number of days between `submitted_at` and `resolved_at` for
 * incidents that have both, over `rows` as given (the caller decides whether
 * that is date-filtered or not). Incidents with no resolution yet, or a
 * malformed timestamp, are excluded from the average rather than counted as
 * zero days — an unresolved incident has no response time to report.
 * Returns `null` when nothing qualifies (callers render it as "—" via
 * formatDuration, never as 0d), and leaves the mean unrounded: rounding
 * happens only in formatDuration, so a 27-minute mean isn't flattened to 0.
 * Incidents only: Yellow Card's clock pauses while an application sits in
 * revision_requested (see getSlaTrend's doc comment in src/portals/admin/features/sla/lib/sla.ts), so
 * folding its duration in here would not be a faithful reading of either
 * clock.
 */
export function averageResolutionDays(rows: IncidentRow[]): number | null {
  const durations = rows
    .filter((row) => row.resolved_at && row.submitted_at)
    .map(
      (row) =>
        (new Date(row.resolved_at as string).getTime() - new Date(row.submitted_at as string).getTime()) /
        86_400_000
    )
    .filter((days) => Number.isFinite(days) && days >= 0);

  if (durations.length === 0) return null;
  return durations.reduce((sum, days) => sum + days, 0) / durations.length;
}

/**
 * A report's time to triage in hours: filing to routing, from the view (l42).
 * null when it was never routed, or when it was reopened: reopening resets
 * `routed_at` (l28's reopen_incident), so the view's figure is then filing to
 * reopening, not triage (metrics sheet I8). The table, the export and Avg time
 * to triage all read it through here, so they leave out the same reports.
 */
export function triageHoursOf(row: IncidentRow): number | null {
  if ((row.reopened_count ?? 0) > 0) return null;
  return row.time_to_triage_hours ?? null;
}

/**
 * Average time to triage in days, over `rows` as given, leaving out reports
 * never routed or reopened (triageHoursOf). In days so it shares
 * formatDuration and daysDelta with Avg time to resolve. `null` when nothing
 * qualifies, rendered "—" (metrics sheet I10).
 */
export function averageTriageDays(rows: IncidentRow[]): number | null {
  const hours = rows
    .map(triageHoursOf)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);

  if (hours.length === 0) return null;
  return hours.reduce((sum, value) => sum + value, 0) / hours.length / 24;
}

// The Service backlog: every request waiting on the city right now, whatever
// the range (Admin CONTEXT.md; metrics sheet D2). A request whose next move is
// the resident's is not in it: a Yellow Card in revision, a booking awaiting
// payment, a resubmission or its organisation document. The Yellow Card and
// booking sets ARE the Staff Portal's own Backlog, read from its status.ts
// files, so both Portals give the same number and a status Staff adds to
// either set joins this one with no edit here (#133). A confirmed booking is
// in it: the office still records the balance. The incident set is Admin's
// own; Staff has no one set for it. The Dashboard counts all three; Pending
// Review and Open Backlog count their own service from this same definition
// (#116).
const SERVICE_BACKLOG_STATUSES: Record<"yellowCard" | "incidents" | "bookings", ReadonlySet<string>> = {
  yellowCard: new Set(REVIEWABLE_STATUSES),
  incidents: new Set(["open", "in_pool", "in_progress"]),
  bookings: new Set(NEEDS_ACTION_STATUSES),
};

/** The rows of one service that are in the Service backlog. */
export function inServiceBacklog<T extends { status: string | null }>(
  rows: T[],
  service: keyof typeof SERVICE_BACKLOG_STATUSES
): T[] {
  const statuses = SERVICE_BACKLOG_STATUSES[service];
  return rows.filter((row) => row.status !== null && statuses.has(row.status));
}

/** Of one service's Service backlog, how many are past due and how many at risk. */
export interface BacklogDeadlines {
  pastDue: number;
  atRisk: number;
}

// One service's Service backlog, split by deadline in a single pass over it:
// every figure and table below reads this, so each call filters the backlog
// once and reads each row's deadline once (#133).
interface BacklogSplit<T> {
  rows: T[];
  pastDue: T[];
  atRisk: number;
}

// The database's deadline_state, the Staff queue's own (l80, l112): it needs
// Working Time, Office Hours and Holidays, so nothing here recomputes it.
// sla_breached is no use here: a pending row never sets it.
function splitYellowCardBacklog(rows: YellowCardRow[]): BacklogSplit<YellowCardRow> {
  const backlog = inServiceBacklog(rows, "yellowCard");
  const pastDue: YellowCardRow[] = [];
  let atRisk = 0;
  for (const row of backlog) {
    if (row.deadline_state === "overdue") pastDue.push(row);
    else if (row.deadline_state === "at_risk") atRisk += 1;
  }
  return { rows: backlog, pastDue, atRisk };
}

// Past due once now reaches the report's own due time, which the database
// stamps when the clock arms (routed and verified), with the target of that
// moment. A report with no due time has no clock: neither past due nor at
// risk. At risk is the view's flag (l112, super_metrics' rule), read when the
// page fetched; a report whose due time has passed since then counts once,
// as past due.
function splitIncidentBacklog(rows: IncidentRow[], now: Date): BacklogSplit<IncidentRow> {
  const backlog = inServiceBacklog(rows, "incidents");
  const nowMs = now.getTime();
  const pastDue: IncidentRow[] = [];
  let atRisk = 0;
  for (const row of backlog) {
    if (row.sla_due_at !== null && new Date(row.sla_due_at).getTime() <= nowMs) pastDue.push(row);
    else if (row.sla_at_risk === true) atRisk += 1;
  }
  return { rows: backlog, pastDue, atRisk };
}

// A booking's deadline_state is the database's (l121), read through the
// Admin front at fetch time: on_track, at_risk or overdue while its clock
// runs, null otherwise. So a confirmed booking waiting on its balance is in
// the backlog but never past due or at risk (its clock stopped at
// confirmation), and nor is one paused on the organiser or one with no clock.
function splitBookingBacklog(rows: BookingRow[]): BacklogSplit<BookingRow> {
  const backlog = inServiceBacklog(rows, "bookings");
  const pastDue: BookingRow[] = [];
  let atRisk = 0;
  for (const row of backlog) {
    if (row.deadline_state === "overdue") pastDue.push(row);
    else if (row.deadline_state === "at_risk") atRisk += 1;
  }
  return { rows: backlog, pastDue, atRisk };
}

/**
 * Pending Review's "N past due · M at risk" (metrics sheet Y4), and the
 * Yellow Card half of SLA Reports' Past due now (S4). Reads ALL of `rows`,
 * whatever the range: the backlog is right now.
 */
export function yellowCardBacklogDeadlines(rows: YellowCardRow[]): BacklogDeadlines {
  const { pastDue, atRisk } = splitYellowCardBacklog(rows);
  return { pastDue: pastDue.length, atRisk };
}

/**
 * The Yellow Card applications past due now: the rows behind Pending
 * Review's past-due note and SLA Reports' Past due now, which the Yellow
 * Card table narrows to when it arrives from there (#127). Reads ALL of
 * `rows`, whatever the range.
 */
export function yellowCardPastDueRows(rows: YellowCardRow[]): YellowCardRow[] {
  return splitYellowCardBacklog(rows).pastDue;
}

/**
 * Open Backlog's "N past due · M at risk" (metrics sheet I4), and the
 * incident half of SLA Reports' Past due now (S4). Reads ALL of `rows`,
 * whatever the range, against `now`.
 */
export function incidentBacklogDeadlines(rows: IncidentRow[], now: Date = new Date()): BacklogDeadlines {
  const { pastDue, atRisk } = splitIncidentBacklog(rows, now);
  return { pastDue: pastDue.length, atRisk };
}

/**
 * The incident reports past due now: the rows behind Open Backlog's
 * past-due note and SLA Reports' Past due now, which the Incident Reports
 * table narrows to when it arrives from there (#127). Reads ALL of `rows`,
 * whatever the range, against `now`.
 */
export function incidentPastDueRows(rows: IncidentRow[], now: Date = new Date()): IncidentRow[] {
  return splitIncidentBacklog(rows, now).pastDue;
}

/**
 * The booking half of SLA Reports' Past due now (S4) and of the Dashboard's
 * Needs attention (D6): bookings in the Service backlog whose clock is
 * running and overdue. Reads ALL of `rows`, whatever the range.
 */
export function bookingBacklogDeadlines(rows: BookingRow[]): BacklogDeadlines {
  const { pastDue, atRisk } = splitBookingBacklog(rows);
  return { pastDue: pastDue.length, atRisk };
}

/**
 * The bookings past due now: the rows behind SLA Reports' Booking Past due
 * now, which the Convention Center table narrows to when it arrives from
 * there (#175). Reads ALL of `rows`, whatever the range.
 */
export function bookingPastDueRows(rows: BookingRow[]): BookingRow[] {
  return splitBookingBacklog(rows).pastDue;
}

/**
 * KPI-tile figures for the Yellow Card page, computed from `rows` the page
 * has already fetched via listApplications().
 *
 * `applications`/`approvalRatePct` and their deltas describe `range` (via
 * `getDate`, so the caller controls whether that's submitted_at or
 * decided_at — the page's "application"/"completion" date-basis toggle).
 * `pendingReview` and its past-due and at-risk counts intentionally read ALL of `rows`, not the
 * date-filtered slice: pending review is a point-in-time backlog, not a
 * per-period count, the same rule the old mock data documented ("Pending
 * review is a point-in-time backlog, so it stays constant across ranges").
 *
 * `barangaysTotal` is not derived from `rows` — a barangay with zero
 * applications never appears in them — so the caller supplies the real total
 * barangay count, from `public_barangays` via listBarangays(). Pass null when
 * that list could not be read: `barangaysTotal`/`barangaysWithZero` then come
 * back null and the tile renders "N / —". Passing 0 instead would render
 * "N / 0" and claim a negative number of barangays have no applicants.
 */
export function yellowCardRangeStats(
  rows: YellowCardRow[],
  range: DateRange,
  getDate: (row: YellowCardRow) => string | null,
  barangaysTotal: number | null
): YellowCardRangeStats {
  const current = filterByDateRange(rows, getDate, range);
  const previous = filterByDateRange(rows, getDate, previousPeriodRange(range));

  const approvalRatePct = decidedRatePct(current);
  const previousApprovalRatePct = decidedRatePct(previous);

  const barangaysReached = barangayCoverage(current).length;

  const backlog = splitYellowCardBacklog(rows);

  return {
    applications: current.length,
    applicationsDelta: percentDelta(current.length, previous.length),
    approvalRatePct,
    approvalRateDelta: ratePointsDelta(approvalRatePct, previousApprovalRatePct),
    barangaysReached,
    barangaysTotal,
    barangaysWithZero: barangaysTotal === null ? null : Math.max(0, barangaysTotal - barangaysReached),
    pendingReview: backlog.rows.length,
    pendingPastDue: backlog.pastDue.length,
    pendingAtRisk: backlog.atRisk,
  };
}

// null when `decided` (approved + rejected) is 0 — e.g. a quiet "Today"
// preset with nothing decided yet. The old `: 0` fallback here read as an
// alarming "0% approval rate" on a period that simply had no decisions to
// score, not one where every decision was a rejection. Callers must render
// null as "—" (via formatRate), never as a literal 0%.
function decidedRatePct(rows: YellowCardRow[]): number | null {
  const approved = rows.filter((row) => row.status === "approved").length;
  const rejected = rows.filter((row) => row.status === "rejected").length;
  const decided = approved + rejected;
  return decided > 0 ? round1((approved / decided) * 100) : null;
}

// Whether a `closed` incident counts as resolved, per closure reason.
// `invalid` (a refusal, l85_refuse_incident.sql), `duplicate` and
// `expired_unverified` close a report that was never fixed, so they don't
// (GitHub #18, PO answer 2026-10-27, question 32). The same three are
// sla.ts's NON_SCOREABLE_CLOSURE_REASONS. A Record, not a Set, so a new
// closure_reason value fails tsc here until someone decides which side it is.
const CLOSURE_REASON_IS_RESOLUTION: Record<ClosureReasonValue, boolean> = {
  citizen_confirmed: true,
  auto_confirmed: true,
  invalid: false,
  duplicate: false,
  expired_unverified: false,
};

// incidents_check guarantees a `closed` row has a closure_reason
// ((status = 'closed') = (closure_reason is not null), l10a).
function isResolvedIncident(row: IncidentRow): boolean {
  if (row.status === "resolved") return true;
  return row.status === "closed" && row.closure_reason !== null && CLOSURE_REASON_IS_RESOLUTION[row.closure_reason];
}

// Closed as invalid, duplicate or expired: a report that was never fixed.
function isClosedUnresolved(row: IncidentRow): boolean {
  return row.status === "closed" && row.closure_reason !== null && !CLOSURE_REASON_IS_RESOLUTION[row.closure_reason];
}

/**
 * KPI-tile figures for the Incident Reports page, computed from `rows` the
 * page has already fetched via listIncidents(). Mirrors yellowCardRangeStats
 * above: `reports`/`resolutionRatePct`/`avgTimeToResolveDays` describe `range`
 * (via `getDate`), while `openBacklog` and its past-due and at-risk counts
 * read ALL of `rows`, since an open backlog is a point-in-time queue, not a
 * per-period count.
 *
 * `now` defaults to the real current time, and is what past due is read
 * against (mirroring presetDateRange's own `now` parameter in
 * src/portals/admin/lib/dates.ts).
 */
export function issueRangeStats(
  rows: IncidentRow[],
  range: DateRange,
  getDate: (row: IncidentRow) => string | null,
  now: Date = new Date()
): IssueRangeStats {
  const current = filterByDateRange(rows, getDate, range);
  const previous = filterByDateRange(rows, getDate, previousPeriodRange(range));

  const resolution = resolutionOf(current);
  const previousResolution = resolutionOf(previous);

  const avgTimeToResolveDays = averageResolutionDays(current);
  const previousAvgTimeToResolveDays = averageResolutionDays(previous);

  const avgTimeToTriageDays = averageTriageDays(current);
  const previousAvgTimeToTriageDays = averageTriageDays(previous);

  const backlog = splitIncidentBacklog(rows, now);

  return {
    reports: current.length,
    reportsDelta: percentDelta(current.length, previous.length),
    resolutionRatePct: resolution.ratePct,
    resolutionRateDelta: ratePointsDelta(resolution.ratePct, previousResolution.ratePct),
    resolutionStillOpen: resolution.stillOpen,
    avgTimeToResolveDays,
    avgTimeToResolveDelta: daysDelta(avgTimeToResolveDays, previousAvgTimeToResolveDays),
    avgTimeToTriageDays,
    avgTimeToTriageDelta: daysDelta(avgTimeToTriageDays, previousAvgTimeToTriageDays),
    openBacklog: backlog.rows.length,
    backlogPastDue: backlog.pastDue.length,
    backlogAtRisk: backlog.atRisk,
  };
}

// The Resolution Rate over `rows` (the range-filtered incidents), and how
// many of its denominator are still open (metrics sheet I2). A report closed
// as invalid, duplicate or expired was never work to resolve, so it leaves
// the denominator; a report still open stays in it. `ratePct` is null when
// nothing is left to divide by — no reports in range, or every one closed
// for those reasons. A range with real reports but none yet resolved still
// returns a real 0%; only the empty-denominator case is null. Callers must
// render null as "—" (via formatRate), never as a literal 0%.
function resolutionOf(rows: IncidentRow[]): { ratePct: number | null; stillOpen: number } {
  const real = rows.filter((row) => !isClosedUnresolved(row));
  const resolved = real.filter(isResolvedIncident).length;
  return {
    ratePct: real.length === 0 ? null : round1((resolved / real.length) * 100),
    stillOpen: real.length - resolved,
  };
}

// A confirmed booking: the office accepted it and the event is going ahead
// or has taken place (Admin CONTEXT.md, "Event day"). A request still being
// reviewed, quoted or paid for is not one.
const CONFIRMED_BOOKING_STATUSES = new Set(["confirmed", "fully_paid", "completed"]);

export function isConfirmedBooking(row: BookingRow): boolean {
  return row.status !== null && CONFIRMED_BOOKING_STATUSES.has(row.status);
}

/** Event days in a range: how many days had an event, of how many. */
export interface EventDays {
  pct: number;
  days: number;
  totalDays: number;
  // "X of Y days had an event", always shown with the figure.
  note: string;
}

/**
 * Event days (metrics sheet D4 and C2): the share of calendar days in
 * `range` with at least one confirmed booking. The Dashboard and the
 * Convention Center both show it, from this one function, so they agree.
 *
 * It is not utilization: there is no venue capacity NUMBER to divide by
 * (see bookingRequestsPerVenue's doc comment above), so it counts days with an
 * event, and one small event and one full-facility event count the same.
 *
 * `rows` is the FULL fetched array: this filters by `event_date` itself.
 * A booking's `submitted_at` (when it was filed) and its `event_date` (when
 * the event happens) can land in different periods, and this figure is
 * about which days in `range` had an event on them, whatever date type the
 * rest of the page reads. Every event day it collects lies within `range`,
 * so the result is bounded to [0, 100] by construction.
 */
export function eventDays(rows: BookingRow[], range: DateRange): EventDays {
  const totalDays =
    Math.round((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000) + 1;
  if (totalDays <= 0) return { pct: 0, days: 0, totalDays: 0, note: "0 of 0 days had an event" };

  const events = filterByDateRange(rows.filter(isConfirmedBooking), (row) => row.event_date, range);
  const days = new Set(events.map((row) => row.event_date as string)).size;
  return {
    pct: round1((days / totalDays) * 100),
    days,
    totalDays,
    note: `${days} of ${totalDays} day${totalDays === 1 ? "" : "s"} had an event`,
  };
}

/**
 * KPI-tile figures for the Convention Center page, computed from `rows` the
 * page has already fetched via listBookings().
 *
 * `bookings`/`bookingsDelta` count booking requests (metrics sheet C1) by
 * the picked date type, whatever became of them; `confirmed` is how many of
 * those same requests are confirmed, fully paid or completed. `eventDays`
 * always reads event dates (see eventDays above). There is no resident or
 * outside-Lucena share: submit_booking never records where a booker is from
 * (metrics sheet C3, C4), so the page shows no such figure (#118).
 */
export function conventionRangeStats(
  rows: BookingRow[],
  range: DateRange,
  getDate: (row: BookingRow) => string | null
): ConventionRangeStats {
  const current = filterByDateRange(rows, getDate, range);
  const previous = filterByDateRange(rows, getDate, previousPeriodRange(range));

  return {
    bookings: current.length,
    confirmed: current.filter(isConfirmedBooking).length,
    bookingsDelta: percentDelta(current.length, previous.length),
    eventDays: eventDays(rows, range),
  };
}
