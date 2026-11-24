// src/portals/admin/features/dashboard/lib/dashboard.ts
//
// Aggregates the three admin analytics views (Yellow Card, Incidents,
// Bookings) into the top-of-dashboard ExecutiveRangeStats KPI tiles. A pure,
// synchronous function over rows the page has already fetched via
// listApplications()/listIncidents()/listBookings() — no Supabase client, no
// I/O, testable with hand-built rows the same way src/portals/admin/lib/aggregate.ts is
// (see its own header comment).
import {
  countDelta,
  eventDays,
  inServiceBacklog,
  percentDelta,
  previousPeriodRange,
  ratePointsDelta,
} from "@/portals/admin/lib/aggregate";
import type { BookingRow } from "@/portals/admin/features/booking/lib/bookings";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import { filterByDateRange } from "@/portals/admin/lib/dates";
import { slaCompliance } from "@/portals/admin/features/sla/lib/sla";
import type { ExecutiveRangeStats } from "@/portals/admin/features/dashboard/types";

type DateRange = { from: string; to: string };

// The SLA scoring rules come from slaCompliance in
// src/portals/admin/features/sla/lib/sla.ts rather than being redefined
// here: this file must score exactly as the SLA Reports page does, not keep
// a second copy that could silently drift from it — this dashboard used to
// carry its own private `incidentMet` that had exactly that drift.

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

  // Service requests filed: every request filed in range, across all three
  // services. It counts requests, not people (metrics sheet D1).
  const requestsFiled = applications.length + incidents.length + bookings.length;
  const previousRequestsFiled = previousApplications.length + previousIncidents.length + previousBookings.length;

  // The Service backlog is what waits on the city right now, so it reads ALL
  // rows, not just those filed in `range` (inServiceBacklog in aggregate.ts,
  // metrics sheet D2).
  const backlogOf = (yellowCard: YellowCardRow[], incidentRows: IncidentRow[], bookingRows: BookingRow[]) =>
    inServiceBacklog(yellowCard, "yellowCard").length +
    inServiceBacklog(incidentRows, "incidents").length +
    inServiceBacklog(bookingRows, "bookings").length;
  const backlogCount = backlogOf(allYellowCardRows, allIncidentRows, allBookingRows);

  // How much of the current backlog was filed within `range`: how fast the
  // queue grew this period.
  const newBacklogInRange = backlogOf(applications, incidents, bookings);

  // SLA compliance once per service, by the scoring rules SLA Reports uses
  // too (slaCompliance in src/portals/admin/features/sla/lib/sla.ts). Never
  // pooled: a 3-working-day legal processing time, 4-72-hour voluntary
  // incident standards and a booking's voluntary 3 or 7 working days are
  // different promises (ADR 0001, #119, SCRUM-131).
  const sla = slaCompliance(applications, incidents, bookings);
  const previousSla = slaCompliance(previousApplications, previousIncidents, previousBookings);

  return {
    requestsFiled,
    requestsFiledDelta: percentDelta(requestsFiled, previousRequestsFiled),
    serviceBacklog: backlogCount,
    backlogDelta: countDelta(newBacklogInRange, 0, "newly filed this period"),
    sla: {
      yellowCard: {
        ...sla.yellowCard,
        delta: ratePointsDelta(sla.yellowCard.compliancePct, previousSla.yellowCard.compliancePct),
      },
      incidents: {
        ...sla.incidents,
        delta: ratePointsDelta(sla.incidents.compliancePct, previousSla.incidents.compliancePct),
      },
      bookings: {
        ...sla.bookings,
        delta: ratePointsDelta(sla.bookings.compliancePct, previousSla.bookings.compliancePct),
      },
    },
    // Days with an event reads `allBookingRows` and does its own event_date
    // filtering — NOT the submitted_at-filtered `bookings` above, which
    // describe a different question (what was FILED in range). Its note
    // "X of Y days had an event" is a fact about the figure, not a delta:
    // it is not judged against a promise (metrics sheet D4).
    eventDays: eventDays(allBookingRows, range),
  };
}
