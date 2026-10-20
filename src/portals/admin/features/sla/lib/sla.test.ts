import {
  getSlaByDepartment,
  getSlaMonthlyHistory,
  getSlaRangeStats,
  getSlaTrend,
  departmentStatus,
  SLA_TARGET_PCT,
} from "@/portals/admin/features/sla/lib/sla";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import type { DepartmentRow } from "@/portals/admin/lib/supabase/catalogs";

// As of Admin Portal Fix Plan Task 4.2, getSlaByDepartment/getSlaTrend/
// getSlaMonthlyHistory/getSlaRangeStats no longer call listIncidents()/
// listApplications()/listDepartments() themselves — each is now a pure,
// synchronous function over rows the CALLER has already fetched, matching
// the convention src/portals/admin/lib/aggregate.ts/src/portals/admin/features/dashboard/lib/dashboard.ts already use.
// This file therefore builds incident/application/department row arrays
// directly and passes them in, rather than mocking the list*() modules the
// way it did before this refactor.

function buildIncident(overrides: Partial<IncidentRow> = {}): IncidentRow {
  return {
    id: "inc-1",
    reference_number: "IR-2026-000001",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    incident_type_code: "pothole",
    incident_type_label: "Pothole",
    category_code: "infrastructure",
    incident_level: "medium",
    assigned_department_code: "engineering",
    status: "resolved",
    closure_reason: null,
    submitted_at: "2026-07-10T04:00:00Z",
    routed_at: "2026-07-10T05:00:00Z",
    resolved_at: "2026-07-11T04:00:00Z",
    closed_at: null,
    reopened_count: 0,
    time_to_triage_hours: 1,
    sla_met: true,
    ...overrides,
  };
}

function buildApplication(overrides: Partial<YellowCardRow> = {}): YellowCardRow {
  return {
    id: "app-1",
    reference_number: "YC-2026-000001",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    status: "approved",
    submitted_at: "2026-07-10T04:00:00Z",
    decided_at: "2026-07-11T04:00:00Z",
    review_cycles: 1,
    sla_breached: false,
    sla_elapsed_seconds: 3600,
    sla_target_hours: 24,
    ...overrides,
  };
}

function buildDepartment(overrides: Partial<DepartmentRow> = {}): DepartmentRow {
  return {
    code: "engineering",
    label: "Engineering",
    sort_order: 1,
    ...overrides,
  };
}

// The default department catalog most getSlaByDepartment fixtures use —
// mirrors the old mockListDepartments default.
const defaultDepartments = [buildDepartment()];

describe("getSlaByDepartment", () => {
  it("3 met / 1 unmet in the same department reports 75%", () => {
    const incidents = [
      buildIncident({ id: "inc-1", sla_met: true }),
      buildIncident({ id: "inc-2", sla_met: true }),
      buildIncident({ id: "inc-3", sla_met: true }),
      buildIncident({ id: "inc-4", sla_met: false }),
    ];

    const rows = getSlaByDepartment(incidents, [], defaultDepartments, null);

    expect(rows).toEqual([{ department: "Engineering", requests: 4, compliancePct: 75, totalInRange: 4 }]);
  });

  // Task 1.2 fix: admin_incident_analytics.sla_met is false, not null, for
  // ANY row that is not both resolved and armed — including a still-open
  // incident that never had a fair chance to be scored. incidentMet now
  // excludes it (null) rather than scoring it as unmet, so this reports
  // 100% over the one genuinely scoreable incident, not 50% over two. This
  // replaces the old fixture, which pinned the opposite (and wrong)
  // behavior — see incidentMet's doc comment in src/portals/admin/features/sla/lib/sla.ts.
  it("an open, not-yet-resolved incident is excluded from requests/compliancePct, not scored as unmet", () => {
    const incidents = [
      buildIncident({ id: "inc-1", sla_met: true, resolved_at: "2026-07-11T04:00:00Z", status: "resolved" }),
      buildIncident({ id: "inc-2", sla_met: false, resolved_at: null, status: "open" }),
    ];

    const rows = getSlaByDepartment(incidents, [], defaultDepartments, null);

    expect(rows).toEqual([
      { department: "Engineering", requests: 1, compliancePct: 100, totalInRange: 2 },
    ]);
  });

  // Boundary: in_pool/in_progress are just as "still open" as "open" for
  // this purpose — resolved_at is what incidentMet actually keys on, not a
  // specific pre-resolution status. A very old routed_at does NOT flip this
  // to "breached": admin_incident_analytics exposes no sla_due_at, so an
  // armed-and-overdue incident cannot be told apart from one that is still
  // genuinely unverified (never armed at all) — see the "KNOWN LIMITATION"
  // section of incidentMet's doc comment. This pins that deliberate choice
  // so a future change that starts guessing a due date from routed_at alone
  // has to consciously break this test, not silently drift past it.
  it("a still-open incident is excluded regardless of age or status (in_pool/in_progress), not counted as a live breach", () => {
    const incidents = [
      buildIncident({
        id: "inc-1",
        status: "in_pool",
        resolved_at: null,
        routed_at: "2020-01-01T00:00:00Z",
        sla_met: false,
      }),
      buildIncident({ id: "inc-2", status: "in_progress", resolved_at: null, sla_met: false }),
    ];

    const rows = getSlaByDepartment(incidents, [], defaultDepartments, null);

    expect(rows).toEqual([]);
  });

  // Boundary: closure_reason wins even over a resolved_at/sla_met that look
  // scoreable — invalid/duplicate/expired_unverified reports never had a
  // legitimate SLA case, so they are excluded unconditionally (Step 2 of the
  // Task 1.2 fix). inc-1/inc-2 are chosen to look like a "met" and an
  // "unresolved-so-excluded" row respectively if closure_reason were ignored,
  // to prove the exclusion isn't just piggybacking on the resolved_at check.
  it("closed via invalid/duplicate/expired_unverified is excluded from compliance math even when resolved_at is set", () => {
    const incidents = [
      buildIncident({
        id: "inc-1",
        status: "closed",
        closure_reason: "invalid",
        resolved_at: "2026-07-11T04:00:00Z",
        sla_met: true,
      }),
      buildIncident({
        id: "inc-2",
        status: "closed",
        closure_reason: "duplicate",
        resolved_at: "2026-07-11T04:00:00Z",
        sla_met: false,
      }),
      buildIncident({
        id: "inc-3",
        status: "closed",
        closure_reason: "expired_unverified",
        resolved_at: null,
        sla_met: false,
      }),
      buildIncident({
        id: "inc-4",
        status: "resolved",
        closure_reason: null,
        resolved_at: "2026-07-11T04:00:00Z",
        sla_met: true,
      }),
    ];

    const rows = getSlaByDepartment(incidents, [], defaultDepartments, null);

    expect(rows).toEqual([
      { department: "Engineering", requests: 1, compliancePct: 100, totalInRange: 4 },
    ]);
  });

  // Boundary: a resolved-late incident is a genuine breach and must still
  // count — the fix excludes not-yet-scoreable rows, it does not soften
  // real violations. Distinguishes incidentMet's null (excluded) outcome
  // from its false (breached) outcome.
  it("a resolved-but-late incident still counts as a breach, not excluded", () => {
    const incidents = [
      buildIncident({
        id: "inc-1",
        status: "closed",
        closure_reason: "citizen_confirmed",
        resolved_at: "2026-07-15T04:00:00Z",
        sla_met: false,
      }),
    ];

    const rows = getSlaByDepartment(incidents, [], defaultDepartments, null);

    expect(rows).toEqual([
      { department: "Engineering", requests: 1, compliancePct: 0, totalInRange: 1 },
    ]);
  });

  it("a department with no rows in range is omitted entirely, not shown at 0%", () => {
    const departments = [
      buildDepartment({ code: "engineering", label: "Engineering" }),
      buildDepartment({ code: "electrical", label: "Electrical" }),
    ];
    const incidents = [buildIncident({ assigned_department_code: "engineering" })];

    const rows = getSlaByDepartment(incidents, [], departments, null);

    expect(rows).toHaveLength(1);
    expect(rows.map((row) => row.department)).not.toContain("Electrical");
  });

  it("incidents with no assigned department are excluded from every group", () => {
    const incidents = [buildIncident({ id: "inc-1", assigned_department_code: null, sla_met: false })];

    const rows = getSlaByDepartment(incidents, [], defaultDepartments, null);

    expect(rows).toEqual([]);
  });

  it("joins assigned_department_code to its label via the departments catalog", () => {
    const departments = [buildDepartment({ code: "waste", label: "Waste Management" })];
    const incidents = [buildIncident({ assigned_department_code: "waste", sla_met: true })];

    const rows = getSlaByDepartment(incidents, [], departments, null);

    expect(rows[0].department).toBe("Waste Management");
  });

  it("falls back to the raw department code when the catalog has no match", () => {
    const departments = [buildDepartment({ code: "engineering", label: "Engineering" })];
    const incidents = [buildIncident({ assigned_department_code: "unknown-dept", sla_met: true })];

    const rows = getSlaByDepartment(incidents, [], departments, null);

    expect(rows[0].department).toBe("unknown-dept");
  });

  it("folds Yellow Card applications into one extra synthetic row keyed on sla_breached", () => {
    const applications = [
      buildApplication({ id: "app-1", sla_breached: false }),
      buildApplication({ id: "app-2", sla_breached: false }),
      buildApplication({ id: "app-3", sla_breached: true }),
      buildApplication({ id: "app-4", sla_breached: true }),
    ];

    const rows = getSlaByDepartment([], applications, defaultDepartments, null);

    expect(rows).toEqual([
      { department: "Yellow Card", requests: 4, compliancePct: 50, totalInRange: 4 },
    ]);
  });

  // Regression guard for the sla_breached-for-pending fix: a pending/
  // resubmitted/revision_requested application's SLA status is unknown, not
  // "met" or "not met" (see applicationMet's doc comment in src/portals/admin/features/sla/lib/sla.ts),
  // so it must be excluded from both `requests` and compliancePct's
  // denominator here — not folded into either side of the ratio the way a
  // buggy `!row.sla_breached` read would (a pending row's sla_breached is
  // always false, so counting it in would have silently inflated
  // compliance). Only the two decided rows (app-1 met, app-2 unmet) should
  // count; if any of the three non-terminal rows leaked in, requests would
  // read something other than 2 and/or compliancePct would drift from 50.
  it("excludes pending/resubmitted/revision_requested applications from the Yellow Card row's ratio, counting only decided ones", () => {
    const applications = [
      buildApplication({ id: "app-1", status: "approved", sla_breached: false }),
      buildApplication({ id: "app-2", status: "rejected", sla_breached: true }),
      buildApplication({ id: "app-3", status: "pending", sla_breached: true }),
      buildApplication({ id: "app-4", status: "resubmitted", sla_breached: false }),
      buildApplication({ id: "app-5", status: "revision_requested", sla_breached: true }),
    ];

    const rows = getSlaByDepartment([], applications, defaultDepartments, null);

    expect(rows).toEqual([
      { department: "Yellow Card", requests: 2, compliancePct: 50, totalInRange: 5 },
    ]);
  });

  it("omits the Yellow Card row entirely when there are no applications in range", () => {
    const incidents = [buildIncident({ sla_met: true })];

    const rows = getSlaByDepartment(incidents, [], defaultDepartments, null);

    expect(rows.map((row) => row.department)).not.toContain("Yellow Card");
  });

  // Distinct from the "no applications at all" case above: here applications
  // DO exist in range, but none of them are decided yet, so there is still
  // nothing to compute a compliancePct from. This exercises the
  // `decidedApplications.length > 0` guard specifically (as opposed to the
  // pre-existing `filteredApplications.length > 0` guard it replaced) — a
  // version that only checked "any applications at all" would incorrectly
  // push a Yellow Card row here with a NaN or 0% compliancePct.
  it("omits the Yellow Card row when applications exist in range but none of them are decided yet", () => {
    const incidents = [buildIncident({ sla_met: true })];
    const applications = [
      buildApplication({ id: "app-1", status: "pending", sla_breached: false }),
      buildApplication({ id: "app-2", status: "resubmitted", sla_breached: true }),
      buildApplication({ id: "app-3", status: "revision_requested", sla_breached: false }),
    ];

    const rows = getSlaByDepartment(incidents, applications, defaultDepartments, null);

    expect(rows.map((row) => row.department)).not.toContain("Yellow Card");
  });

  it("sorts rows by compliancePct descending", () => {
    const departments = [
      buildDepartment({ code: "engineering", label: "Engineering" }),
      buildDepartment({ code: "waste", label: "Waste Management" }),
    ];
    const incidents = [
      buildIncident({ id: "inc-1", assigned_department_code: "engineering", sla_met: false }),
      buildIncident({ id: "inc-2", assigned_department_code: "waste", sla_met: true }),
    ];

    const rows = getSlaByDepartment(incidents, [], departments, null);

    expect(rows.map((row) => row.department)).toEqual(["Waste Management", "Engineering"]);
  });

  it("applies filterByDateRange against submitted_at, narrowing which incidents count", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-07-10T04:00:00Z", sla_met: true }),
      buildIncident({ id: "inc-2", submitted_at: "2026-06-10T04:00:00Z", sla_met: false }),
    ];

    const rows = getSlaByDepartment(incidents, [], defaultDepartments, {
      from: "2026-07-01",
      to: "2026-07-31",
    });

    expect(rows).toEqual([
      { department: "Engineering", requests: 1, compliancePct: 100, totalInRange: 1 },
    ]);
  });

  it("a null range applies no date filter at all", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-07-10T04:00:00Z", sla_met: true }),
      buildIncident({ id: "inc-2", submitted_at: "2020-01-01T04:00:00Z", sla_met: true }),
    ];

    const rows = getSlaByDepartment(incidents, [], defaultDepartments, null);

    expect(rows[0].requests).toBe(2);
  });

  // Fix round 1, finding 3: the "Date type" toggle on the SLA Reports page
  // was wired to the page's local state but never reached any of this
  // file's functions, so switching it had no effect. This fixture is chosen
  // so "request"/"resolution" visibly disagree: inc-1 was submitted in July
  // but resolved in June, so it counts under "request" and not under
  // "resolution"; inc-2 is the mirror image.
  it("dateBasis='resolution' filters incidents by resolved_at instead of submitted_at", () => {
    const incidents = [
      buildIncident({
        id: "inc-1",
        submitted_at: "2026-07-10T04:00:00Z",
        resolved_at: "2026-06-15T04:00:00Z",
        sla_met: true,
      }),
      buildIncident({
        id: "inc-2",
        submitted_at: "2026-06-10T04:00:00Z",
        resolved_at: "2026-07-15T04:00:00Z",
        sla_met: false,
      }),
    ];
    const range = { from: "2026-07-01", to: "2026-07-31" };

    const requestBasis = getSlaByDepartment(incidents, [], defaultDepartments, range, "request");
    expect(requestBasis).toEqual([
      { department: "Engineering", requests: 1, compliancePct: 100, totalInRange: 1 },
    ]);

    const resolutionBasis = getSlaByDepartment(incidents, [], defaultDepartments, range, "resolution");
    expect(resolutionBasis).toEqual([
      { department: "Engineering", requests: 1, compliancePct: 0, totalInRange: 1 },
    ]);
  });

  it("dateBasis='resolution' filters Yellow Card applications by decided_at instead of submitted_at", () => {
    const applications = [
      buildApplication({
        id: "app-1",
        submitted_at: "2026-06-01T04:00:00Z",
        decided_at: "2026-07-10T04:00:00Z",
        sla_breached: false,
      }),
    ];
    const range = { from: "2026-07-01", to: "2026-07-31" };

    const requestBasis = getSlaByDepartment([], applications, defaultDepartments, range, "request");
    expect(requestBasis.map((row) => row.department)).not.toContain("Yellow Card");

    const resolutionBasis = getSlaByDepartment([], applications, defaultDepartments, range, "resolution");
    expect(resolutionBasis).toEqual([
      { department: "Yellow Card", requests: 1, compliancePct: 100, totalInRange: 1 },
    ]);
  });
});

describe("getSlaTrend", () => {
  it("buckets rows by calendar month and orders the series oldest-first", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-03-05T04:00:00Z", sla_met: true }),
      buildIncident({ id: "inc-2", submitted_at: "2026-01-05T04:00:00Z", sla_met: true }),
      buildIncident({ id: "inc-3", submitted_at: "2026-02-05T04:00:00Z", sla_met: true }),
    ];

    const points = getSlaTrend(incidents, null);

    expect(points.map((point) => point.label)).toEqual(["Jan 2026", "Feb 2026", "Mar 2026"]);
  });

  it("computes compliancePct and violations per bucket from sla_met, excluding a still-open incident from both", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-07-05T04:00:00Z", sla_met: true }),
      buildIncident({ id: "inc-2", submitted_at: "2026-07-06T04:00:00Z", sla_met: true }),
      buildIncident({ id: "inc-3", submitted_at: "2026-07-07T04:00:00Z", sla_met: false }),
      // Still open (resolved_at: null) — Task 1.2: excluded from the bucket's
      // total/met entirely, not counted as a violation. Without this
      // exclusion the bucket would read 2/4 (50%, 2 violations) instead of
      // 2/3 (66.7%, 1 violation).
      buildIncident({
        id: "inc-4",
        submitted_at: "2026-07-08T04:00:00Z",
        status: "open",
        resolved_at: null,
        sla_met: false,
      }),
    ];

    const points = getSlaTrend(incidents, null);

    expect(points).toEqual([{ label: "Jul 2026", compliancePct: 66.7, violations: 1 }]);
  });

  // Admin Portal Fix Plan, Phase 1 final review, finding 1: a bucket can
  // exist (there's an incident submitted in it) while having zero SCOREABLE
  // rows (the one incident is still open). compliancePct must read null,
  // not 0 — a bare `bucket.total > 0 ? ... : 0` fallback here reads as
  // "everyone violated SLA this month" when the true answer is "nothing was
  // scoreable yet." violations still reads 0 (0 total - 0 met), which is
  // honest on its own terms (no violations recorded either).
  it("compliancePct is null, not 0, for a month whose only incident is still open", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-07-05T04:00:00Z", status: "open", resolved_at: null }),
    ];

    const points = getSlaTrend(incidents, null);

    expect(points).toEqual([{ label: "Jul 2026", compliancePct: null, violations: 0 }]);
  });

  // The mirror-image case: the bucket DOES have scoreable incidents, and all
  // of them missed SLA — a genuine 0%, not a null/unavailable case, since
  // there IS a real denominator (1 scoreable incident) to divide by. Pins
  // that a fix for the case above does not overcorrect into treating every
  // 0% bucket as null.
  it("compliancePct is a real 0%, not null, when the bucket has scoreable incidents and none met SLA", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-07-05T04:00:00Z", resolved_at: "2026-07-06T04:00:00Z", sla_met: false }),
    ];

    const points = getSlaTrend(incidents, null);

    expect(points).toEqual([{ label: "Jul 2026", compliancePct: 0, violations: 1 }]);
  });

  // YC-12 (yc_on_status_change(), Sandbox zqsqenfoszgcunvpqvvg): Yellow
  // Card's SLA clock pauses while an application sits in
  // revision_requested; an incident's clock runs continuously regardless of
  // who is holding it. "These two rules look inconsistent. They are
  // deliberate. Do not unify them." getSlaTrend must derive purely from
  // incidents — its signature no longer even accepts an applications array,
  // so there is nothing for a Yellow Card row to blend into here. This
  // fixture pins the incidents-only result on its own terms.
  it("is incidents-only — derives purely from the incidents array, no applications parameter exists to blend in", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-07-05T04:00:00Z", sla_met: true }),
      buildIncident({ id: "inc-2", submitted_at: "2026-07-06T04:00:00Z", sla_met: true }),
    ];

    const points = getSlaTrend(incidents, null);

    expect(points).toEqual([{ label: "Jul 2026", compliancePct: 100, violations: 0 }]);
  });

  it("skips a row with no submitted_at rather than crashing or miscounting", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: null, sla_met: true }),
      buildIncident({ id: "inc-2", submitted_at: "2026-07-05T04:00:00Z", sla_met: true }),
    ];

    const points = getSlaTrend(incidents, null);

    expect(points).toEqual([{ label: "Jul 2026", compliancePct: 100, violations: 0 }]);
  });

  it("applies filterByDateRange against submitted_at", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-07-10T04:00:00Z", sla_met: true }),
      buildIncident({ id: "inc-2", submitted_at: "2026-06-10T04:00:00Z", sla_met: false }),
    ];

    const points = getSlaTrend(incidents, { from: "2026-07-01", to: "2026-07-31" });

    expect(points).toEqual([{ label: "Jul 2026", compliancePct: 100, violations: 0 }]);
  });

  it("returns [] when there are no rows at all", () => {
    const points = getSlaTrend([], null);

    expect(points).toEqual([]);
  });

  // Regression guard: computeTrendBuckets' own MANILA_TIME_ZONE constant
  // (sla.ts) is currently unguarded — every other fixture in this file uses
  // T04:00:00Z (12:00 Manila), which lands in the same calendar month
  // whether bucketed by UTC or by Manila, so a UTC-anchored bucketer would
  // leave the whole suite green. This fixture sits in the boundary window
  // instead: 2026-07-31T16:30:00Z is Jul 31 in UTC but 2026-08-01 00:30 in
  // Manila, the same l24/l31 bug class filterByDateRange/presetDateRange
  // already guard in src/portals/admin/lib/dates.ts. A UTC-anchored bucketer places this row
  // in the July bucket; the correct, Manila-anchored bucketer places it in
  // August.
  it("buckets an incident submitted in the 16:00-23:59 UTC boundary window into its Manila month, not the UTC month", () => {
    const incidents = [buildIncident({ id: "inc-1", submitted_at: "2026-07-31T16:30:00Z", sla_met: true })];

    const points = getSlaTrend(incidents, null);

    expect(points.map((point) => point.label)).toEqual(["Aug 2026"]);
  });

  // Fix round 1, finding 3. The fixture buckets the same incident into
  // different months depending on basis: submitted in June, resolved in
  // July — so "request" produces a June point and "resolution" produces a
  // July point instead.
  it("dateBasis='resolution' buckets by resolved_at's month instead of submitted_at's", () => {
    const incidents = [
      buildIncident({
        id: "inc-1",
        submitted_at: "2026-06-28T04:00:00Z",
        resolved_at: "2026-07-02T04:00:00Z",
        sla_met: true,
      }),
    ];

    const requestBasis = getSlaTrend(incidents, null, "request");
    expect(requestBasis.map((point) => point.label)).toEqual(["Jun 2026"]);

    const resolutionBasis = getSlaTrend(incidents, null, "resolution");
    expect(resolutionBasis.map((point) => point.label)).toEqual(["Jul 2026"]);
  });
});

describe("getSlaMonthlyHistory", () => {
  it("returns the per-month total/on-time/avg-response breakdown getSlaTrend discards", () => {
    const incidents = [
      buildIncident({
        id: "inc-1",
        submitted_at: "2026-07-05T00:00:00Z",
        resolved_at: "2026-07-07T00:00:00Z",
        sla_met: true,
      }),
      buildIncident({
        id: "inc-2",
        submitted_at: "2026-07-06T00:00:00Z",
        resolved_at: "2026-07-09T00:00:00Z",
        sla_met: false,
      }),
    ];

    const rows = getSlaMonthlyHistory(incidents, null);

    expect(rows).toEqual([
      {
        label: "Jul 2026",
        compliancePct: 50,
        violations: 1,
        totalRequests: 2,
        onTime: 1,
        // (2 days + 3 days) / 2 = 2.5
        avgResponseDays: 2.5,
      },
    ]);
  });

  it("avgResponseDays is 0, not NaN, for a month with no resolved incidents", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-07-05T00:00:00Z", resolved_at: null, sla_met: false }),
    ];

    const rows = getSlaMonthlyHistory(incidents, null);

    expect(rows[0].avgResponseDays).toBe(0);
  });

  // Task 1.2 regression guard, updated for Phase 1 final review finding 1: a
  // bucket can exist (the month has an incident in it) while having zero
  // SCOREABLE rows (the one incident is still open) — total/met both 0.
  // compliancePct must read null, not 0/NaN, from a 0/0 division — a plain
  // `: 0` fallback would read as "everyone violated SLA this month" when the
  // true answer is "nothing was scoreable yet." violations/totalRequests/
  // onTime still read 0, which is honest on its own terms.
  it("compliancePct is null, not 0 or NaN, for a month whose only incident is still open", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-07-05T00:00:00Z", status: "open", resolved_at: null }),
    ];

    const rows = getSlaMonthlyHistory(incidents, null);

    expect(rows).toEqual([
      { label: "Jul 2026", compliancePct: null, violations: 0, totalRequests: 0, onTime: 0, avgResponseDays: 0 },
    ]);
  });

  // The mirror-image case: the bucket DOES have a scoreable incident, and it
  // missed SLA — a genuine 0%, not null, since there IS a real denominator
  // (1 scoreable incident, totalRequests: 1) to divide by.
  it("compliancePct is a real 0%, not null, when the bucket has a scoreable incident and it missed SLA", () => {
    const incidents = [
      buildIncident({
        id: "inc-1",
        submitted_at: "2026-07-05T00:00:00Z",
        resolved_at: "2026-07-06T00:00:00Z",
        sla_met: false,
      }),
    ];

    const rows = getSlaMonthlyHistory(incidents, null);

    expect(rows).toEqual([
      { label: "Jul 2026", compliancePct: 0, violations: 1, totalRequests: 1, onTime: 0, avgResponseDays: 1 },
    ]);
  });

  it("is incidents-only, matching getSlaTrend — no applications parameter exists to blend in", () => {
    const incidents = [
      // resolved_at set (same day as submitted_at, so avgResponseDays stays
      // 0) so this incident is actually scoreable under the Task 1.2 fix —
      // this test's own point is that the signature has no applications
      // parameter at all, not incidentMet's open/resolved boundary, which
      // has its own coverage in the getSlaTrend describe block.
      buildIncident({
        id: "inc-1",
        submitted_at: "2026-07-05T00:00:00Z",
        resolved_at: "2026-07-05T00:00:00Z",
        sla_met: true,
      }),
    ];

    const rows = getSlaMonthlyHistory(incidents, null);

    expect(rows).toEqual([
      { label: "Jul 2026", compliancePct: 100, violations: 0, totalRequests: 1, onTime: 1, avgResponseDays: 0 },
    ]);
  });

  it("respects dateBasis, same as getSlaTrend", () => {
    const incidents = [
      buildIncident({
        id: "inc-1",
        submitted_at: "2026-06-28T04:00:00Z",
        resolved_at: "2026-07-02T04:00:00Z",
        sla_met: true,
      }),
    ];

    const resolutionBasis = getSlaMonthlyHistory(incidents, null, "resolution");
    expect(resolutionBasis.map((row) => row.label)).toEqual(["Jul 2026"]);
  });
});

describe("departmentStatus", () => {
  // Admin Portal Fix Plan Task 5.2: SLA_TARGET_PCT was dropped from 95 to 85
  // to match the capstone description's published target ("Maintain ≥ 85%
  // compliance across all service modules"). Task 5.2 itself rescaled the
  // intermediate bands to 70/50 (the plan's own throwaway "e.g. 85/70/50"
  // example) — the final review caught that this widened the "Needs
  // attention" alerting threshold from 15 points below target to 35, a real
  // undecided behavior change. The controller's ruling (Fix 3) tightened the
  // bands to 75/65 instead: same 85% target, but restores roughly the
  // original ~15-point alerting sensitivity (20 points below target here).
  it("uses the 85/75/65 thresholds: >=85 Meeting target, >=75 Near target, >=65 Below target, else Needs attention", () => {
    expect(departmentStatus(85)).toBe("Meeting target");
    expect(departmentStatus(84.9)).toBe("Near target");
    expect(departmentStatus(75)).toBe("Near target");
    expect(departmentStatus(74.9)).toBe("Below target");
    expect(departmentStatus(65)).toBe("Below target");
    expect(departmentStatus(64.9)).toBe("Needs attention");
  });

  it("uses SLA_TARGET_PCT as the Meeting-target threshold", () => {
    expect(departmentStatus(SLA_TARGET_PCT)).toBe("Meeting target");
  });
});

describe("getSlaRangeStats", () => {
  const range = { from: "2026-07-01", to: "2026-07-31" };

  it("pools incidents and applications into responses/violations/compliancePct", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-07-05T04:00:00Z", sla_met: true }),
      buildIncident({ id: "inc-2", submitted_at: "2026-07-06T04:00:00Z", sla_met: false }),
    ];
    const applications = [
      buildApplication({ id: "app-1", submitted_at: "2026-07-07T04:00:00Z", sla_breached: false }),
    ];

    const stats = getSlaRangeStats(incidents, applications, range);

    expect(stats.responses).toBe(3);
    expect(stats.violations).toBe(1);
    expect(stats.compliancePct).toBe(round1((2 / 3) * 100));
  });

  // Regression guard for the sla_breached-for-pending fix: a pending/
  // resubmitted/revision_requested application's SLA status is unknown, not
  // "met" or "not met" (see applicationMet's doc comment), so it must be
  // excluded from responses/violations/compliancePct entirely, not folded
  // into either side. Fixture chosen so a leak is visible either way: if the
  // two non-terminal applications leaked in and were (wrongly) treated as
  // met, compliancePct would read 100/100%; if treated as unmet, it would
  // read 2/4 (50%). Only the one decided, met application counts.
  it("excludes pending/resubmitted applications from responses/violations/compliancePct in the current period", () => {
    const incidents = [buildIncident({ id: "inc-1", submitted_at: "2026-07-05T04:00:00Z", sla_met: true })];
    const applications = [
      buildApplication({ id: "app-1", submitted_at: "2026-07-06T04:00:00Z", status: "approved", sla_breached: false }),
      buildApplication({ id: "app-2", submitted_at: "2026-07-07T04:00:00Z", status: "pending", sla_breached: true }),
      buildApplication({
        id: "app-3",
        submitted_at: "2026-07-08T04:00:00Z",
        status: "resubmitted",
        sla_breached: false,
      }),
    ];

    const stats = getSlaRangeStats(incidents, applications, range);

    expect(stats.responses).toBe(2);
    expect(stats.violations).toBe(0);
    expect(stats.compliancePct).toBe(100);
    // totalInRange counts every filed row (1 incident + 3 applications),
    // BEFORE the scoreable-only filter responses applies — the gap (4 vs 2)
    // is what the Responses tile's caption surfaces on screen (Phase 1 final
    // review, finding 3).
    expect(stats.totalInRange).toBe(4);
  });

  // Admin Portal Fix Plan, Task 1.5: zero SLA-scoreable requests in range at
  // all (no incidents, no applications) must read compliancePct: null, never
  // a fabricated 0% — the "SLA Compliance 0%" false signal this task exists
  // to fix. Render via formatRate (src/portals/admin/lib/aggregate.ts), which turns this
  // null into "—".
  it("compliancePct is null, not 0, when there are zero SLA-scoreable requests in range", () => {
    const stats = getSlaRangeStats([], [], range);

    expect(stats.responses).toBe(0);
    expect(stats.compliancePct).toBeNull();
  });

  // The mirror-image path Task 1.1/1.2 already exercise elsewhere: rows
  // DO exist in range, but every one of them is excluded as not-yet-
  // scoreable (still-pending applications, still-open incidents) — the same
  // empty-denominator outcome as "nothing in range at all" above, just
  // reached via exclusion rather than absence.
  it("compliancePct is null, not 0, when rows exist in range but none are scoreable yet", () => {
    const incidents = [
      buildIncident({ id: "inc-1", submitted_at: "2026-07-05T04:00:00Z", status: "open", resolved_at: null }),
    ];
    const applications = [
      buildApplication({ id: "app-1", submitted_at: "2026-07-06T04:00:00Z", status: "pending" }),
    ];

    const stats = getSlaRangeStats(incidents, applications, range);

    expect(stats.responses).toBe(0);
    expect(stats.compliancePct).toBeNull();
  });

  // Same rule, applied to the PREVIOUS period this time: previousResponses/
  // previousViolations (which feed responsesDelta/violationsDelta) must
  // exclude non-decided applications too, not just the current period's.
  // Fixture: current period has 1 incident + 1 decided (met) application =
  // 2 responses, 0 violations. Previous period has 1 decided (unmet)
  // application plus 1 resubmitted application that must be excluded — if
  // the resubmitted row leaked into previousResponses/previousViolations,
  // responsesDelta would read "+0%" (2 -> 2) instead of "+100%" (1 -> 2),
  // and violationsDelta would read "-2" instead of "-1".
  it("excludes pending/resubmitted applications from responses/violations in the previous period too", () => {
    const incidents = [buildIncident({ id: "inc-1", submitted_at: "2026-07-05T04:00:00Z", sla_met: true })];
    const applications = [
      buildApplication({ id: "app-1", submitted_at: "2026-07-06T04:00:00Z", status: "approved", sla_breached: false }),
      buildApplication({ id: "app-2", submitted_at: "2026-06-10T04:00:00Z", status: "rejected", sla_breached: true }),
      buildApplication({
        id: "app-3",
        submitted_at: "2026-06-11T04:00:00Z",
        status: "resubmitted",
        sla_breached: true,
      }),
    ];

    const stats = getSlaRangeStats(incidents, applications, range);

    expect(stats.responsesDelta).toBe("+100% vs previous period");
    expect(stats.violationsDelta).toBe("-1 vs previous period");
  });

  // Averaging incidents' continuous clock together with Yellow Card's
  // pauses-while-with-citizen clock would not be a faithful reading of
  // either (see getSlaTrend's doc comment); avgResponseDays must come from
  // incidents alone. This fixture is chosen so an accidentally-blended
  // implementation would produce a visibly different number: the one
  // resolved incident took 2 days; if the Yellow Card application's (much
  // longer) decided_at - submitted_at span were folded in, the average would
  // shift.
  it("avgResponseDays is incidents-only, not blended with Yellow Card", () => {
    const incidents = [
      buildIncident({
        id: "inc-1",
        submitted_at: "2026-07-05T00:00:00Z",
        resolved_at: "2026-07-07T00:00:00Z",
        sla_met: true,
      }),
    ];
    const applications = [
      buildApplication({
        id: "app-1",
        submitted_at: "2026-07-01T00:00:00Z",
        decided_at: "2026-07-20T00:00:00Z",
        sla_breached: false,
      }),
    ];

    const stats = getSlaRangeStats(incidents, applications, range);

    expect(stats.avgResponseDays).toBe(2);
  });

  it("trend matches getSlaTrend's own output for the same range", () => {
    const incidents = [buildIncident({ id: "inc-1", submitted_at: "2026-07-05T04:00:00Z", sla_met: true })];

    const stats = getSlaRangeStats(incidents, [], range);
    const trend = getSlaTrend(incidents, range);

    expect(stats.trend).toEqual(trend);
  });

  it("rejects a null range rather than silently reading every row ever filed", () => {
    expect(() => getSlaRangeStats([], [], null)).toThrow();
  });

  // Fix round 1, finding 3: dateBasis must reach every filter this function
  // applies, not just get threaded to getSlaTrend. The incident is
  // submitted in June and resolved in July; only "resolution" should count
  // it toward the July range at all.
  it("dateBasis is threaded through to every date filter, not just getSlaTrend", () => {
    const incidents = [
      buildIncident({
        id: "inc-1",
        submitted_at: "2026-06-28T04:00:00Z",
        resolved_at: "2026-07-05T04:00:00Z",
        sla_met: true,
      }),
    ];

    const requestBasis = getSlaRangeStats(incidents, [], range, "request");
    expect(requestBasis.responses).toBe(0);

    const resolutionBasis = getSlaRangeStats(incidents, [], range, "resolution");
    expect(resolutionBasis.responses).toBe(1);
  });

  function round1(value: number): number {
    return Math.round(value * 10) / 10;
  }
});
