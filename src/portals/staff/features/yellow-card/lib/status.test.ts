import { describe, expect, it } from "vitest";
import {
  awaitingReviewCount,
  isReviewable,
  REVIEWABLE_STATUSES,
  STATUS_ORDER,
} from "./status";
import type { YellowCardStatus } from "../types";

/**
 * The one definition of the awaiting-review set, and the two helpers that read
 * it. Every screen that filters or tallies on this rule — the dashboard card,
 * the background poll, the queue's activity badge, the decision buttons — goes
 * through this module, so these are the tests standing under all of them.
 */

/**
 * Deliberately six different figures. Equal tallies would let a helper that
 * summed the wrong pair still produce the expected total.
 */
const counts: Record<YellowCardStatus, number> = {
  pending: 2,
  resubmitted: 5,
  revision_requested: 100,
  approved: 200,
  rejected: 400,
  withdrawn: 800,
};

describe("STATUS_ORDER", () => {
  /**
   * The left-to-right order of the queue's stat tiles and tabs, spelled out
   * rather than derived from the module. A reordering is a change staff see, so
   * it should arrive as a diff on this line and not as a quietly rearranged
   * screen.
   */
  it("runs work to do first, outcomes after, withdrawn last", () => {
    expect([...STATUS_ORDER]).toEqual([
      "pending",
      "resubmitted",
      "revision_requested",
      "approved",
      "rejected",
      "withdrawn",
    ]);
  });
});

describe("REVIEWABLE_STATUSES", () => {
  it("is exactly pending and resubmitted", () => {
    expect([...REVIEWABLE_STATUSES]).toEqual(["pending", "resubmitted"]);
  });
});

describe("isReviewable", () => {
  it("accepts the two statuses the review RPC accepts", () => {
    expect(isReviewable("pending")).toBe(true);
    expect(isReviewable("resubmitted")).toBe(true);
  });

  /**
   * revision_requested is waiting on the citizen, not on staff. A decision
   * button rendered for it would raise 22023 the moment anyone pressed it.
   */
  it("rejects revision_requested and every settled status", () => {
    expect(isReviewable("revision_requested")).toBe(false);
    expect(isReviewable("approved")).toBe(false);
    expect(isReviewable("rejected")).toBe(false);
    expect(isReviewable("withdrawn")).toBe(false);
  });
});

describe("awaitingReviewCount", () => {
  it("adds up the pending and resubmitted tallies and nothing else", () => {
    expect(awaitingReviewCount(counts)).toBe(7);
  });

  it("ignores work that is not staff's to do", () => {
    expect(
      awaitingReviewCount({ ...counts, pending: 0, resubmitted: 0 }),
    ).toBe(0);
  });
});
