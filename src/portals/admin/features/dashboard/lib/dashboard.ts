// src/portals/admin/features/dashboard/lib/dashboard.ts
//
// Aggregates the three admin analytics views (Yellow Card, Incidents,
// Bookings) into the top-of-dashboard ExecutiveRangeStats KPI tiles. A pure,
// synchronous function over rows the page has already fetched via
// listApplications()/listIncidents()/listBookings() — no Supabase client, no
// I/O, testable with hand-built rows the same way src/portals/admin/lib/aggregate.ts is
// (see its own header comment).
import { countDelta, percentDelta, previousPeriodRange } from "@/portals/admin/lib/aggregate";
import type { BookingRow } from "@/portals/admin/features/booking/lib/bookings";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import { filterByDateRange } from "@/portals/admin/lib/dates";
import { applicationMet, incidentMet, SLA_TARGET_PCT } from "@/portals/admin/features/sla/lib/sla";
import type { ExecutiveRangeStats } from "@/portals/admin/features/dashboard/types";

type DateRange = { from: string; to: string };

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Applications/incidents/bookings still awaiting city action, per each
// view's own status enum. These mirror the "point-in-time backlog, not
// per-period" rule already documented on yellowCardRangeStats/
// issueRangeStats in src/portals/admin/lib/aggregate.ts — a backlog counts everything
// currently outstanding, not just what was filed within `range`.
const YELLOW_CARD_BACKLOG_STATUSES = new Set(["pending", "resubmitted", "revision_requested"]);
const INCIDENT_BACKLOG_STATUSES = new Set(["open", "in_pool", "in_progress"]);
// Bookings "awaiting_payment" are waiting on the citizen, not on staff, so
// they are deliberately excluded — this backlog counts requests waiting on
// the city, the same framing as the other two. "awaiting_tier_review" is a
// Tier Claim waiting on the booking desk (SCRUM-198). "pending" is out since
// DB l77b made it reachable: it is a discounted booking waiting on the
// citizen's organisation document.
const BOOKING_BACKLOG_STATUSES = new Set([
  "awaiting_tier_review",
  "awaiting_quote",
  "payment_verification",
]);

function isBacklog<T extends { status: string | null }>(row: T, statuses: Set<string>): boolean {
  return row.status !== null && statuses.has(row.status);
}

// applicationMet and incidentMet are imported from src/portals/admin/features/sla/lib/sla.ts rather
// than redefined here — both return `boolean | null` (null for a
// not-yet-scoreable row: a still-pending/resubmitted/revision_requested
// application, or a still-open/non-scoreable-closure incident; see their
// own doc comments), and this file must apply the exact same "unknown" rule
// the SLA Reports page does, not a second copy that could silently drift
// from it — this dashboard used to carry its own private `incidentMet` that
// had exactly that drift: a bare `row.sla_met === true` check, unaware of
// the null outcome.

/**
 * Citywide occupancy of the Convention Center over `range`: the share of
 * calendar days in `range` that have at least one non-cancelled event
 * booked. This is deliberately NOT a capacity fill rate —
 * admin_booking_analytics/public_booking_venues carry no venue capacity
 * NUMBER to divide by (see venueUtilisation's doc comment in
 * src/portals/admin/lib/aggregate.ts for the same gap) — but "share of days the complex
 * has an event on" is a real, honestly-derivable occupancy signal, not a
 * fabricated percentage.
 *
 * `allRows` is the FULL fetched array, not pre-filtered by the caller: this
 * function filters by `event_date` falling inside `range` itself, via
 * filterByDateRange. That distinction matters — a booking's `submitted_at`
 * (when it was filed) and its `event_date` (when the event happens) are
 * different dates that can land in different periods, and this metric is
 * about which CALENDAR DAYS in `range` had an event on them, not which
 * bookings were filed in `range`. An earlier version filtered by
 * `submitted_at` upstream and counted `event_date` values from that already
 * wrong slice, which had no relationship to `totalDays` at all — thirty
 * bookings filed in July for September events could count thirty "booked
 * days" against a 31-day July window, producing numbers over 100% (or, on a
 * single-day "Today" preset, numbers in the thousands of percent).
 */
function occupancyStats(
  allRows: BookingRow[],
  range: DateRange
): { pct: number; bookedDays: number; totalDays: number } {
  const totalDays =
    Math.round((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000) + 1;
  if (totalDays <= 0) return { pct: 0, bookedDays: 0, totalDays: 0 };

  const eventsInRange = filterByDateRange(
    allRows.filter((row) => row.status !== "cancelled"),
    (row) => row.event_date,
    range
  );
  const bookedDays = new Set(eventsInRange.map((row) => row.event_date as string));
  // bookedDays can never exceed totalDays: every member of eventsInRange has
  // an event_date filterByDateRange already confirmed falls within `range`,
  // so there are at most `totalDays` distinct values to collect. The result
  // is bounded to [0, 100] by construction, not by a clamp bolted on after.
  return { pct: round1((bookedDays.size / totalDays) * 100), bookedDays: bookedDays.size, totalDays };
}

/**
 * The Dashboard's four top KPI tiles, aggregated across all three analytics
 * views for `range`. `allYellowCardRows`/`allIncidentRows`/`allBookingRows`
 * are the full, unfiltered arrays each page-equivalent fetch already
 * returns — this function does its own date filtering (current AND the
 * immediately preceding period, for the delta captions) via
 * filterByDateRange/previousPeriodRange, the same helpers every other
 * converted page now uses.
 */
export function executiveRangeStats(
  allYellowCardRows: YellowCardRow[],
  allIncidentRows: IncidentRow[],
  allBookingRows: BookingRow[],
  range: DateRange
): ExecutiveRangeStats {
  const previousRange = previousPeriodRange(range);

  const applications = filterByDateRange(allYellowCardRows, (row) => row.submitted_at, range);
  const incidents = filterByDateRange(allIncidentRows, (row) => row.submitted_at, range);
  const bookings = filterByDateRange(allBookingRows, (row) => row.submitted_at, range);

  const previousApplications = filterByDateRange(allYellowCardRows, (row) => row.submitted_at, previousRange);
  const previousIncidents = filterByDateRange(allIncidentRows, (row) => row.submitted_at, previousRange);
  const previousBookings = filterByDateRange(allBookingRows, (row) => row.submitted_at, previousRange);

  // "Citizens engaged" is every service interaction filed in range, across
  // all three modules.
  const citizensEngaged = applications.length + incidents.length + bookings.length;
  const previousCitizensEngaged = previousApplications.length + previousIncidents.length + previousBookings.length;

  // Service backlog is a point-in-time queue across all three modules, so it
  // reads ALL rows, not just those filed in `range` — the same rule
  // documented on yellowCardRangeStats/issueRangeStats in aggregate.ts.
  const backlogCount =
    allYellowCardRows.filter((row) => isBacklog(row, YELLOW_CARD_BACKLOG_STATUSES)).length +
    allIncidentRows.filter((row) => isBacklog(row, INCIDENT_BACKLOG_STATUSES)).length +
    allBookingRows.filter((row) => isBacklog(row, BOOKING_BACKLOG_STATUSES)).length;

  // How much of the CURRENT backlog was newly filed within `range` — a real,
  // derivable measure of "how fast the queue grew this period", in place of
  // the old mock's fixed "+N this week" caption.
  const newBacklogInRange =
    applications.filter((row) => isBacklog(row, YELLOW_CARD_BACKLOG_STATUSES)).length +
    incidents.filter((row) => isBacklog(row, INCIDENT_BACKLOG_STATUSES)).length +
    bookings.filter((row) => isBacklog(row, BOOKING_BACKLOG_STATUSES)).length;

  // SLA compliance pools incidents and Yellow Card applications into one
  // citywide ratio — the same pooling getSlaByDepartment/getSlaRangeStats
  // already do for the SLA Reports page (see their doc comments in
  // src/portals/admin/features/sla/lib/sla.ts): a citywide total is a legitimate top-line figure to
  // sum across services, unlike averaging the two SLA clocks' time-duration
  // math together.
  //
  // Only DECIDED Yellow Card applications (applicationMet returns null for a
  // pending/resubmitted/revision_requested one) and SCOREABLE incidents
  // (incidentMet returns null for a still-open incident, or one closed via
  // invalid/duplicate/expired_unverified) are scoreable, so those are
  // excluded from both slaResponses and slaMet on their respective sides —
  // the same rule getSlaRangeStats applies, for the same reason (see its and
  // incidentMet's doc comments in src/portals/admin/features/sla/lib/sla.ts).
  const decidedApplications = applications.filter((row) => applicationMet(row) !== null);
  const scoreableIncidents = incidents.filter((row) => incidentMet(row) !== null);
  const slaResponses = decidedApplications.length + scoreableIncidents.length;
  const slaMet =
    decidedApplications.filter((row) => applicationMet(row) === true).length +
    scoreableIncidents.filter((row) => incidentMet(row) === true).length;
  // null when there is nothing scoreable at all in range (e.g. a quiet
  // "Today" preset) — not the same as slaMet === 0, which is a genuine 0%
  // breach rate. The old `: 0` fallback here read as an alarming "SLA
  // compliance 0% · 95 pts below target" on a period with nothing to score,
  // a false signal to a mayor (Admin Portal Fix Plan, Task 1.5).
  const slaCompliancePct = slaResponses > 0 ? round1((slaMet / slaResponses) * 100) : null;
  const gap = slaCompliancePct === null ? null : round1(SLA_TARGET_PCT - slaCompliancePct);

  // occupancyStats reads `allBookingRows` and does its own event_date
  // filtering — NOT the submitted_at-filtered `bookings`/`previousBookings`
  // above, which describe a different question (what was FILED in range).
  const occupancy = occupancyStats(allBookingRows, range);

  return {
    citizensEngaged,
    citizensDelta: percentDelta(citizensEngaged, previousCitizensEngaged),
    serviceBacklog: backlogCount,
    backlogDelta: countDelta(newBacklogInRange, 0, "newly filed this period"),
    slaCompliancePct,
    slaNote:
      gap === null
        ? "No SLA-scoreable requests in range"
        : gap > 0
          ? `${gap} pts below ${SLA_TARGET_PCT}% target`
          : `${Math.abs(gap)} pts above ${SLA_TARGET_PCT}% target`,
    lccUtilizationPct: occupancy.pct,
    // A descriptive fraction, not a "vs previous period" delta: this KPI's
    // own label was renamed to "Days with an event" on the dashboard page
    // specifically so nobody reads it as a capacity fill rate (Convention
    // Center's own Utilization tile says "Not tracked" for that, honestly,
    // since no venue capacity NUMBER exists to compute one). Spelling out
    // the fraction here keeps the definition on screen, not just in a code
    // comment nobody browsing the dashboard will ever read.
    lccDelta: `${occupancy.bookedDays} of ${occupancy.totalDays} day${occupancy.totalDays === 1 ? "" : "s"} had an event`,
  };
}
