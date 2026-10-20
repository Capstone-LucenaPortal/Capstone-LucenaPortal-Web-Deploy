import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  AWAITING_TRIAGE_STATUSES,
  awaitingTriageCount,
  CLOSURE_REASON_LABELS,
  EVENT_LABELS,
  isRoutable,
  LEVEL_LABELS,
  LEVEL_ORDER,
  ROUTABLE_STATUSES,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  STATUS_ORDER,
} from "./status";
import { deriveSlaState } from "./sla";
import type { IncidentStatus } from "../types";

describe("status vocabulary", () => {
  it("orders exactly the five real statuses", () => {
    expect(STATUS_ORDER).toEqual([
      "open",
      "in_pool",
      "in_progress",
      "resolved",
      "closed",
    ]);
  });

  it("has no invented statuses", () => {
    expect(STATUS_ORDER).not.toContain("assigned");
    expect(STATUS_ORDER).not.toContain("expired_unverified");
  });

  it("labels and styles every status", () => {
    for (const status of STATUS_ORDER) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_BADGE_VARIANT[status]).toBeTruthy();
    }
  });

  it("labels every level, worst first", () => {
    expect(LEVEL_ORDER).toEqual(["critical", "high", "medium", "low"]);
    for (const level of LEVEL_ORDER) expect(LEVEL_LABELS[level]).toBeTruthy();
  });

  it("labels all five closure reasons", () => {
    expect(Object.keys(CLOSURE_REASON_LABELS).sort()).toEqual([
      "auto_confirmed",
      "citizen_confirmed",
      "duplicate",
      "expired_unverified",
      "invalid",
    ]);
  });

  it("labels all nineteen event types", () => {
    expect(Object.keys(EVENT_LABELS)).toHaveLength(19);
    expect(EVENT_LABELS.stage_en_route).toBe("En route");
    expect(EVENT_LABELS.rerouted).toBe("Rerouted");
    expect(EVENT_LABELS.force_released).toBe("Force-released");
  });
});

describe("isRoutable", () => {
  // Deliberately NARROWER than route_incident, which permits in_progress.
  // Rerouting a claimed incident orphans its responder. Decision 7.
  it("allows open and in_pool", () => {
    expect(isRoutable("open")).toBe(true);
    expect(isRoutable("in_pool")).toBe(true);
  });

  it("refuses in_progress, resolved and closed", () => {
    expect(isRoutable("in_progress")).toBe(false);
    expect(isRoutable("resolved")).toBe(false);
    expect(isRoutable("closed")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Awaiting Triage — the module's arrival set
// ---------------------------------------------------------------------------

/**
 * The one definition of what the Incidents queue means by an arrival. The
 * activity badge's baseline and its background poll both read it, which is what
 * keeps the two figures from disagreeing about the same set.
 *
 * Deliberately five different tallies, so a fold over the wrong set cannot
 * coincidentally produce the expected total.
 */
const counts: Record<IncidentStatus, number> = {
  open: 3,
  in_pool: 30,
  in_progress: 300,
  resolved: 3_000,
  closed: 30_000,
};

describe("AWAITING_TRIAGE_STATUSES", () => {
  it("is open and nothing else", () => {
    expect(AWAITING_TRIAGE_STATUSES).toEqual(["open"]);
  });

  /**
   * The two sets look alike and answer different questions. Routing is about
   * what an operator may still hand to a department — `in_pool` included,
   * because a routed incident can be rerouted. Triage is about what nobody has
   * routed yet. Sharing one constant would put two unrelated rules on one line
   * and drift them apart the first time either moved.
   */
  it("is not the routable set", () => {
    expect(AWAITING_TRIAGE_STATUSES).not.toEqual(ROUTABLE_STATUSES);
    expect(AWAITING_TRIAGE_STATUSES).not.toContain("in_pool");
  });
});

describe("awaitingTriageCount", () => {
  it("takes the awaiting-triage tally and nothing else", () => {
    expect(awaitingTriageCount(counts)).toBe(3);
  });

  it("reports nothing waiting when every report has been routed", () => {
    expect(awaitingTriageCount({ ...counts, open: 0 })).toBe(0);
  });

  /**
   * With one member in the set, a fold and a hand-written `counts.open` are
   * indistinguishable by their answer today. What is assertable is that the
   * figure agrees with the constant — so the day a status joins the set, this
   * expectation moves with it rather than having to be remembered.
   */
  it("agrees with the constant rather than restating a status", () => {
    expect(awaitingTriageCount(counts)).toBe(
      AWAITING_TRIAGE_STATUSES.reduce((sum, status) => sum + counts[status], 0),
    );
  });
});

describe("ACTIVE_STATUSES", () => {
  it("is the three statuses somebody still has work to do on, in queue order", () => {
    expect([...ACTIVE_STATUSES]).toEqual(["open", "in_pool", "in_progress"]);
  });

  /**
   * `resolved` is the one it is easiest to get wrong. The incident is not
   * finished — a citizen still has to confirm it, or the auto-confirm window
   * has to run out — but nobody in this building has anything left to do, so
   * it is not the office's work any more.
   */
  it("does not count a resolved or closed incident as work for this office", () => {
    expect(ACTIVE_STATUSES).not.toContain("resolved");
    expect(ACTIVE_STATUSES).not.toContain("closed");
  });

  /**
   * Three sets in one module, three different questions — "is anyone still
   * working on it", "may this still be routed", "has nobody routed it yet".
   *
   * What is asserted is not that they differ, which is plain, but that they
   * nest: both of the others are strictly inside this one. That nesting is
   * what makes collapsing them tempting, and what would make it silent —
   * routing an `in_progress` incident is the case that separates this set
   * from ROUTABLE_STATUSES, and it is the case ./status.ts warns about.
   */
  it("strictly contains both of the module's other status sets", () => {
    for (const status of [...ROUTABLE_STATUSES, ...AWAITING_TRIAGE_STATUSES]) {
      expect(ACTIVE_STATUSES).toContain(status);
    }

    expect(ACTIVE_STATUSES).toContain("in_progress");
    expect(ROUTABLE_STATUSES).not.toContain("in_progress");
    expect(AWAITING_TRIAGE_STATUSES).not.toContain("in_progress");
  });

  /**
   * The judgement argued beside the constant, made executable: the statuses
   * that can be at risk are exactly the statuses that are not finished.
   *
   * It is asserted rather than left in prose because the two sentences behind
   * it are not identical — *only these can be at risk* is the at-risk read's,
   * *somebody still has work to do* is the card's — and this module already
   * carries one scar from two sentences sharing a line. What would split them
   * is a status-keyed reason a live incident cannot be at risk, a clock paused
   * on a status rather than on `is_verified`. The day that lands in
   * `deriveSlaState`, this fails rather than the At Risk card quietly
   * under-reporting.
   */
  it("holds exactly the statuses that can be at risk", () => {
    const armed = {
      is_verified: true,
      sla_armed_at: "2026-08-07T00:00:00.000Z",
      sla_due_at: "2026-08-07T10:00:00.000Z",
      resolved_at: null,
      closed_at: null,
    };
    // Six of the ten hours gone, so the row is past a half-window threshold
    // on every status that can be at risk at all.
    const now = new Date("2026-08-07T06:00:00.000Z");

    const canBeAtRisk = STATUS_ORDER.filter(
      (status) => deriveSlaState({ ...armed, status }, now, 0.5) === "at_risk",
    );

    expect(canBeAtRisk).toEqual([...ACTIVE_STATUSES]);
  });
});
