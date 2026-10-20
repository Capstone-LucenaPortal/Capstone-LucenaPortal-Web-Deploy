import { describe, expect, it } from "vitest";
import {
  CANCELLATION_REASON_LABELS,
  DOC_KIND_LABELS,
  EVENT_LABELS,
  labelForEvent,
  needsActionCount,
  NEEDS_ACTION_STATUSES,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  STATUS_ORDER,
} from "./status";
import type { BookingStatus } from "../types";

describe("status vocabulary", () => {
  it("orders exactly the ten real statuses, as a pipeline", () => {
    expect(STATUS_ORDER).toEqual([
      "pending",
      "awaiting_tier_review",
      "awaiting_resubmission",
      "awaiting_quote",
      "awaiting_payment",
      "payment_verification",
      "confirmed",
      "fully_paid",
      "completed",
      "cancelled",
    ]);
  });

  it("labels and styles every status", () => {
    for (const status of STATUS_ORDER) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_BADGE_VARIANT[status]).toBeTruthy();
    }
  });

  it("names the four statuses that need a staff member", () => {
    // Non-adjacent on purpose: no ordering of plain tabs surfaces them
    // together, which is the whole reason the sentinel tab exists.
    expect([...NEEDS_ACTION_STATUSES]).toEqual([
      "awaiting_tier_review",
      "awaiting_quote",
      "payment_verification",
      "confirmed",
    ]);
  });

  it("labels all five cancellation reasons", () => {
    expect(Object.keys(CANCELLATION_REASON_LABELS).sort()).toEqual([
      "cancelled_by_citizen",
      "expired_unpaid",
      "expired_unrevised",
      "no_show",
      "rejected_by_staff",
    ]);
  });

  it("labels every payment kind, including the one nobody writes", () => {
    // `refund` is unreachable — decision 7 leaves it unwritten — but it is a
    // real enum member and a blank cell would be worse than an unused label.
    expect(Object.keys(PAYMENT_KIND_LABELS).sort()).toEqual([
      "balance",
      "downpayment",
      "refund",
    ]);
  });

  it("labels all four payment methods", () => {
    expect(Object.keys(PAYMENT_METHOD_LABELS).sort()).toEqual([
      "bank_transfer",
      "cash",
      "check",
      "gcash",
    ]);
  });

  it("labels both document kinds", () => {
    expect(Object.keys(DOC_KIND_LABELS).sort()).toEqual([
      "gcash_receipt",
      "org_document",
    ]);
  });
});

describe("labelForEvent", () => {
  it("labels every value a function body writes today", () => {
    for (const type of [
      "submitted",
      "tier_claim_submitted",
      "tier_claim_resubmitted",
      "tier_claim_given_up",
      "revision_requested",
      "quoted",
      "payment_submitted",
      "document_verified",
      "document_rejected",
      "repriced",
      "payment_verified",
      "payment_rejected",
      "balance_settled",
      "cancelled",
      "completed",
    ]) {
      expect(EVENT_LABELS[type]).toBeTruthy();
    }
  });

  it("humanises a value nobody has seen yet", () => {
    // booking_events.event_type is plain text with no constraint. A new RPC
    // can introduce a value without touching this repo, and a blank cell in
    // the timeline would be worse than an imperfect label.
    expect(labelForEvent("slot_released")).toBe("Slot released");
    expect(labelForEvent("")).toBe("Unknown event");
  });
});

/**
 * Deliberately ten distinct powers of two. Equal tallies would let a fold
 * that read the wrong statuses still land on the expected total.
 */
const counts: Record<BookingStatus, number> = {
  pending: 1,
  awaiting_tier_review: 2,
  awaiting_resubmission: 4,
  awaiting_quote: 8,
  awaiting_payment: 16,
  payment_verification: 32,
  confirmed: 64,
  fully_paid: 128,
  completed: 256,
  cancelled: 512,
};

/**
 * The set is derived from a per-status map rather than written out, so what
 * used to need a test is now structural: it is `readonly`, nothing can push a
 * status onto it, and every status in the enum has to answer whether it is
 * waiting on this office. These say what the derivation is worth.
 */
describe("NEEDS_ACTION_STATUSES", () => {
  /**
   * The one that is easiest to get wrong, and the reason this is a backlog and
   * not an arrival set. The money is outstanding, but nobody in this building
   * can do anything about it until the organiser sends it.
   */
  it("leaves out the status that waits on the organiser", () => {
    expect(NEEDS_ACTION_STATUSES).not.toContain("awaiting_payment");
  });

  /**
   * The same call for a Revision Request (SCRUM-198): the Tier Claim is
   * undecided, but it is the organiser's turn to resubmit, so the desk sees it
   * as waiting on them rather than as work.
   */
  it("leaves out a Revision Request waiting on a Resubmission", () => {
    expect(NEEDS_ACTION_STATUSES).not.toContain("awaiting_resubmission");
    expect(NEEDS_ACTION_STATUSES).toContain("awaiting_tier_review");
  });

  /**
   * Filtering STATUS_ORDER rather than listing the three keeps the module to
   * one written-down ordering, and keeps the bytes of the `in.()` filter this
   * feeds to PostgREST stable — they change when someone moves a tab, never
   * when someone tidies the map above it.
   */
  it("reads in pipeline order", () => {
    const order = NEEDS_ACTION_STATUSES.map((s) => STATUS_ORDER.indexOf(s));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order).not.toContain(-1);
  });
});

describe("needsActionCount", () => {
  it("adds up the four waiting-on-us tallies and nothing else", () => {
    expect(needsActionCount(counts)).toBe(2 + 8 + 32 + 64);
  });

  it("ignores work that is not this office's to do", () => {
    expect(
      needsActionCount({
        ...counts,
        awaiting_tier_review: 0,
        awaiting_quote: 0,
        payment_verification: 0,
        confirmed: 0,
      }),
    ).toBe(0);
  });

  /**
   * The reason the fold exists rather than a hand-written
   * `awaiting_quote + payment_verification + confirmed`. That sum would still
   * type-check and still pass both cases above after the set had grown, and
   * the queue would quietly under-count from the day it did.
   *
   * Said as an agreement with the constant rather than by mutating it: the set
   * is `readonly` now, and a test that pushed onto it would have pinned it as
   * permanently mutable — which is the opposite of what makes the fold safe.
   */
  it("agrees with the constant rather than restating three statuses", () => {
    expect(needsActionCount(counts)).toBe(
      NEEDS_ACTION_STATUSES.reduce((sum, status) => sum + counts[status], 0),
    );
  });
});
