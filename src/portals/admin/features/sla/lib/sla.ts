import { MANILA_TIME_ZONE } from "@/shared/dates/manila";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import type { DepartmentRow } from "@/portals/admin/lib/supabase/catalogs";
import { averageResolutionDays, countDelta, daysDelta, percentDelta, previousPeriodRange } from "@/portals/admin/lib/aggregate";
// formatManilaRangeLabel used to be a private formatRangeLabel in this file;
// it moved to src/portals/admin/lib/dates.ts so the three analytics pages' panel subtitles
// share the one implementation. See its doc comment there.
import { filterByDateRange, formatManilaRangeLabel } from "@/portals/admin/lib/dates";
import type { SlaDateBasis, SlaDepartmentRow, SlaDepartmentStatus, SlaRangeStats, SlaTrendPoint, SlaTrendRow } from "@/portals/admin/features/sla/types";

export type DateRange = { from: string; to: string } | null;

// Yellow Card has no assigned_department_code of its own — it is not one of
// the incident-routing departments in public_departments — so it cannot be
// joined to a catalog label the way incident rows are. It still belongs on
// an SLA-by-department report, so it is folded in as one extra synthetic row
// under this literal label rather than silently dropped.
const YELLOW_CARD_DEPARTMENT_LABEL = "Yellow Card";

/**
 * The city's published SLA compliance target — matches the capstone
 * description's stated figure ("SLA Compliance Rate: Maintain ≥ 85%
 * compliance across all service modules") — and the compliance-status bands
 * the department table's Status column applies to a live-derived
 * compliancePct. SLA_NEEDS_ATTENTION_PCT is exported separately (not just
 * inlined into departmentStatus below) because the Dashboard's needs-
 * attention alerts key off the same "Needs attention" boundary when deciding
 * which departments to surface — see src/portals/admin/features/dashboard/components/dashboard-page.tsx.
 *
 * The intermediate bands (75/65) are a controller ruling (Admin Portal Fix
 * Plan, final review, Fix 3), not a straight linear rescale of the pre-Task
 * 5.2 95/93/80 bands down to the new 85% target. Task 5.2 dropped
 * SLA_TARGET_PCT from 95 to 85 (correct — that's the capstone-mandated
 * figure) and, in the same change, rescaled the intermediate bands to
 * 85/70/50 — the plan's own throwaway "e.g. 85/70/50" example, taken
 * verbatim. That compounded into a real, undecided behavior change: the
 * "Needs attention" alert threshold moved from 15 points below target (95 -
 * 80 = 15) to 35 points below target (85 - 50 = 35), so a department at, say,
 * 55% compliance — which WOULD have tripped the old alert — now renders as
 * plain "Below target" with no Dashboard alert at all. 75/65 keeps the
 * mandated 85% target but restores roughly the OLD alerting sensitivity: a
 * department now has to fall 20 points below target (85 - 65 = 20, close to
 * the original ~15) to be flagged "Needs attention," so a meaningfully
 * underperforming department still surfaces on the Mayor's dashboard instead
 * of going silent purely because the target itself moved.
 */
export const SLA_TARGET_PCT = 85;
const SLA_NEAR_TARGET_PCT = 75;
export const SLA_NEEDS_ATTENTION_PCT = 65;

export function departmentStatus(compliancePct: number): SlaDepartmentStatus {
  if (compliancePct >= SLA_TARGET_PCT) return "Meeting target";
  if (compliancePct >= SLA_NEAR_TARGET_PCT) return "Near target";
  if (compliancePct >= SLA_NEEDS_ATTENTION_PCT) return "Below target";
  return "Needs attention";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Closure reasons that end an incident's lifecycle WITHOUT it ever having a
// fair shot at the SLA clock: `invalid`/`duplicate` are staff judgment calls
// that the report itself doesn't belong in the queue (made at any point in
// the pipeline — see l57_incident_lifecycle_sweeper.sql/route_incident, a
// report can be marked either before or after it was ever routed or
// verified), and `expired_unverified` is the sweep (l57, PASS 3) that
// auto-closes a report nobody ever confirmed with a photo, i.e. one that
// could never have armed. admin_incident_analytics.sla_met reads `false` for
// all three the same as it does for an honest breach; incidentMet treats
// them as excluded, not violations.
type IncidentClosureReason = NonNullable<IncidentRow["closure_reason"]>;
const NON_SCOREABLE_CLOSURE_REASONS = new Set<IncidentClosureReason>([
  "invalid",
  "duplicate",
  "expired_unverified",
]);

/**
 * admin_incident_analytics.sla_met is defined (view source, Sandbox
 * zqsqenfoszgcunvpqvvg, l42_admin_analytics_widen.sql) as:
 *
 *   resolved_at IS NOT NULL AND sla_due_at IS NOT NULL AND resolved_at <= sla_due_at
 *
 * — `false`, never SQL null, for ANY row that is not both resolved AND
 * armed. A bare `row.sla_met === true` check therefore put three very
 * different kinds of row on the "violation" side of the ratio: a genuine
 * late resolution, an incident that is still open (the SLA clock only
 * "arms" once BOTH routing and photo verification complete —
 * `sla_armed_at = max(routed_at, verified_at)`, l12b_incident_triggers.sql's
 * inc_arm_sla()), and one closed via a NON_SCOREABLE_CLOSURE_REASONS reason,
 * which never had a fair chance to be scored at all. Only the first of
 * those three is an actual SLA violation — that was the bug (Admin Portal
 * Fix Plan, Task 1.2).
 *
 * The DB's own super_metrics view (l60_super_metrics.sql, read by the Super
 * Staff Monitoring screen) draws this line correctly: it counts an incident
 * toward compliance only when `resolved_at` falls in the window AND
 * `sla_due_at IS NOT NULL` — i.e. only a RESOLVED, ARMED incident is
 * scoreable; a still-open incident, however overdue, is not counted there
 * either. incidentMet mirrors that same "resolved + armed" gate for
 * incidents, and adds one exclusion super_metrics does not need: a row
 * closed via a reason in NON_SCOREABLE_CLOSURE_REASONS is excluded even
 * when it happens to carry a resolved_at, because that closure reason means
 * the report itself was never a legitimate SLA case.
 *
 * ⚠️ KNOWN LIMITATION — admin_incident_analytics does NOT expose
 * `sla_due_at`, `sla_armed_at`, or `verified_at` as columns (confirmed
 * against l42_admin_analytics_widen.sql's view source and the live schema);
 * only the pre-computed `sla_met` boolean is readable from here. The Admin
 * Portal Fix Plan's Task 1.2 brief asks for a THIRD outcome beyond
 * super_metrics' own rule — an open-and-overdue incident counted as a live
 * breach, not merely excluded — but that requires comparing `now()` against
 * a due date this view does not carry, and a still-open incident cannot be
 * told apart from a still-open, NEVER-ARMED one without it either: both
 * read `status in (open, in_pool, in_progress)` and `resolved_at = null`.
 * Approximating a due date from `routed_at` + the per-level target hours in
 * `incident_config` (the same trick issueRangeStats' backlogPastSla USED TO
 * lean on in src/portals/admin/lib/aggregate.ts, for a different, point-in-time-only KPI
 * — Admin Portal Fix Plan Task 1.3 later rejected it there too, for this
 * identical reason, and replaced it with an unconditional null; see
 * backlogPastSla's own doc comment) was considered and rejected here: it
 * would risk exactly the bug this
 * function exists to fix, just moved one step over — flagging a report that
 * is routed but still genuinely unverified (and so has never armed at all)
 * as a "live breach" purely because it looks old, which is materially wrong
 * for the critical/high tiers (4h/8h targets, far shorter than the ~3-day
 * expired_unverified sweep window that would eventually exclude it anyway).
 * Until the view exposes a real due date, an open incident of any age is
 * treated as not-yet-scoreable — the same choice super_metrics already
 * makes — so this keeps Admin's incident compliance figure verifiably
 * correct rather than merely closer to the brief's letter.
 *
 * Returns `true` (met), `false` (breached — resolved late), or `null`
 * (not-yet-scoreable: still open, or closed for a reason in
 * NON_SCOREABLE_CLOSURE_REASONS). Every caller must exclude `null` from
 * both the numerator and denominator of any compliance ratio it computes —
 * the same contract applicationMet already establishes for Yellow Card
 * applications, just below.
 */
export function incidentMet(row: IncidentRow): boolean | null {
  if (row.closure_reason !== null && NON_SCOREABLE_CLOSURE_REASONS.has(row.closure_reason)) return null;
  if (row.resolved_at === null) return null;
  return row.sla_met === true;
}

// The only statuses admin_yellow_card_analytics.decided_at is ever set for —
// the point past which sla_elapsed_seconds stops accruing and sla_breached
// stops changing. Kept in sync with YELLOW_CARD_PENDING_STATUSES in
// aggregate.ts and YELLOW_CARD_BACKLOG_STATUSES in dashboard.ts, which each
// name the complementary (non-terminal) set for their own point-in-time
// backlog reads.
const YELLOW_CARD_TERMINAL_STATUSES = new Set(["approved", "rejected", "withdrawn"]);

/**
 * admin_yellow_card_analytics.sla_breached is defined as
 * `sla_elapsed_seconds > sla_target_hours * 3600`, but sla_elapsed_seconds is
 * a counter that only accrues ON STATUS CHANGE (l12a_yellow_card_triggers.sql)
 * — not a live clock. For a still-pending/resubmitted/revision_requested
 * application, sla_breached therefore reads false no matter how long the
 * application has actually been sitting, right up until it is finally
 * decided. Treating that false as "met" (the bug this replaced) silently
 * scores every undecided application as SLA-compliant; treating it as "not
 * met" would be just as wrong in the other direction, flagging a
 * five-minute-old application as a violation. Neither reading is honest, so
 * a non-terminal row's SLA status is genuinely unknown until the DB exposes
 * a real due-date/armed-clock (tracked for Phase 6) — this returns `null`
 * for those rows rather than guessing, and callers must exclude `null` from
 * both the numerator and denominator of any compliance ratio they compute.
 * Only for a DECIDED row (approved/rejected/withdrawn, per
 * YELLOW_CARD_TERMINAL_STATUSES) does sla_breached mean what it says.
 */
export function applicationMet(row: YellowCardRow): boolean | null {
  if (row.status === null || !YELLOW_CARD_TERMINAL_STATUSES.has(row.status)) return null;
  return !row.sla_breached;
}

/**
 * Which timestamp column "Request Date" vs "Resolution Date" means for each
 * row shape — the SLA Reports page's "Date type" toggle. "request" reads
 * submitted_at (when the request was filed); "resolution" reads resolved_at
 * for incidents / decided_at for Yellow Card applications (when staff closed
 * it out) — the same request/resolution split the other converted pages
 * apply to their own date-basis toggles (see e.g. issueDateAccessor in
 * src/portals/admin/lib/aggregate.ts). A row not yet resolved has a
 * null value under "resolution" and is dropped by filterByDateRange, the
 * same way any other null-accessor row is.
 */
function incidentDateAccessor(basis: SlaDateBasis): (row: IncidentRow) => string | null {
  return basis === "resolution" ? (row) => row.resolved_at : (row) => row.submitted_at;
}

function applicationDateAccessor(basis: SlaDateBasis): (row: YellowCardRow) => string | null {
  return basis === "resolution" ? (row) => row.decided_at : (row) => row.submitted_at;
}

/**
 * SLA compliance grouped by department, for the "By department" table.
 *
 * `incidents`/`applications`/`departments` are rows the CALLER has already
 * fetched (via listIncidents()/listApplications()/listDepartments()) — this
 * function does no I/O of its own. It used to call all three itself, which
 * meant the Dashboard and SLA Reports pages each re-fetched the same three
 * tables again on top of their own already-fetched copies (Admin Portal Fix
 * Plan, Task 4.2) — up to three separate full reads of admin_incident_
 * analytics per page load. Every page must now fetch each table exactly
 * once and pass the SAME arrays into this function and its siblings below
 * (getSlaTrend/getSlaMonthlyHistory/getSlaRangeStats), matching the
 * pre-fetched-rows convention src/portals/admin/lib/aggregate.ts and
 * src/portals/admin/features/dashboard/lib/dashboard.ts already use for their own pure, synchronous transforms.
 *
 * Incident rows are grouped by assigned_department_code and joined to their
 * human label via `departments`; a row with no department assigned yet
 * cannot be attributed to any department's figure, so it is excluded from
 * every group rather than invented into an "Unassigned" bucket. Yellow Card
 * applications carry no department code at all, so they are folded in as one
 * additional synthetic "Yellow Card" row.
 *
 * A department (real or synthetic) with zero rows in range is omitted
 * entirely, not shown at 0% — a department that received no reports this
 * period has no compliance figure to report, and 0% would read as total
 * failure instead of "no data." This now also covers "zero SCOREABLE rows":
 * an incident group where every row is still open or closed via a
 * NON_SCOREABLE_CLOSURE_REASONS reason (see incidentMet's doc comment) is
 * dropped the same way an empty group would be, rather than shown at 0%.
 *
 * `totalInRange` is each row's full group size (incident count for a real
 * department, `filteredApplications.length` for the synthetic Yellow Card
 * row) BEFORE the scoreable-only filter `requests` applies — the per-row
 * twin of SlaRangeStats.totalInRange, so the table can caption "X of Y
 * scoreable" instead of showing `requests` with no explanation for why it
 * disagrees with a raw count shown elsewhere (Admin Portal Fix Plan, Phase 1
 * final review, finding 3). A row is only pushed once `requests` (scoreable)
 * is confirmed non-zero, so `totalInRange` is always >= 1 and >= `requests`.
 */
export function getSlaByDepartment(
  incidents: IncidentRow[],
  applications: YellowCardRow[],
  departments: DepartmentRow[],
  range: DateRange,
  dateBasis: SlaDateBasis = "request"
): SlaDepartmentRow[] {
  const departmentLabel = new Map(departments.map((dept) => [dept.code, dept.label]));

  const filteredIncidents = filterByDateRange(incidents, incidentDateAccessor(dateBasis), range);
  const filteredApplications = filterByDateRange(applications, applicationDateAccessor(dateBasis), range);

  const groups = new Map<string, IncidentRow[]>();
  for (const row of filteredIncidents) {
    const code = row.assigned_department_code;
    if (!code) continue;
    const existing = groups.get(code);
    if (existing) existing.push(row);
    else groups.set(code, [row]);
  }

  const rows: SlaDepartmentRow[] = [];
  for (const [code, group] of groups) {
    // Only rows incidentMet can actually score (resolved, and not closed via
    // a NON_SCOREABLE_CLOSURE_REASONS reason — see its own doc comment) count
    // toward this department's requests/compliancePct; a still-open or
    // non-scoreable incident is excluded from both, not folded in as unmet,
    // the same "zero scoreable rows is omitted, not shown at 0%" convention
    // the Yellow Card row below already applies.
    const scoreable = group.filter((row) => incidentMet(row) !== null);
    if (scoreable.length === 0) continue;
    const met = scoreable.filter((row) => incidentMet(row) === true).length;
    rows.push({
      department: departmentLabel.get(code) ?? code,
      requests: scoreable.length,
      compliancePct: round1((met / scoreable.length) * 100),
      totalInRange: group.length,
    });
  }

  // Only DECIDED applications have a scoreable applicationMet (see its own
  // doc comment) — a pending one is excluded from both requests and
  // compliancePct's denominator here, not counted as met or unmet, the same
  // "zero rows in range is omitted, not shown at 0%" convention this
  // function already applies per-department above, extended to "zero
  // decided rows".
  const decidedApplications = filteredApplications.filter((row) => applicationMet(row) !== null);
  if (decidedApplications.length > 0) {
    const met = decidedApplications.filter((row) => applicationMet(row) === true).length;
    rows.push({
      department: YELLOW_CARD_DEPARTMENT_LABEL,
      requests: decidedApplications.length,
      compliancePct: round1((met / decidedApplications.length) * 100),
      totalInRange: filteredApplications.length,
    });
  }

  // Highest compliance first, matching the mock table's existing display order.
  rows.sort((a, b) => b.compliancePct - a.compliancePct);
  return rows;
}

// This is a Philippines deployment (UTC+8, no DST) — the same reason
// src/portals/admin/lib/dates.ts anchors "today" to Asia/Manila rather than the host/session
// timezone. Bucketing the trend by a UTC or browser-local month would shift
// records filed in the first eight hours of a Manila day into the wrong
// month at every month boundary.
// en-CA formats as YYYY-MM-DD; slicing to 7 chars gives YYYY-MM, a key that
// also sorts chronologically as a plain string, so buckets need no separate
// numeric sort key.
const monthKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "short",
});

function monthKey(date: Date): string {
  return monthKeyFormatter.format(date).slice(0, 7);
}

interface TrendBucket {
  label: string;
  // `total`/`met` only count SCOREABLE incidents (incidentMet(row) !== null)
  // — the same numerator/denominator exclusion getSlaByDepartment/
  // getSlaRangeStats apply, so a bucket where every incident is still open
  // or closed via a NON_SCOREABLE_CLOSURE_REASONS reason reads total: 0, not
  // a false 0%.
  total: number;
  met: number;
  // The incident rows themselves, kept per bucket UNFILTERED (every incident
  // in the bucket, not just the scoreable ones) so getSlaMonthlyHistory can
  // compute avgResponseDays per month via averageResolutionDays — which
  // self-filters on resolved_at/submitted_at and is a duration metric, not a
  // compliance ratio — without a second pass over listIncidents(). getSlaTrend
  // ignores this field entirely.
  rows: IncidentRow[];
}

/**
 * Buckets incidents by Manila-calendar month for `range` under `dateBasis`
 * — **incidents only**. Do not fold Yellow Card applications into this
 * series.
 *
 * The two SLA clocks are not comparable, by explicit DB design, not
 * oversight: `yc_on_status_change()`'s own migration comment (Sandbox
 * zqsqenfoszgcunvpqvvg) says it outright —
 *
 *   "YC-12: the clock PAUSES while the ball is with the citizen. Contrast
 *   Incidents, which keep running through Release... These two rules look
 *   inconsistent. They are deliberate. Do not unify them."
 *
 * Yellow Card's sla_elapsed_seconds stops accumulating while an application
 * sits in revision_requested (the citizen's court); an incident's SLA clock
 * runs continuously regardless of who is holding it. Averaging the two
 * regimes' met/unmet counts into one compliancePct would produce a number
 * that is not a faithful reading of either clock and would drift in ways
 * nobody could explain from either source alone — worse than leaving Yellow
 * Card off this series. If Yellow Card gets its own trend, it belongs on a
 * separate series, not blended in here.
 *
 * Buckets are keyed so they sort oldest-first regardless of insertion order
 * — the order both getSlaTrend's chart and getSlaMonthlyHistory's table
 * depend on. A row whose date-basis accessor returns null (or one
 * filterByDateRange would already have dropped) cannot be placed in any
 * bucket and is skipped.
 *
 * Shared by getSlaTrend and getSlaMonthlyHistory so the bucketing logic
 * exists in exactly one place; each caller maps the same buckets down to its
 * own return shape. `incidents` is the caller's already-fetched
 * listIncidents() array — this function (like getSlaByDepartment above) does
 * no fetching of its own; see getSlaByDepartment's doc comment for why.
 */
function computeTrendBuckets(incidents: IncidentRow[], range: DateRange, dateBasis: SlaDateBasis): TrendBucket[] {
  const getDate = incidentDateAccessor(dateBasis);

  const filteredIncidents = filterByDateRange(incidents, getDate, range);

  const buckets = new Map<string, TrendBucket>();

  for (const row of filteredIncidents) {
    const dateValue = getDate(row);
    if (!dateValue) continue;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) continue;

    const key = monthKey(date);
    const met = incidentMet(row);
    const existing = buckets.get(key);
    if (existing) {
      existing.rows.push(row);
      if (met !== null) {
        existing.total += 1;
        if (met) existing.met += 1;
      }
    } else {
      buckets.set(key, {
        label: monthLabelFormatter.format(date),
        total: met === null ? 0 : 1,
        met: met === true ? 1 : 0,
        rows: [row],
      });
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, bucket]) => bucket);
}

/**
 * Monthly SLA compliance trend for the Compliance trend chart. See
 * computeTrendBuckets for the incidents-only rule, its scoreable-only
 * total/met counts, and the Manila-month bucketing this wraps.
 *
 * `compliancePct` is null, not 0, when a bucket has zero SCOREABLE incidents
 * — e.g. a month whose incidents are all still open. Before Task 1.2, a
 * bucket's `total` counted every incident, so it could only be 0 for a
 * genuinely empty month; after Task 1.2 narrowed `total` to scoreable rows
 * only, a month full of still-open incidents also reads `total: 0`, and a
 * bare `: 0` fallback here would silently render "0% compliance" — reading
 * as "everyone violated SLA this month" when the true answer is "nothing
 * was scoreable yet" (Admin Portal Fix Plan, Phase 1 final review, finding
 * 1). Every consumer must render via formatRate (src/portals/admin/lib/aggregate.ts) and
 * exclude null points from any cross-point aggregate (an average, a "best
 * month") rather than treating null as 0.
 */
export function getSlaTrend(
  incidents: IncidentRow[],
  range: DateRange,
  dateBasis: SlaDateBasis = "request"
): SlaTrendPoint[] {
  const buckets = computeTrendBuckets(incidents, range, dateBasis);
  return buckets.map((bucket) => ({
    label: bucket.label,
    compliancePct: bucket.total > 0 ? round1((bucket.met / bucket.total) * 100) : null,
    violations: bucket.total - bucket.met,
  }));
}

/**
 * Per-month breakdown for the "Monthly compliance history" table —
 * `getSlaTrend`'s same buckets, with the total/on-time counts and a
 * per-bucket average response time that `getSlaTrend`'s own SlaTrendPoint
 * shape has no room for. Same incidents-only rule (see computeTrendBuckets).
 *
 * `avgResponseDays` is computed per bucket via averageResolutionDays over
 * just that bucket's rows — a month with no resolved incidents in it reads
 * 0d, the same "no data" convention averageResolutionDays already uses
 * range-wide in getSlaRangeStats.
 *
 * Range-bounded like every other converted panel in this portal: under a
 * narrow preset (Today/Week) this collapses to at most one row, which is
 * correct — there is only one month's worth of data to show for a
 * day-or-week window — rather than always padding out to a fixed twelve
 * months the way the old hardcoded mock table did regardless of the
 * selected range.
 */
export function getSlaMonthlyHistory(
  incidents: IncidentRow[],
  range: DateRange,
  dateBasis: SlaDateBasis = "request"
): SlaTrendRow[] {
  const buckets = computeTrendBuckets(incidents, range, dateBasis);
  return buckets.map((bucket) => ({
    label: bucket.label,
    // null, not 0, for a month with zero scoreable incidents — see
    // getSlaTrend's doc comment above (same buckets, same rule).
    compliancePct: bucket.total > 0 ? round1((bucket.met / bucket.total) * 100) : null,
    violations: bucket.total - bucket.met,
    totalRequests: bucket.total,
    onTime: bucket.met,
    avgResponseDays: averageResolutionDays(bucket.rows),
  }));
}

/**
 * KPI-tile figures for the SLA Reports page's hero tiles — the citywide
 * total across both incidents and Yellow Card applications, unlike
 * getSlaByDepartment's per-department rows above.
 *
 * `incidents`/`applications` are the caller's already-fetched
 * listIncidents()/listApplications() arrays, the same convention every other
 * function in this file follows as of Task 4.2 (see getSlaByDepartment's doc
 * comment) — this does no fetching of its own.
 *
 * `responses`/`violations`/`compliancePct` pool incidents and Yellow Card
 * applications into one count, the same thing getSlaByDepartment already
 * does per-department (see its own doc comment) — a citywide total request
 * count is a legitimate top-line figure to sum across services.
 *
 * `avgResponseDays` is incidents-only, not pooled: it is a TIME duration,
 * and the two SLA clocks are not comparable (see getSlaTrend's doc comment
 * above) — averaging a paused-while-with-citizen clock together with a
 * continuously-running one would not be a faithful reading of either.
 *
 * `trend` reuses getSlaTrend(incidents, range, dateBasis) directly rather
 * than re-deriving it, so the CSV export (which reads `stats.trend`) and the
 * chart (which reads the page's separately-computed trend state, over the
 * SAME fetched `incidents` array) always agree.
 *
 * `responses`/`violations`/`compliancePct` only pool SCOREABLE rows on both
 * sides: DECIDED Yellow Card applications (see applicationMet's doc
 * comment) and RESOLVED, non-excluded incidents (see incidentMet's doc
 * comment) — a pending/resubmitted/revision_requested application, or a
 * still-open/non-scoreable-closure incident, in range is real volume, but
 * its SLA status is genuinely unknown or not applicable, not "met" or "not
 * met", so each is excluded from this ratio's numerator AND denominator
 * rather than guessed. This can make `responses` here read lower than
 * "every incident + application filed this period" while a backlog of
 * undecided applications or still-open incidents exists in `range` — an
 * honest gap, not a bug, until Phase 6 gives pending applications a
 * scoreable due date and admin_incident_analytics exposes one for
 * incidents.
 *
 * `totalInRange` is that "every incident + application filed this period"
 * figure `responses` deliberately excludes rows from — i.e.
 * `filteredIncidents.length + filteredApplications.length`, before the
 * scoreable-only filter. It exists so the page can caption the gap on
 * screen ("12 of 340 scoreable") instead of leaving an admin to notice two
 * different-looking totals with no explanation (Admin Portal Fix Plan,
 * Phase 1 final review, finding 3).
 */
export function getSlaRangeStats(
  incidents: IncidentRow[],
  applications: YellowCardRow[],
  range: DateRange,
  dateBasis: SlaDateBasis = "request"
): SlaRangeStats {
  if (!range) {
    throw { kind: "invalid" as const, message: "getSlaRangeStats requires a concrete date range." };
  }

  const trend = getSlaTrend(incidents, range, dateBasis);

  const filteredIncidents = filterByDateRange(incidents, incidentDateAccessor(dateBasis), range);
  const filteredApplications = filterByDateRange(applications, applicationDateAccessor(dateBasis), range);
  const scoreableIncidents = filteredIncidents.filter((row) => incidentMet(row) !== null);
  const decidedApplications = filteredApplications.filter((row) => applicationMet(row) !== null);

  const previousRange = previousPeriodRange(range);
  const previousIncidents = filterByDateRange(incidents, incidentDateAccessor(dateBasis), previousRange);
  const previousApplications = filterByDateRange(applications, applicationDateAccessor(dateBasis), previousRange);
  const previousScoreableIncidents = previousIncidents.filter((row) => incidentMet(row) !== null);
  const previousDecidedApplications = previousApplications.filter((row) => applicationMet(row) !== null);

  const responses = scoreableIncidents.length + decidedApplications.length;
  const met =
    scoreableIncidents.filter((row) => incidentMet(row) === true).length +
    decidedApplications.filter((row) => applicationMet(row) === true).length;
  const violations = responses - met;
  // null when there are zero SLA-scoreable requests in range at all (e.g. a
  // quiet "Today" preset) — not the same as met === 0, which is a genuine 0%
  // compliance figure. The old `: 0` fallback here read as an alarming
  // "SLA Compliance 0%" hero tile on a period with nothing to score (Admin
  // Portal Fix Plan, Task 1.5). Render via formatRate (lib/aggregate.ts)
  // aggregate.ts), never `${value}%` or `?? 0`.
  const compliancePct = responses > 0 ? round1((met / responses) * 100) : null;

  const previousResponses = previousScoreableIncidents.length + previousDecidedApplications.length;
  const previousMet =
    previousScoreableIncidents.filter((row) => incidentMet(row) === true).length +
    previousDecidedApplications.filter((row) => applicationMet(row) === true).length;
  const previousViolations = previousResponses - previousMet;

  const avgResponseDays = averageResolutionDays(filteredIncidents);
  const previousAvgResponseDays = averageResolutionDays(previousIncidents);

  return {
    rangeLabel: formatManilaRangeLabel(range),
    responses,
    responsesDelta: percentDelta(responses, previousResponses),
    violations,
    violationsDelta: countDelta(violations, previousViolations),
    compliancePct,
    avgResponseDays,
    avgResponseDelta: daysDelta(avgResponseDays, previousAvgResponseDays),
    trend,
    totalInRange: filteredIncidents.length + filteredApplications.length,
  };
}
