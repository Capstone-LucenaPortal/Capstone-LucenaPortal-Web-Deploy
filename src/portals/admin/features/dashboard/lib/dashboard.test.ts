// src/portals/admin/features/dashboard/lib/dashboard.test.ts
//
// A pure function over hand-built row arrays — no Supabase client, no
// vi.mock, nothing async — the same discipline src/portals/admin/lib/aggregate.test.ts
// documents and follows.
import { executiveRangeStats } from "@/portals/admin/features/dashboard/lib/dashboard";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { BookingRow } from "@/portals/admin/features/booking/lib/bookings";

function buildYellowCardRow(overrides: Partial<YellowCardRow> = {}): YellowCardRow {
  return {
    id: "app-1",
    reference_number: "YC-0001",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    status: "pending",
    submitted_at: "2026-07-15T00:00:00Z",
    decided_at: null,
    sla_target_hours: 48,
    sla_elapsed_seconds: 1000,
    sla_breached: false,
    review_cycles: 0,
    ...overrides,
  };
}

function buildIncidentRow(overrides: Partial<IncidentRow> = {}): IncidentRow {
  return {
    id: "inc-1",
    reference_number: "IR-0001",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    incident_type_code: "pothole",
    incident_type_label: "Pothole",
    category_code: "infrastructure",
    incident_level: "medium",
    assigned_department_code: "DPW",
    status: "open",
    closure_reason: null,
    submitted_at: "2026-07-15T00:00:00Z",
    routed_at: null,
    resolved_at: null,
    closed_at: null,
    reopened_count: 0,
    time_to_triage_hours: null,
    sla_met: null,
    ...overrides,
  };
}

function buildBookingRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "booking-1",
    reference_number: "CC-0001",
    event_title: "Sample Event",
    event_type_code: "conference",
    classification_code: "private",
    rate_tier: "commercial",
    venue_code: "ATRIUM",
    is_resident: null,
    origin_barangay_code: null,
    origin_locality: null,
    estimated_headcount: 100,
    event_date: "2026-07-15",
    start_time: "09:00:00",
    duration_hours: 4,
    total_fee: 1000,
    status: "confirmed",
    submitted_at: "2026-07-15T00:00:00Z",
    lead_time_days: 17,
    cancellation_reason: null,
    completed_at: null,
    confirmed_at: null,
    quoted_at: null,
    tier_verified: null,
    ...overrides,
  };
}

const RANGE = { from: "2026-07-01", to: "2026-07-31" };

describe("executiveRangeStats", () => {
  it("sums citizensEngaged across all three modules within range", () => {
    const stats = executiveRangeStats(
      [buildYellowCardRow({ submitted_at: "2026-07-10T00:00:00Z" })],
      [
        buildIncidentRow({ submitted_at: "2026-07-11T00:00:00Z" }),
        buildIncidentRow({ submitted_at: "2026-07-12T00:00:00Z" }),
      ],
      [buildBookingRow({ submitted_at: "2026-07-13T00:00:00Z" })],
      RANGE
    );

    expect(stats.citizensEngaged).toBe(4);
  });

  it("excludes rows submitted outside range from citizensEngaged", () => {
    const stats = executiveRangeStats(
      [
        buildYellowCardRow({ submitted_at: "2026-07-10T00:00:00Z" }),
        buildYellowCardRow({ submitted_at: "2026-06-01T00:00:00Z" }),
      ],
      [],
      [],
      RANGE
    );

    expect(stats.citizensEngaged).toBe(1);
  });

  // Service backlog is a point-in-time queue: it must read every row ever
  // filed, not just those submitted within `range`, the same rule already
  // documented and pinned for yellowCardRangeStats/issueRangeStats in
  // src/portals/admin/lib/aggregate.ts.
  it("serviceBacklog counts outstanding rows across all modules, regardless of when they were filed", () => {
    const stats = executiveRangeStats(
      [buildYellowCardRow({ submitted_at: "2026-01-01T00:00:00Z", status: "pending" })],
      [buildIncidentRow({ submitted_at: "2026-01-01T00:00:00Z", status: "in_progress" })],
      [buildBookingRow({ submitted_at: "2026-01-01T00:00:00Z", status: "awaiting_quote" })],
      RANGE
    );

    expect(stats.serviceBacklog).toBe(3);
  });

  // Regression guard: BOOKING_BACKLOG_STATUSES deliberately excludes
  // awaiting_payment — that status means the booking is waiting on the
  // citizen, not on staff, so it must not inflate the Service Backlog tile.
  // This fixture makes "excluded" vs. "counted" visibly different: 1 real
  // backlog item (awaiting_quote) plus 1 awaiting_payment booking that must
  // NOT be counted.
  it("excludes awaiting_payment bookings from serviceBacklog — waiting on the citizen, not on staff", () => {
    const stats = executiveRangeStats(
      [],
      [],
      [
        buildBookingRow({ id: "b-1", status: "awaiting_quote" }),
        buildBookingRow({ id: "b-2", status: "awaiting_payment" }),
      ],
      RANGE
    );

    expect(stats.serviceBacklog).toBe(1);
  });

  it("counts a Tier Claim waiting on review, and not one waiting on the citizen", () => {
    // SCRUM-198 (DB l77b): awaiting_tier_review is the desk's turn;
    // awaiting_resubmission and pending (the document upload) are the citizen's.
    const stats = executiveRangeStats(
      [],
      [],
      [
        buildBookingRow({ id: "b-1", status: "awaiting_tier_review" }),
        buildBookingRow({ id: "b-2", status: "awaiting_resubmission" }),
        buildBookingRow({ id: "b-3", status: "pending" }),
      ],
      RANGE
    );

    expect(stats.serviceBacklog).toBe(1);
  });

  it("excludes resolved/terminal rows from serviceBacklog", () => {
    const stats = executiveRangeStats(
      [buildYellowCardRow({ status: "approved" }), buildYellowCardRow({ status: "withdrawn" })],
      [buildIncidentRow({ status: "resolved" })],
      [buildBookingRow({ status: "completed" }), buildBookingRow({ status: "cancelled" })],
      RANGE
    );

    expect(stats.serviceBacklog).toBe(0);
  });

  it("pools incident sla_met and application !sla_breached into slaCompliancePct, within range", () => {
    const stats = executiveRangeStats(
      // status: "approved" — applicationMet only reads sla_breached for a
      // DECIDED application (see its doc comment in src/portals/admin/features/sla/lib/sla.ts); a
      // pending one would be excluded from this ratio entirely rather than
      // counted as met, which is a different behavior covered separately
      // below.
      [buildYellowCardRow({ submitted_at: "2026-07-10T00:00:00Z", status: "approved", sla_breached: false })],
      [
        // incidentMet only reads sla_met for a RESOLVED, non-excluded-closure
        // incident (see its doc comment in src/portals/admin/features/sla/lib/sla.ts) — status/resolved_at
        // are set here so both rows are actually scoreable, not just "open"
        // defaults that would now be excluded entirely.
        buildIncidentRow({
          submitted_at: "2026-07-11T00:00:00Z",
          status: "resolved",
          resolved_at: "2026-07-11T12:00:00Z",
          sla_met: true,
        }),
        buildIncidentRow({
          submitted_at: "2026-07-12T00:00:00Z",
          status: "resolved",
          resolved_at: "2026-07-13T00:00:00Z",
          sla_met: false,
        }),
      ],
      [],
      RANGE
    );

    // 2 met (1 application + 1 incident) out of 3 total.
    expect(stats.slaCompliancePct).toBe(Math.round((2 / 3) * 1000) / 10);
    expect(stats.slaNote).toContain("below 85% target");
  });

  // Regression guard for the sla_breached-for-pending fix: a pending
  // application's SLA status is unknown, not "met" — it must be excluded
  // from slaResponses/slaMet entirely, not counted toward compliance. Before
  // the fix, this pending row's sla_breached: false read as "met", inflating
  // compliance to 100%; after the fix only the one resolved-but-breached
  // incident counts, giving 0%.
  it("excludes a pending application from slaCompliancePct rather than counting it as met", () => {
    const stats = executiveRangeStats(
      [buildYellowCardRow({ submitted_at: "2026-07-10T00:00:00Z", status: "pending", sla_breached: false })],
      [
        buildIncidentRow({
          submitted_at: "2026-07-11T00:00:00Z",
          status: "resolved",
          resolved_at: "2026-07-12T00:00:00Z",
          sla_met: false,
        }),
      ],
      [],
      RANGE
    );

    expect(stats.slaCompliancePct).toBe(0);
  });

  // Admin Portal Fix Plan, Task 1.5: a zero-denominator compliance figure
  // must read as "unavailable" (null), not a fabricated 0% — a "0% SLA
  // compliance" hero tile on a period with nothing to score is a false
  // alarm, not an honest reading. See formatRate in src/portals/admin/lib/aggregate.ts
  // for how the UI renders this.
  it("slaCompliancePct is null, not 0 or NaN, when there are no incidents or applications in range", () => {
    const stats = executiveRangeStats([], [], [], RANGE);
    expect(stats.slaCompliancePct).toBeNull();
  });

  // Extended by Task 1.2, then corrected by Task 1.5: slaCompliancePct must
  // also read null (not 0, not NaN) when incidents/applications exist in
  // range but NONE of them are scoreable yet — e.g. every incident is still
  // open. Distinct from the "nothing in range at all" case above: here
  // `incidents` is non-empty, but scoreableIncidents.length is 0, so
  // slaResponses stays 0 — the same empty-denominator case, just reached via
  // a different path (exclusion rather than absence).
  it("slaCompliancePct is null, not 0 or NaN, when incidents exist in range but none are scoreable yet", () => {
    const stats = executiveRangeStats(
      [],
      [buildIncidentRow({ submitted_at: "2026-07-10T00:00:00Z", status: "open", resolved_at: null })],
      [],
      RANGE
    );

    expect(stats.slaCompliancePct).toBeNull();
  });

  // The KPI tile's caption must degrade honestly too, not compute a
  // pts-below-target gap against a null baseline.
  it("slaNote reads 'No SLA-scoreable requests in range' rather than a pts-below-target gap when slaCompliancePct is null", () => {
    const stats = executiveRangeStats([], [], [], RANGE);
    expect(stats.slaNote).toBe("No SLA-scoreable requests in range");
  });

  // Regression guard: slaResponses/slaMet must pool only applications and
  // incidents, the same "two SLA clocks" pooling rule getSlaByDepartment/
  // getSlaRangeStats already document in src/portals/admin/features/sla/lib/sla.ts — bookings have no
  // SLA clock at all. The fixture below is chosen so folding bookings in
  // would visibly change the number: 1 met incident alone is 100%; adding 2
  // unrelated bookings to the denominator (bookings.length, uncounted as
  // "met" since applicationMet/incidentMet don't apply to them) would drag
  // it down to 33.3%.
  it("slaResponses/slaMet pool only applications and incidents, never bookings", () => {
    const stats = executiveRangeStats(
      [],
      [
        buildIncidentRow({
          submitted_at: "2026-07-10T00:00:00Z",
          status: "resolved",
          resolved_at: "2026-07-10T12:00:00Z",
          sla_met: true,
        }),
      ],
      [
        buildBookingRow({ id: "b-1", submitted_at: "2026-07-11T00:00:00Z" }),
        buildBookingRow({ id: "b-2", submitted_at: "2026-07-12T00:00:00Z" }),
      ],
      RANGE
    );

    expect(stats.slaCompliancePct).toBe(100);
  });

  // lccUtilizationPct is a real, derivable occupancy signal (share of
  // calendar days in range with a non-cancelled booking) — not a fabricated
  // capacity fill rate, which the row shape has no data to compute (see the
  // function's doc comment in src/portals/admin/features/dashboard/lib/dashboard.ts).
  it("lccUtilizationPct is the share of days in range with a non-cancelled booking", () => {
    const stats = executiveRangeStats(
      [],
      [],
      [
        buildBookingRow({ event_date: "2026-07-01", status: "confirmed" }),
        buildBookingRow({ event_date: "2026-07-02", status: "confirmed" }),
        buildBookingRow({ event_date: "2026-07-03", status: "cancelled" }),
      ],
      RANGE
    );

    // 2 booked days out of 31 in July.
    expect(stats.lccUtilizationPct).toBe(Math.round((2 / 31) * 1000) / 10);
  });

  it("a cancelled-only day does not count toward lccUtilizationPct", () => {
    const stats = executiveRangeStats(
      [],
      [],
      [buildBookingRow({ event_date: "2026-07-01", status: "cancelled" })],
      RANGE
    );

    expect(stats.lccUtilizationPct).toBe(0);
  });

  // Fix round 1, finding 1: lccUtilizationPct must never exceed 100%. A
  // prior version filtered bookings by submitted_at before computing
  // occupancy, but then counted event_date values from that slice without
  // constraining event_date to `range` at all — a booking's filing date and
  // its event date are different things. 30 bookings all submitted inside
  // July but all with September event dates reproduces the reviewer's
  // measured defect (96.8% on Month, 3000% on Today): none of their event
  // dates fall in July, so real occupancy for July is 0%, not a number
  // derived from an unrelated month's day count.
  it("does not count a booking whose event_date falls outside range, even though it was submitted inside range", () => {
    const rows = Array.from({ length: 30 }, (_, index) =>
      buildBookingRow({
        id: `b-${index}`,
        submitted_at: "2026-07-15T00:00:00Z", // inside RANGE (July)
        event_date: `2026-09-${String(index + 1).padStart(2, "0")}`, // outside RANGE (September)
        status: "confirmed",
      })
    );

    const stats = executiveRangeStats([], [], rows, RANGE);

    expect(stats.lccUtilizationPct).toBeLessThanOrEqual(100);
    expect(stats.lccUtilizationPct).toBe(0);
  });

  // The mirror-image case: a booking submitted OUTSIDE range but with an
  // event_date INSIDE it must still count — occupancy is about which days
  // in `range` have an event on them, not about when the booking was filed.
  it("counts a booking whose event_date falls inside range even though it was submitted outside range", () => {
    const stats = executiveRangeStats(
      [],
      [],
      [buildBookingRow({ submitted_at: "2026-01-01T00:00:00Z", event_date: "2026-07-10", status: "confirmed" })],
      RANGE
    );

    expect(stats.lccUtilizationPct).toBe(Math.round((1 / 31) * 1000) / 10);
  });

  it("returns well-formed deltas even with zero rows anywhere", () => {
    const stats = executiveRangeStats([], [], [], RANGE);

    expect(stats.citizensEngaged).toBe(0);
    expect(stats.citizensDelta).toContain("No activity");
    expect(stats.serviceBacklog).toBe(0);
    expect(stats.backlogDelta).toBe("+0 newly filed this period");
  });
});
