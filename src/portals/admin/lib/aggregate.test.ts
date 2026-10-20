// src/portals/admin/lib/aggregate.test.ts
//
// These are pure functions over hand-built row arrays — no Supabase client,
// no vi.mock, nothing async. That is deliberate: aggregate.ts's whole job
// is to be testable without mocking anything.
import {
  averageResolutionDays,
  barangayCoverage,
  barangayIncidentRows,
  barangayTotal,
  categoryMix,
  conventionRangeStats,
  countDelta,
  daysDelta,
  eventTypeMix,
  formatRate,
  incidentSlaHours,
  issueRangeStats,
  monthlyCounts,
  percentDelta,
  pointsDelta,
  previousPeriodRange,
  venueUtilisation,
  yellowCardRangeStats,
} from "@/portals/admin/lib/aggregate";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { BookingRow } from "@/portals/admin/features/booking/lib/bookings";
import type { VenueRow } from "@/portals/admin/lib/supabase/catalogs";

function buildYellowCardRow(overrides: Partial<YellowCardRow> = {}): YellowCardRow {
  return {
    id: "app-1",
    reference_number: "YC-0001",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    status: "pending",
    submitted_at: "2026-05-15T00:00:00Z",
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
    submitted_at: "2026-05-15T00:00:00Z",
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
    event_date: "2026-06-01",
    start_time: "09:00:00",
    duration_hours: 4,
    total_fee: 1000,
    status: "confirmed",
    submitted_at: "2026-05-15T00:00:00Z",
    lead_time_days: 17,
    cancellation_reason: null,
    completed_at: null,
    confirmed_at: null,
    quoted_at: null,
    tier_verified: null,
    ...overrides,
  };
}

function buildVenueRow(overrides: Partial<VenueRow> = {}): VenueRow {
  return {
    code: "ATRIUM",
    label: "Atrium",
    capacity_label: "Capacity: 1,000 pax",
    is_hourly: false,
    sort_order: 1,
    ...overrides,
  };
}

describe("barangayCoverage", () => {
  it("counts approved/pending/rejected per barangay", () => {
    const result = barangayCoverage([
      buildYellowCardRow({ barangay_name: "Barangay One", status: "approved" }),
      buildYellowCardRow({ barangay_name: "Barangay One", status: "pending" }),
      buildYellowCardRow({ barangay_name: "Barangay One", status: "rejected" }),
      buildYellowCardRow({ barangay_name: "Barangay Two", status: "approved" }),
    ]);

    expect(result).toEqual([
      { barangay: "Barangay One", approved: 1, pending: 1, rejected: 1 },
      { barangay: "Barangay Two", approved: 1, pending: 0, rejected: 0 },
    ]);
  });

  it("buckets still-in-flight statuses (resubmitted, revision_requested, null) as pending", () => {
    const result = barangayCoverage([
      buildYellowCardRow({ barangay_name: "Barangay One", status: "resubmitted" }),
      buildYellowCardRow({ barangay_name: "Barangay One", status: "revision_requested" }),
      buildYellowCardRow({ barangay_name: "Barangay One", status: null }),
    ]);

    expect(result).toEqual([{ barangay: "Barangay One", approved: 0, pending: 3, rejected: 0 }]);
  });

  // Fix round 1, item 1: "withdrawn" is terminal (the citizen took the
  // application back), not in-flight — it must not inflate the pending
  // bucket the panel reports as backlog. It must not land in approved or
  // rejected either, since neither happened.
  it("excludes withdrawn applications from all three buckets, not folded into pending", () => {
    const result = barangayCoverage([
      buildYellowCardRow({ barangay_name: "Barangay One", status: "approved" }),
      buildYellowCardRow({ barangay_name: "Barangay One", status: "withdrawn" }),
    ]);

    // The withdrawn row must not change the barangay's totals at all: same
    // as if it had never been fetched.
    expect(result).toEqual([{ barangay: "Barangay One", approved: 1, pending: 0, rejected: 0 }]);
  });

  // The mirror-image edge case: a barangay whose ONLY application was
  // withdrawn has zero counted coverage, so it must be absent from the
  // result — same as a barangay that filed nothing at all — not present
  // with all-zero counts.
  it("omits a barangay whose only applications were withdrawn", () => {
    const result = barangayCoverage([
      buildYellowCardRow({ barangay_name: "Barangay One", status: "approved" }),
      buildYellowCardRow({ barangay_name: "Barangay Two", status: "withdrawn" }),
    ]);

    expect(result).toEqual([{ barangay: "Barangay One", approved: 1, pending: 0, rejected: 0 }]);
    expect(result.find((row) => row.barangay === "Barangay Two")).toBeUndefined();
  });

  // The pinned edge case: a barangay that filed nothing must not appear at
  // all, not show up with { approved: 0, pending: 0, rejected: 0 }.
  it("omits a barangay with zero rows instead of showing it with all-zero counts", () => {
    const result = barangayCoverage([
      buildYellowCardRow({ barangay_name: "Barangay One", status: "approved" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result.find((row) => row.barangay === "Barangay Two")).toBeUndefined();
    expect(result.every((row) => row.approved + row.pending + row.rejected > 0)).toBe(true);
  });

  it("falls back to barangay_code, then Unknown barangay, when barangay_name is missing", () => {
    const result = barangayCoverage([
      buildYellowCardRow({ barangay_name: null, barangay_code: "BGY-9", status: "approved" }),
      buildYellowCardRow({ barangay_name: null, barangay_code: null, status: "pending" }),
    ]);

    expect(result).toEqual(
      expect.arrayContaining([
        { barangay: "BGY-9", approved: 1, pending: 0, rejected: 0 },
        { barangay: "Unknown barangay", approved: 0, pending: 1, rejected: 0 },
      ])
    );
  });
});

describe("barangayTotal", () => {
  it("sums the three status buckets", () => {
    expect(barangayTotal({ barangay: "X", approved: 3, pending: 2, rejected: 1 })).toBe(6);
  });
});

describe("monthlyCounts", () => {
  it("buckets rows into Manila calendar months, ordered oldest-first", () => {
    const rows = [
      buildYellowCardRow({ submitted_at: "2026-03-10T00:00:00Z" }),
      buildYellowCardRow({ submitted_at: "2026-01-05T00:00:00Z" }),
      buildYellowCardRow({ submitted_at: "2026-01-20T00:00:00Z" }),
    ];

    const result = monthlyCounts(rows, (row) => row.submitted_at);

    expect(result).toEqual([
      { month: "Jan", count: 2 },
      { month: "Mar", count: 1 },
    ]);
  });

  // THE GUARD. 2026-04-30T16:30:00Z is 2026-05-01T00:30:00+08:00 in Manila —
  // 30 minutes into May, Manila time — even though the UTC instant is still
  // April 30th. A getUTCMonth()/getMonth()-based bucket would file this under
  // April; the Manila-anchored bucket must file it under May. This is the
  // same defect class fixed by migrations l24 and l31 (see src/portals/admin/lib/dates.ts).
  it("a row filed at 00:30 Manila on the 1st (16:30 UTC the prior day) lands in the NEW Manila month, not the UTC one", () => {
    const result = monthlyCounts(
      [buildYellowCardRow({ submitted_at: "2026-04-30T16:30:00Z" })],
      (row) => row.submitted_at
    );

    expect(result).toEqual([{ month: "May", count: 1 }]);
  });

  // The mirror-image boundary check: 15:59 UTC on the same day is still
  // 23:59 Manila on April 30th, one minute before the Manila month rolls
  // over, so it must stay in April.
  it("a row filed at 23:59 Manila on the last day of the month (15:59 UTC) stays in the OLD Manila month", () => {
    const result = monthlyCounts(
      [buildYellowCardRow({ submitted_at: "2026-04-30T15:59:00Z" })],
      (row) => row.submitted_at
    );

    expect(result).toEqual([{ month: "Apr", count: 1 }]);
  });

  it("skips rows with a null or unparseable date instead of crashing or miscounting", () => {
    const result = monthlyCounts(
      [
        buildYellowCardRow({ submitted_at: null }),
        buildYellowCardRow({ submitted_at: "not-a-date" }),
        buildYellowCardRow({ submitted_at: "2026-02-01T00:00:00Z" }),
      ],
      (row) => row.submitted_at
    );

    expect(result).toEqual([{ month: "Feb", count: 1 }]);
  });
});

describe("categoryMix", () => {
  it("counts rows per category_code, most-common first", () => {
    const result = categoryMix([
      buildIncidentRow({ category_code: "sanitation" }),
      buildIncidentRow({ category_code: "infrastructure" }),
      buildIncidentRow({ category_code: "infrastructure" }),
    ]);

    expect(result).toEqual([
      { category: "infrastructure", count: 2 },
      { category: "sanitation", count: 1 },
    ]);
  });

  // The pinned edge case: a category no row belongs to must not appear with
  // count 0 — it's simply absent from the result.
  it("omits a category with no rows", () => {
    const result = categoryMix([buildIncidentRow({ category_code: "infrastructure" })]);

    expect(result).toEqual([{ category: "infrastructure", count: 1 }]);
    expect(result.find((slice) => slice.category === "public_safety")).toBeUndefined();
  });

  it("groups a null category_code under uncategorized rather than dropping the row", () => {
    const result = categoryMix([buildIncidentRow({ category_code: null })]);

    expect(result).toEqual([{ category: "uncategorized", count: 1 }]);
  });
});

describe("eventTypeMix", () => {
  it("counts rows per event_type_code, most-common first", () => {
    const result = eventTypeMix([
      buildBookingRow({ event_type_code: "wedding" }),
      buildBookingRow({ event_type_code: "conference" }),
      buildBookingRow({ event_type_code: "conference" }),
    ]);

    expect(result).toEqual([
      { type: "conference", count: 2 },
      { type: "wedding", count: 1 },
    ]);
  });

  // Same "absent, not zero" rule as categoryMix, over booking rows.
  it("omits an event type with no rows", () => {
    const result = eventTypeMix([buildBookingRow({ event_type_code: "conference" })]);

    expect(result.find((slice) => slice.type === "wedding")).toBeUndefined();
  });
});

describe("venueUtilisation", () => {
  // THE PINNED EDGE CASE, deliberately the mirror image of barangayCoverage's:
  // a venue nobody booked is still a real, nameable venue — an unused venue
  // is a signal worth showing, not an absence to hide.
  it("includes a venue with zero bookings, showing bookings: 0", () => {
    const venues = [buildVenueRow({ code: "ATRIUM", label: "Atrium" }), buildVenueRow({ code: "ARENA", label: "Sports Arena" })];
    const rows = [buildBookingRow({ venue_code: "ATRIUM" })];

    const result = venueUtilisation(rows, venues);

    expect(result).toEqual([
      expect.objectContaining({ venue: "Atrium", bookings: 1 }),
      expect.objectContaining({ venue: "Sports Arena", bookings: 0 }),
    ]);
  });

  it("carries capacityLabel from the venue catalog and always passes avgFillPct: null", () => {
    const venues = [buildVenueRow({ code: "ATRIUM", label: "Atrium", capacity_label: "Capacity: 1,000 pax" })];

    const result = venueUtilisation([], venues);

    expect(result).toEqual([
      {
        venue: "Atrium",
        capacityLabel: "Capacity: 1,000 pax",
        avgFillPct: null,
        bookings: 0,
        barClass: "bg-blue-800",
      },
    ]);
  });

  it("ignores bookings for a venue_code not present in the venue catalog", () => {
    const venues = [buildVenueRow({ code: "ATRIUM", label: "Atrium" })];
    const rows = [buildBookingRow({ venue_code: "GHOST-VENUE" })];

    const result = venueUtilisation(rows, venues);

    expect(result).toEqual([expect.objectContaining({ venue: "Atrium", bookings: 0 })]);
  });
});

describe("barangayIncidentRows", () => {
  it("counts reports per barangay and picks the top category", () => {
    const result = barangayIncidentRows([
      buildIncidentRow({ barangay_name: "Barangay One", category_code: "infrastructure" }),
      buildIncidentRow({ barangay_name: "Barangay One", category_code: "infrastructure" }),
      buildIncidentRow({ barangay_name: "Barangay One", category_code: "sanitation" }),
      buildIncidentRow({ barangay_name: "Barangay Two", category_code: "public_safety" }),
    ]);

    expect(result).toEqual([
      { barangay: "Barangay One", reports: 3, topCategory: "infrastructure", topCategoryCount: 2 },
      { barangay: "Barangay Two", reports: 1, topCategory: "public_safety", topCategoryCount: 1 },
    ]);
  });

  // THE PINNED EDGE CASE: two categories tied 1-1 for a barangay must resolve
  // to the same category every time, regardless of which row (and therefore
  // which Map insertion order) came first — "environmental" sorts before
  // "infrastructure" alphabetically, so it wins the tie even though
  // "infrastructure" was inserted first here.
  it("breaks a tied top-category by ascending category code, not by row/insertion order", () => {
    const result = barangayIncidentRows([
      buildIncidentRow({ barangay_name: "Barangay One", category_code: "infrastructure" }),
      buildIncidentRow({ barangay_name: "Barangay One", category_code: "environmental" }),
    ]);

    expect(result).toEqual([
      { barangay: "Barangay One", reports: 2, topCategory: "environmental", topCategoryCount: 1 },
    ]);
  });

  it("breaks a tied barangay report count by ascending barangay name", () => {
    const result = barangayIncidentRows([
      buildIncidentRow({ barangay_name: "Zeta", category_code: "infrastructure" }),
      buildIncidentRow({ barangay_name: "Alpha", category_code: "infrastructure" }),
    ]);

    expect(result.map((row) => row.barangay)).toEqual(["Alpha", "Zeta"]);
  });
});

describe("previousPeriodRange", () => {
  it("returns the immediately preceding range with the same span", () => {
    // July 1-31 is 31 days; the immediately preceding 31-day span ends June
    // 30 and, since June only has 30 days, starts May 31.
    expect(previousPeriodRange({ from: "2026-07-01", to: "2026-07-31" })).toEqual({
      from: "2026-05-31",
      to: "2026-06-30",
    });
  });

  it("handles a single-day range", () => {
    expect(previousPeriodRange({ from: "2026-07-15", to: "2026-07-15" })).toEqual({
      from: "2026-07-14",
      to: "2026-07-14",
    });
  });

  it("crosses a year boundary", () => {
    expect(previousPeriodRange({ from: "2026-01-01", to: "2026-01-31" })).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});

describe("percentDelta", () => {
  it("computes a relative percent change", () => {
    expect(percentDelta(110, 100)).toBe("+10% vs previous period");
    expect(percentDelta(90, 100)).toBe("-10% vs previous period");
  });

  it("reads 'New activity' rather than dividing by zero when previous is 0 and current is not", () => {
    expect(percentDelta(5, 0)).toBe("New activity vs previous period");
  });

  it("reads 'No activity' when both current and previous are 0", () => {
    expect(percentDelta(0, 0)).toBe("No activity vs previous period");
  });
});

describe("formatRate", () => {
  it("renders a non-null rate as a rounded percentage", () => {
    expect(formatRate(62.5)).toBe("62.5%");
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(100)).toBe("100%");
  });

  // THE PINNED EDGE CASE this task exists to fix: a zero-denominator rate
  // (decidedRatePct/resolvedRatePct/the pooled SLA compliance calcs all
  // return null for it) must render as "—", never "0%" — the false signal
  // that misreports a quiet period as a wave of rejections or breaches.
  it("renders null as '—', never '0%'", () => {
    expect(formatRate(null)).toBe("—");
  });
});

describe("pointsDelta", () => {
  it("computes a signed percentage-point change", () => {
    expect(pointsDelta(87.2, 84.6)).toBe("+2.6 pts vs previous period");
    expect(pointsDelta(84.6, 87.2)).toBe("-2.6 pts vs previous period");
  });
});

describe("countDelta", () => {
  it("computes a signed integer change", () => {
    expect(countDelta(25, 30)).toBe("-5 vs previous period");
    expect(countDelta(30, 25)).toBe("+5 vs previous period");
  });
});

describe("daysDelta", () => {
  it("reads faster when the duration shrank", () => {
    expect(daysDelta(1.7, 2.1)).toBe("0.4d faster vs previous period");
  });

  it("reads slower when the duration grew", () => {
    expect(daysDelta(2.1, 1.7)).toBe("0.4d slower vs previous period");
  });

  it("reads 'No change' when the duration is identical", () => {
    expect(daysDelta(1.8, 1.8)).toBe("No change vs previous period");
  });
});

describe("averageResolutionDays", () => {
  it("averages resolved_at - submitted_at in days across resolved incidents", () => {
    const result = averageResolutionDays([
      buildIncidentRow({ submitted_at: "2026-05-01T00:00:00Z", resolved_at: "2026-05-03T00:00:00Z" }),
      buildIncidentRow({ submitted_at: "2026-05-01T00:00:00Z", resolved_at: "2026-05-02T00:00:00Z" }),
    ]);

    expect(result).toBe(1.5);
  });

  it("excludes unresolved incidents from the average rather than counting them as 0 days", () => {
    const result = averageResolutionDays([
      buildIncidentRow({ submitted_at: "2026-05-01T00:00:00Z", resolved_at: "2026-05-03T00:00:00Z" }),
      buildIncidentRow({ submitted_at: "2026-05-01T00:00:00Z", resolved_at: null }),
    ]);

    expect(result).toBe(2);
  });

  it("returns 0 when no incident in the set has resolved", () => {
    expect(averageResolutionDays([buildIncidentRow({ resolved_at: null })])).toBe(0);
  });
});

describe("yellowCardRangeStats", () => {
  const range = { from: "2026-05-01", to: "2026-05-31" };
  const getDate = (row: YellowCardRow) => row.submitted_at;

  it("counts applications and computes the approval rate within range", () => {
    const rows = [
      buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "approved" }),
      buildYellowCardRow({ submitted_at: "2026-05-11T00:00:00Z", status: "approved" }),
      buildYellowCardRow({ submitted_at: "2026-05-12T00:00:00Z", status: "rejected" }),
      // Outside range, must not count toward applications/approvalRatePct.
      buildYellowCardRow({ submitted_at: "2026-04-01T00:00:00Z", status: "approved" }),
    ];

    const result = yellowCardRangeStats(rows, range, getDate, 33);

    expect(result.applications).toBe(3);
    expect(result.approvalRatePct).toBe(round1((2 / 3) * 100));
    expect(result.barangaysTotal).toBe(33);
  });

  // Admin Portal Fix Plan, Task 1.5: zero DECIDED (approved + rejected)
  // applications in range must read approvalRatePct: null, never a
  // fabricated 0% that misreports "nothing decided yet" as "every
  // application was rejected". Render via formatRate, which turns this null
  // into "—".
  it("approvalRatePct is null, not 0, when there are zero decided applications in range", () => {
    const rows = [buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "pending" })];

    const result = yellowCardRangeStats(rows, range, getDate, 33);

    expect(result.applications).toBe(1);
    expect(result.approvalRatePct).toBeNull();
  });

  it("approvalRatePct is null when there are zero applications in range at all", () => {
    const result = yellowCardRangeStats([], range, getDate, 33);

    expect(result.applications).toBe(0);
    expect(result.approvalRatePct).toBeNull();
  });

  // approvalRateDelta must not coerce a null rate to 0 and report a
  // fabricated swing — it reads a plain "no comparable data" caption
  // whenever either side (current or previous period) has no decided
  // applications to compute a rate from.
  it("approvalRateDelta reads 'No comparable data' rather than a fabricated swing when either period has zero decided applications", () => {
    const rows = [
      // Current period (May): nothing decided yet.
      buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "pending" }),
      // Previous period (April): one decided application.
      buildYellowCardRow({ submitted_at: "2026-04-10T00:00:00Z", status: "approved" }),
    ];

    const result = yellowCardRangeStats(rows, range, getDate, 33);

    expect(result.approvalRatePct).toBeNull();
    expect(result.approvalRateDelta).toBe("No comparable data vs previous period");
  });

  it("pendingReview reads ALL rows, not just those in range — a point-in-time backlog", () => {
    const rows = [
      buildYellowCardRow({ submitted_at: "2026-01-01T00:00:00Z", status: "pending", sla_breached: true }),
      buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "resubmitted", sla_breached: false }),
      buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "approved" }),
      buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "withdrawn" }),
    ];

    const result = yellowCardRangeStats(rows, range, getDate, 33);

    expect(result.pendingReview).toBe(2);
  });

  // admin_yellow_card_analytics.sla_breached is only meaningful for DECIDED
  // applications — its underlying counter only accrues on status change
  // (see applicationMet's doc comment in src/portals/admin/features/sla/lib/sla.ts), so a pending row
  // reads sla_breached: false no matter how overdue it actually is.
  // pendingPastSla must therefore always be null (unavailable), never a
  // count derived from `sla_breached === true`, even when a pending row
  // happens to carry sla_breached: true — that combination cannot honestly
  // occur once the DB fix lands, but this pins that the client-side code no
  // longer trusts it either way in the meantime.
  it("pendingPastSla is unavailable (null), not a count derived from sla_breached", () => {
    const rows = [
      buildYellowCardRow({ submitted_at: "2026-01-01T00:00:00Z", status: "pending", sla_breached: true }),
      buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "resubmitted", sla_breached: false }),
      buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "approved" }),
      buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "withdrawn" }),
    ];

    const result = yellowCardRangeStats(rows, range, getDate, 33);

    expect(result.pendingPastSla).toBeNull();
  });

  it("barangaysReached counts distinct barangays with a counted application in range, barangaysWithZero fills the rest", () => {
    const rows = [
      buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", barangay_name: "Barangay One", status: "approved" }),
      buildYellowCardRow({ submitted_at: "2026-05-11T00:00:00Z", barangay_name: "Barangay Two", status: "pending" }),
    ];

    const result = yellowCardRangeStats(rows, range, getDate, 5);

    expect(result.barangaysReached).toBe(2);
    expect(result.barangaysWithZero).toBe(3);
  });

  // The total comes from public_barangays, which can fail to load
  // independently of the applications themselves. "How many barangays exist"
  // being unknown must not render as "zero barangays exist", which would make
  // the tile read "2 / 0" and the note claim -2 barangays have no applicants.
  // The "past NNh SLA" caption on the Pending Review tile used to hardcode
  // "48h". admin_yellow_card_analytics carries the real target per row in
  // sla_target_hours (driven by public_yellow_card_config's
  // processing_time_target_days, which Super Staff can change), so the
  // caption must read it rather than restate a copy of it.
  describe("pendingSlaTargetHours", () => {
    it("reports the SLA target the pending rows themselves carry", () => {
      const rows = [
        buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "pending", sla_target_hours: 72 }),
        buildYellowCardRow({ submitted_at: "2026-05-11T00:00:00Z", status: "resubmitted", sla_target_hours: 72 }),
      ];

      expect(yellowCardRangeStats(rows, range, getDate, 33).pendingSlaTargetHours).toBe(72);
    });

    it("is null when the pending rows disagree — there is no single figure to name", () => {
      const rows = [
        // An application filed before a save_yellow_card_config change keeps
        // the target it was created with, so a mixed backlog is real.
        buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "pending", sla_target_hours: 48 }),
        buildYellowCardRow({ submitted_at: "2026-05-11T00:00:00Z", status: "pending", sla_target_hours: 72 }),
      ];

      expect(yellowCardRangeStats(rows, range, getDate, 33).pendingSlaTargetHours).toBeNull();
    });

    it("is null when nothing is pending", () => {
      const rows = [buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", status: "approved" })];

      expect(yellowCardRangeStats(rows, range, getDate, 33).pendingSlaTargetHours).toBeNull();
    });
  });

  it("leaves barangaysTotal/barangaysWithZero null when the barangay count is unknown", () => {
    const rows = [
      buildYellowCardRow({ submitted_at: "2026-05-10T00:00:00Z", barangay_name: "Barangay One", status: "approved" }),
    ];

    const result = yellowCardRangeStats(rows, range, getDate, null);

    expect(result.barangaysReached).toBe(1);
    expect(result.barangaysTotal).toBeNull();
    expect(result.barangaysWithZero).toBeNull();
  });

  function round1(value: number): number {
    return Math.round(value * 10) / 10;
  }
});

describe("incidentSlaHours", () => {
  it("maps each public_incident_config column onto its incident_level key", () => {
    const result = incidentSlaHours({
      sla_hours_critical: 4,
      sla_hours_high: 8,
      sla_hours_medium: 24,
      sla_hours_low: 72,
      auto_close_day: 7,
      confirmation_window_days: 3,
      max_active_reports_per_citizen: 3,
      max_photos_per_cycle: 3,
      nudge_day: 5,
    });

    expect(result).toEqual({ critical: 4, high: 8, medium: 24, low: 72 });
  });

  it("returns null when the config row is null — an unfetched config is not a set of zero-hour targets", () => {
    expect(incidentSlaHours(null)).toBeNull();
  });

  it("omits a level whose column is null rather than defaulting it to 0", () => {
    const result = incidentSlaHours({
      sla_hours_critical: 4,
      sla_hours_high: null,
      sla_hours_medium: 24,
      sla_hours_low: 72,
      auto_close_day: null,
      confirmation_window_days: null,
      max_active_reports_per_citizen: null,
      max_photos_per_cycle: null,
      nudge_day: null,
    });

    expect(result).toEqual({ critical: 4, medium: 24, low: 72 });
  });
});

describe("issueRangeStats", () => {
  const range = { from: "2026-05-01", to: "2026-05-31" };
  const getDate = (row: IncidentRow) => row.submitted_at;
  // The real public_incident_config values on this deployment.
  const slaHours = { critical: 4, high: 8, medium: 24, low: 72 };

  it("counts reports and computes the resolution rate within range", () => {
    const rows = [
      buildIncidentRow({ submitted_at: "2026-05-10T00:00:00Z", status: "resolved" }),
      buildIncidentRow({ submitted_at: "2026-05-11T00:00:00Z", status: "open" }),
      buildIncidentRow({ submitted_at: "2026-04-01T00:00:00Z", status: "resolved" }),
    ];

    const result = issueRangeStats(rows, range, getDate, slaHours);

    expect(result.reports).toBe(2);
    expect(result.resolutionRatePct).toBe(50);
  });

  // Admin Portal Fix Plan, Task 1.5: zero incidents in range at all must
  // read resolutionRatePct: null, never a fabricated 0% — a quiet "Today"
  // preset with no incidents filed is not the same claim as "nothing got
  // resolved". Render via formatRate, which turns this null into "—".
  it("resolutionRatePct is null, not 0, when there are zero incidents in range", () => {
    const result = issueRangeStats([], range, getDate, slaHours);

    expect(result.reports).toBe(0);
    expect(result.resolutionRatePct).toBeNull();
  });

  // The mirror-image case: incidents DO exist in range but none are
  // resolved yet — this is a genuine 0%, not a null/unavailable case, since
  // there IS a real denominator (2 incidents) to divide by.
  it("resolutionRatePct is a real 0%, not null, when incidents exist in range but none are resolved", () => {
    const rows = [
      buildIncidentRow({ submitted_at: "2026-05-10T00:00:00Z", status: "open" }),
      buildIncidentRow({ submitted_at: "2026-05-11T00:00:00Z", status: "in_progress" }),
    ];

    const result = issueRangeStats(rows, range, getDate, slaHours);

    expect(result.reports).toBe(2);
    expect(result.resolutionRatePct).toBe(0);
  });

  // resolutionRateDelta must not coerce a null rate to 0 and report a
  // fabricated swing — it reads a plain "no comparable data" caption
  // whenever either period has zero incidents to compute a rate from.
  it("resolutionRateDelta reads 'No comparable data' rather than a fabricated swing when the current period has zero incidents", () => {
    const rows = [buildIncidentRow({ submitted_at: "2026-04-10T00:00:00Z", status: "resolved" })];

    const result = issueRangeStats(rows, range, getDate, slaHours);

    expect(result.resolutionRatePct).toBeNull();
    expect(result.resolutionRateDelta).toBe("No comparable data vs previous period");
  });

  // Regression guard: unlike the existing fixture below (all three rows
  // already sit inside `range`, so it cannot tell "all rows" apart from "just
  // the range-filtered slice"), this one has an open incident OUTSIDE
  // `range` entirely — the same point-in-time-backlog rule already pinned
  // for yellowCardRangeStats.pendingReview above. A version that reads the
  // date-filtered slice instead of `rows` would miss it and report 1, not 2.
  it("openBacklog counts an open incident even when its submitted_at falls outside range — a point-in-time backlog", () => {
    const rows = [
      buildIncidentRow({ submitted_at: "2026-05-10T00:00:00Z", status: "open" }),
      // Filed months before `range` (2026-05-01..31) — still open, still
      // part of the backlog right now, regardless of when it was filed.
      buildIncidentRow({ submitted_at: "2026-01-01T00:00:00Z", status: "in_progress" }),
      buildIncidentRow({ submitted_at: "2026-05-10T00:00:00Z", status: "resolved" }),
    ];

    const result = issueRangeStats(rows, range, getDate, slaHours);

    expect(result.openBacklog).toBe(2);
  });

  it("openBacklog reads ALL rows, not just those in range, while backlogPastSla stays unavailable", () => {
    const now = new Date("2026-05-20T00:00:00Z");
    const rows = [
      // 4 days old, medium (24h target) — from an earlier month.
      buildIncidentRow({ submitted_at: "2026-05-16T00:00:00Z", status: "open", incident_level: "medium" }),
      // 1 hour old, medium — well inside its 24h window.
      buildIncidentRow({ submitted_at: "2026-05-19T23:00:00Z", status: "in_progress", incident_level: "medium" }),
      buildIncidentRow({ submitted_at: "2026-05-10T00:00:00Z", status: "resolved" }),
    ];

    const result = issueRangeStats(rows, range, getDate, slaHours, now);

    expect(result.openBacklog).toBe(2);
    expect(result.backlogPastSla).toBeNull();
  });

  // Admin Portal Fix Plan, Task 1.3: backlogPastSla used to compute
  // `ageHours = now - submitted_at` per open row and compare it against
  // slaHours[row.incident_level] — today's LIVE config, not the target that
  // applied when the row was created. That counted never-armed (unverified)
  // incidents as breached purely for looking old, charged routing/
  // verification delay against the department, and re-judged old incidents
  // against a target Super Staff may have since changed. It is
  // unconditionally null now (see the doc comment above its assignment in
  // issueRangeStats, src/portals/admin/lib/aggregate.ts) regardless of level, config, or
  // how stale any row is — this pins that no combination of inputs revives
  // the old per-row computation.
  it("backlogPastSla is unavailable (null) regardless of level, staleness, or config — never a number computed from submitted_at", () => {
    const now = new Date("2026-05-20T00:00:00Z");
    const rows = [
      // Would have read as breached many times over under the old
      // submitted_at + live-config math (16 days old, critical = 4h target).
      buildIncidentRow({ submitted_at: "2026-05-04T00:00:00Z", status: "open", incident_level: "critical" }),
      buildIncidentRow({ submitted_at: "2026-05-19T19:00:00Z", status: "open", incident_level: "high" }),
      buildIncidentRow({ submitted_at: "2026-05-19T19:00:00Z", status: "open", incident_level: "low" }),
    ];

    const result = issueRangeStats(rows, range, getDate, slaHours, now);

    expect(result.openBacklog).toBe(3);
    expect(result.backlogPastSla).toBeNull();
  });

  it("backlogPastSla stays null even when the SLA config is unavailable too — doubly unknown, not zero", () => {
    const now = new Date("2026-05-20T00:00:00Z");
    const rows = [
      buildIncidentRow({ submitted_at: "2026-01-01T00:00:00Z", status: "open", incident_level: "critical" }),
    ];

    const result = issueRangeStats(rows, range, getDate, null, now);

    expect(result.openBacklog).toBe(1);
    expect(result.backlogPastSla).toBeNull();
  });
});

describe("conventionRangeStats", () => {
  const range = { from: "2026-05-01", to: "2026-05-31" };
  const getDate = (row: BookingRow) => row.submitted_at;

  it("counts bookings within range and computes a real delta against the previous period", () => {
    const rows = [
      buildBookingRow({ submitted_at: "2026-05-10T00:00:00Z" }),
      buildBookingRow({ submitted_at: "2026-05-11T00:00:00Z" }),
      // The previous period for May 1-31 (31 days) is April 1-30 — this row
      // falls inside it, so bookingsDelta compares 2 (current) against 1
      // (previous), not against 0.
      buildBookingRow({ submitted_at: "2026-04-15T00:00:00Z" }),
    ];

    const result = conventionRangeStats(rows, range, getDate);

    expect(result.bookings).toBe(2);
    expect(result.bookingsDelta).toBe("+100% vs previous period");
  });

  // Utilization and resident/outside share have no real source (see the
  // function's doc comment). They used to be returned as fields fixed at
  // 0/"Not tracked" that nothing read — a placeholder zero sitting in a
  // stats object is an invitation for a future tile to bind to it and
  // present it as a measurement. The shape carries only what is real.
  it("returns no utilization or resident/outside share fields at all", () => {
    const result = conventionRangeStats([], range, getDate);

    expect(Object.keys(result).sort()).toEqual(["bookings", "bookingsDelta"]);
  });
});
