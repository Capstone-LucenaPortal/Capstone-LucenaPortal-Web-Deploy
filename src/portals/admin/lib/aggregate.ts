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
// unfiltered `rows` to monthlyCounts, since a multi-month trend chart fed an
// already date-narrowed array would collapse to ~1 bucket. See the comment
// at each page's monthlyCounts call site for the same rule spelled out
// in-context.
import { MANILA_TIME_ZONE } from "@/shared/dates/manila";
import { filterByDateRange } from "@/portals/admin/lib/dates";
import type { BookingRow } from "@/portals/admin/features/booking/lib/bookings";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { IncidentConfigRow, VenueRow } from "@/portals/admin/lib/supabase/catalogs";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import type { ConventionRangeStats, EventTypeSlice, VenueBooking } from "@/portals/admin/features/booking/types";
import type { BarangayIssueRow, IssueCategorySlice, IssueRangeStats } from "@/portals/admin/features/incidents/types";
import type { BarangayCoverage, YellowCardRangeStats } from "@/portals/admin/features/yellow-card/types";

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
 * Booking counts per venue, for the "Bookings by venue" panel.
 *
 * Unlike barangayCoverage, this is driven by `venues` (from listVenues()),
 * not by which codes happen to appear in `rows` — a venue with zero bookings
 * in range is still a real, nameable venue and a real signal ("nobody booked
 * this"), so it appears with `bookings: 0` rather than being silently
 * dropped. `capacityLabel` and `venue` (the display name) come from the venue
 * catalog too, since admin_booking_analytics carries only `venue_code`, never
 * a label or capacity.
 *
 * `avgFillPct` is always null: admin_booking_analytics has
 * `estimated_headcount` per booking, but no venue capacity NUMBER —
 * `booking_venues.capacity_label` is free text (e.g. "1000 classroom / 500
 * table"), not a figure to divide by. VenueUtilizationCard already renders
 * null as "no cap tracking"; inventing a percentage from parsed free text
 * would be worse than that honest gap. `chip` is likewise never set here —
 * public_booking_venues carries no promotional-badge data — but stays
 * optional on the returned shape so a future data source can populate it
 * without a prop change.
 */
export function venueUtilisation(rows: BookingRow[], venues: VenueRow[]): VenueBooking[] {
  const bookingsByVenueCode = new Map<string, number>();

  for (const row of rows) {
    if (!row.venue_code) continue;
    bookingsByVenueCode.set(row.venue_code, (bookingsByVenueCode.get(row.venue_code) ?? 0) + 1);
  }

  return venues.map((venue) => ({
    venue: venue.label ?? venue.code ?? "Unknown venue",
    capacityLabel: venue.capacity_label ?? "",
    avgFillPct: null,
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
 * Relative percent change from `previous` to `current`, formatted as a KPI
 * tile note. `previous === 0` has no percentage baseline to divide by, so it
 * reads as "New activity" (current > 0) or "No activity" (current === 0)
 * rather than an Infinity/NaN.
 */
export function percentDelta(current: number, previous: number, suffix = "vs previous period"): string {
  if (previous === 0) {
    return current === 0 ? `No activity ${suffix}` : `New activity ${suffix}`;
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}% ${suffix}`;
}

/** Absolute percentage-point change, for KPI tiles reporting a rate. */
export function pointsDelta(current: number, previous: number, suffix = "vs previous period"): string {
  const diff = round1(current - previous);
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff} pts ${suffix}`;
}

/**
 * pointsDelta, but for a possibly-null rate — decidedRatePct/resolvedRatePct
 * (and the pooled SLA compliance calcs in dashboard.ts/sla.ts) return `null`
 * when their denominator is 0, e.g. no decided applications yet in a "Today"
 * preset. With no rate on one or both sides there is no meaningful swing to
 * report — this reads "No comparable data" rather than coercing null to 0
 * and reporting a fabricated (and often huge) delta.
 */
function ratePointsDelta(current: number | null, previous: number | null, suffix = "vs previous period"): string {
  if (current === null || previous === null) return `No comparable data ${suffix}`;
  return pointsDelta(current, previous, suffix);
}

/**
 * Renders a possibly-null rate (decidedRatePct/resolvedRatePct, or the
 * pooled SLA compliance figures in dashboard.ts/sla.ts) for on-screen
 * display: "—" when there is no denominator to compute a rate from, the
 * rounded percentage otherwise. Every KPI tile that shows a rate must go
 * through this rather than `${value}%` or `value ?? 0`, so a genuine
 * "no data yet" period (a quiet Sunday, an empty "Today" preset) can never
 * be misread as "0% compliance" — the false signal this task exists to fix.
 */
export function formatRate(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

/** Absolute integer change, for KPI tiles reporting a small count (e.g. SLA
 * violations) where a percentage swing would be noisy or undefined at 0. */
export function countDelta(current: number, previous: number, suffix = "vs previous period"): string {
  const diff = current - previous;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff} ${suffix}`;
}

/** Change in a days figure (e.g. average response time), phrased as
 * faster/slower rather than signed, since "-0.2 pts" reads oddly for a
 * duration. */
export function daysDelta(current: number, previous: number): string {
  const diff = round1(current - previous);
  if (diff === 0) return "No change vs previous period";
  const direction = diff < 0 ? "faster" : "slower";
  return `${Math.abs(diff)}d ${direction} vs previous period`;
}

/**
 * Average number of days between `submitted_at` and `resolved_at` for
 * incidents that have both, over `rows` as given (the caller decides whether
 * that is date-filtered or not). Incidents with no resolution yet, or a
 * malformed timestamp, are excluded from the average rather than counted as
 * zero days — an unresolved incident has no response time to report.
 * Incidents only: Yellow Card's clock pauses while an application sits in
 * revision_requested (see getSlaTrend's doc comment in src/portals/admin/features/sla/lib/sla.ts), so
 * folding its duration in here would not be a faithful reading of either
 * clock.
 */
export function averageResolutionDays(rows: IncidentRow[]): number {
  const durations = rows
    .filter((row) => row.resolved_at && row.submitted_at)
    .map(
      (row) =>
        (new Date(row.resolved_at as string).getTime() - new Date(row.submitted_at as string).getTime()) /
        86_400_000
    )
    .filter((days) => Number.isFinite(days) && days >= 0);

  if (durations.length === 0) return 0;
  return round1(durations.reduce((sum, days) => sum + days, 0) / durations.length);
}

// Applications still in flight, per admin_yellow_card_analytics.status —
// "withdrawn" is terminal (see barangayCoverage's doc comment above) and is
// deliberately excluded, same as there.
const YELLOW_CARD_PENDING_STATUSES = new Set(["pending", "resubmitted", "revision_requested"]);

/**
 * KPI-tile figures for the Yellow Card page, computed from `rows` the page
 * has already fetched via listApplications().
 *
 * `applications`/`approvalRatePct` and their deltas describe `range` (via
 * `getDate`, so the caller controls whether that's submitted_at or
 * decided_at — the page's "application"/"completion" date-basis toggle).
 * `pendingReview`/`pendingPastSla` intentionally read ALL of `rows`, not the
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

  const pendingRows = rows.filter((row) => row.status !== null && YELLOW_CARD_PENDING_STATUSES.has(row.status));

  return {
    applications: current.length,
    applicationsDelta: percentDelta(current.length, previous.length),
    approvalRatePct,
    approvalRateDelta: ratePointsDelta(approvalRatePct, previousApprovalRatePct),
    barangaysReached,
    barangaysTotal,
    barangaysWithZero: barangaysTotal === null ? null : Math.max(0, barangaysTotal - barangaysReached),
    pendingReview: pendingRows.length,
    // sla_breached is only meaningful for DECIDED applications (see
    // applicationMet's doc comment in src/portals/admin/features/sla/lib/sla.ts) — the counter behind
    // it only accrues on status change, so a pending row's sla_breached
    // reads false no matter how long it has actually been sitting. Counting
    // `row.sla_breached === true` here would therefore always undercount
    // (structurally, toward 0), which is worse than admitting there is no
    // honest number to show: there is no due_at/armed-clock column yet to
    // compute a real one from, so this stays null ("unavailable") until
    // Phase 6 lands.
    pendingPastSla: null,
    // Computed even though pendingPastSla above is unconditionally null: the
    // Yellow Card page's Pending Review caption checks pendingPastSla first
    // and always short-circuits to "unavailable" before it would ever read
    // this value (see the ternary in src/app/(admin)/admin/(shell)/yellow-card/page.tsx), so
    // this currently has no effect on anything rendered. Kept, not deleted
    // — a Phase 6 rewrite that gives pendingPastSla a real non-null value
    // will want this target-hours figure back immediately, and it costs
    // nothing to keep it computed and correct in the meantime (Admin Portal
    // Fix Plan, Phase 1 final review, finding 4).
    pendingSlaTargetHours: sharedSlaTargetHours(pendingRows),
  };
}

/**
 * The SLA target, in hours, that ALL of `rows` share — or null if they do not
 * share one (or there are no rows).
 *
 * The Pending Review tile's caption used to hardcode "past 48h SLA". That
 * figure is really `public_yellow_card_config.processing_time_target_days`
 * (2 days) rendered in hours, and Super Staff can change it through
 * `save_yellow_card_config` — at which point the hardcoded caption would keep
 * claiming 48h while the count beneath it was computed against the new
 * target. `admin_yellow_card_analytics` already carries the applicable target
 * on every row as `sla_target_hours`, so the caption reads it from there.
 *
 * A row keeps the target it was created under, so after a config change a
 * backlog can legitimately hold applications on two different clocks. There
 * is then no single honest number to put in the caption, so this returns null
 * and the caller drops the figure rather than picking one of the two and
 * misdescribing the other.
 */
function sharedSlaTargetHours(rows: YellowCardRow[]): number | null {
  let shared: number | null = null;

  for (const row of rows) {
    if (typeof row.sla_target_hours !== "number") return null;
    if (shared === null) shared = row.sla_target_hours;
    else if (shared !== row.sla_target_hours) return null;
  }

  return shared;
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

// Still-open incidents, per admin_incident_analytics.status.
const INCIDENT_OPEN_STATUSES = new Set(["open", "in_pool", "in_progress"]);
const INCIDENT_RESOLVED_STATUSES = new Set(["resolved", "closed"]);

export type IncidentLevel = NonNullable<IncidentRow["incident_level"]>;

/**
 * Response-time targets in hours, keyed by `incident_level`. A level may be
 * absent (see incidentSlaHours below) — absent means "no target on record",
 * never "zero hours".
 */
export type IncidentSlaHours = Partial<Record<IncidentLevel, number>>;

/**
 * Reshapes a `public_incident_config` row into a per-level lookup.
 *
 * The city sets a DIFFERENT response target for each severity — on this
 * deployment critical/high/medium/low are 4/8/24/72 hours — and Super Staff
 * can change any of them through `save_incident_config`. An earlier version
 * of issueRangeStats measured every incident against one hardcoded 72-hour
 * threshold, which is the LOW-priority figure: a critical incident open for
 * ten hours was already 2.5x past its real 4-hour target and still counted as
 * on time. There is no `sla_due_at` on `admin_incident_analytics` to read
 * instead (unlike `responder_incidents`), so the target has to be looked up
 * per level from this config.
 *
 * A null config row yields null, not an all-zero map: "we could not read the
 * targets" and "every target is zero hours" are opposite claims, and only one
 * of them is honest when the fetch fails. A level whose column is null is
 * omitted for the same reason.
 */
export function incidentSlaHours(config: IncidentConfigRow | null): IncidentSlaHours | null {
  if (!config) return null;

  const byLevel: [IncidentLevel, number | null][] = [
    ["critical", config.sla_hours_critical],
    ["high", config.sla_hours_high],
    ["medium", config.sla_hours_medium],
    ["low", config.sla_hours_low],
  ];

  const hours: IncidentSlaHours = {};
  for (const [level, value] of byLevel) {
    if (typeof value === "number") hours[level] = value;
  }
  return hours;
}

/**
 * KPI-tile figures for the Incident Reports page, computed from `rows` the
 * page has already fetched via listIncidents(). Mirrors yellowCardRangeStats
 * above: `reports`/`resolutionRatePct`/`avgResponseDays` describe `range`
 * (via `getDate`), while `openBacklog`/`backlogPastSla` read ALL of `rows`,
 * since an open backlog is a point-in-time queue, not a per-period count.
 *
 * `slaHours` carries the city's per-level response targets, from
 * `public_incident_config` via incidentSlaHours above. It is still a
 * required parameter — kept for signature stability and because a future
 * Phase 6-backed rewrite of `backlogPastSla` may want it again — but as of
 * Task 1.3 it is NOT read by `backlogPastSla`, which is unconditionally
 * null regardless of what is passed here (see its own doc comment below for
 * why).
 *
 * `now` similarly defaults to the real current time and is accepted so a
 * future wall-clock-dependent computation stays testable (mirroring
 * presetDateRange's own `now` parameter in src/portals/admin/lib/dates.ts), but nothing in
 * this function currently reads it either, for the same reason.
 */
export function issueRangeStats(
  rows: IncidentRow[],
  range: DateRange,
  getDate: (row: IncidentRow) => string | null,
  slaHours: IncidentSlaHours | null,
  now: Date = new Date()
): IssueRangeStats {
  const current = filterByDateRange(rows, getDate, range);
  const previous = filterByDateRange(rows, getDate, previousPeriodRange(range));

  const resolutionRatePct = resolvedRatePct(current);
  const previousResolutionRatePct = resolvedRatePct(previous);

  const avgResponseDays = averageResolutionDays(current);
  const previousAvgResponseDays = averageResolutionDays(previous);

  const openRows = rows.filter((row) => row.status !== null && INCIDENT_OPEN_STATUSES.has(row.status));

  // ⚠️ KNOWN DEFECT (Admin Portal Fix Plan, Task 1.3) — backlogPastSla is
  // UNCONDITIONALLY null below. It used to compute
  // `ageHours = now - submitted_at` per open row and compare that against
  // slaHours[row.incident_level] — i.e. today's LIVE public_incident_config
  // target, not the target that applied when the row was created. That was
  // wrong on three counts:
  //   1. An incident's SLA clock only "arms" once BOTH routing and photo
  //      verification complete (`sla_armed_at = max(routed_at, verified_at)`,
  //      l12b_incident_triggers.sql's inc_arm_sla()) — an unverified report
  //      never armed at all, yet the old math counted it as breached purely
  //      because it looked old, charging citizen/queue delay as if it were
  //      department lateness.
  //   2. Routing delay (l20's route_incident assigns the department; before
  //      that an incident isn't even this department's clock to keep) got
  //      folded into the same elapsed-time figure and blamed on the
  //      department that eventually received it.
  //   3. `sla_target_hours` is stamped once, at arming, specifically so a
  //      later `save_incident_config` edit does not retroactively rewrite
  //      history (l57's lifecycle sweeper relies on this snapshot too) — but
  //      comparing against `slaHours` (today's config) re-judged old open
  //      incidents against a target Super Staff may have since changed.
  //
  // This is the exact same underlying data gap Task 1.2 hit and documented
  // in incidentMet's "KNOWN LIMITATION" comment in src/portals/admin/features/sla/lib/sla.ts:
  // admin_incident_analytics does not expose `sla_due_at`, `sla_armed_at`,
  // or `is_verified`/`verified_at` — only a real Phase 6 migration adding
  // those columns unblocks a correct `sla_due_at < now()` computation here.
  // That comment also already rejected approximating a due date from
  // `submitted_at`/`routed_at` + config as "materially wrong for the
  // critical/high tiers" — the same trick this function used to lean on.
  // See src/portals/admin/features/sla/lib/sla.ts's incidentMet doc comment for the fuller
  // DB-trigger-level explanation; it is not re-derived here.
  //
  // Until that migration lands, there is no honest per-row breach signal to
  // read, so this KPI reports as unavailable (null) rather than a number
  // that structurally miscounts unverified/newly-routed incidents as
  // breached. See IssueRangeStats.backlogPastSla in src/portals/admin/lib/types.ts and its
  // callers (src/app/(admin)/admin/(shell)/issue-reports/page.tsx,
  // src/app/(admin)/admin/(shell)/dashboard/page.tsx) for how "null" renders.
  const backlogPastSla: number | null = null;

  return {
    reports: current.length,
    reportsDelta: percentDelta(current.length, previous.length),
    resolutionRatePct,
    resolutionRateDelta: ratePointsDelta(resolutionRatePct, previousResolutionRatePct),
    avgResponseDays,
    avgResponseDelta: daysDelta(avgResponseDays, previousAvgResponseDays),
    openBacklog: openRows.length,
    backlogPastSla,
  };
}

// null when `rows` (the range-filtered incidents) is empty — no incidents
// filed in range at all, so there is no resolution rate to report. A range
// with incidents but none yet resolved still returns a real 0%, which is an
// honest reading of that case; only the empty-denominator case is null.
// Callers must render null as "—" (via formatRate), never as a literal 0%.
function resolvedRatePct(rows: IncidentRow[]): number | null {
  if (rows.length === 0) return null;
  const resolved = rows.filter((row) => row.status !== null && INCIDENT_RESOLVED_STATUSES.has(row.status)).length;
  return round1((resolved / rows.length) * 100);
}

/**
 * KPI-tile figures for the Convention Center page, computed from `rows` the
 * page has already fetched via listBookings().
 *
 * Only `bookings`/`bookingsDelta` are derivable from real data: utilization
 * needs a venue capacity NUMBER (booking_venues.capacity_label is free text,
 * not a figure to divide by — see venueUtilisation's doc comment above), and
 * resident/outside share needs is_resident, which submit_booking never
 * writes origin data for (the generated column is always false, not null —
 * see the Resident Share KPI tile's own gap notice on the page). Those three
 * tiles render a literal "Not tracked" on the page
 * itself, so this returns nothing for them: it used to emit six fields fixed
 * at 0/"Not tracked" that no caller ever read, which invited a future reader
 * to wire a tile to a placeholder zero and believe it.
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
    bookingsDelta: percentDelta(current.length, previous.length),
  };
}
