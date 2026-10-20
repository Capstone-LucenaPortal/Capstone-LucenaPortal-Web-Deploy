import { describe, it, expect } from "vitest";
import { toRefusalFailure } from "./refusal-errors";

/**
 * The messages are copied from refuse_incident as l85 raises them
 * (Capstone-LucenaPortal-DB 20261019143043_l85_refuse_incident.sql), so these
 * tests fail the day a message the translation leans on is reworded.
 */
function fail(code: string, message: string) {
  return toRefusalFailure({ code, message });
}

describe("toRefusalFailure", () => {
  it("tells a caller without the module that they may not refuse", () => {
    const failure = fail(
      "42501",
      "refuse_incident: caller is not active Staff with the incidents module",
    );
    expect(failure.message).toMatch(/do not have permission to refuse/i);
    expect(failure.stale).toBe(false);
  });

  it("says the Original was not found, without refreshing the form away", () => {
    const failure = fail("PT404", "refuse_incident: no report INC-2026-999999");
    expect(failure.message).toMatch(/no report has the reference number/i);
    expect(failure.stale).toBe(false);
  });

  it("treats a missing refused report as a stale page", () => {
    const failure = fail(
      "PT404",
      "refuse_incident: no incident 000000de-0000-4004-8000-000000000004",
    );
    expect(failure.message).toMatch(/no longer exists/i);
    expect(failure.stale).toBe(true);
  });

  it("does not let a typed reference that reads like another message pick the copy", () => {
    // The Original's reference is the one piece of caller text the RPC
    // interpolates. Typed "no incident", it must still read as not-found.
    const failure = fail("PT404", "refuse_incident: no report no incident x");
    expect(failure.message).toMatch(/no report has the reference number/i);
  });

  it("treats a report that is no longer open or pooled as a stale page", () => {
    const failure = fail(
      "22023",
      "refuse_incident: INC-2026-000079 is in_progress, only an open or pooled report can be refused",
    );
    expect(failure.message).toMatch(/can no longer be refused/i);
    expect(failure.stale).toBe(true);
  });

  it("refuses a report named as its own Original", () => {
    const failure = fail(
      "22023",
      "refuse_incident: INC-2026-000079 cannot be its own Original",
    );
    expect(failure.message).toMatch(/cannot be a duplicate of itself/i);
    expect(failure.stale).toBe(false);
  });

  it("points a Duplicate-as-Original at the root report", () => {
    const failure = fail(
      "22023",
      "refuse_incident: INC-2026-000054 is itself a Duplicate; name its Original instead",
    );
    expect(failure.message).toMatch(/itself a duplicate/i);
    expect(failure.stale).toBe(false);
  });

  it("explains why an Original cannot become a Duplicate", () => {
    const failure = fail(
      "22023",
      "refuse_incident: INC-2026-000079 is already the Original of another report; it cannot become a Duplicate",
    );
    expect(failure.message).toMatch(/already marked as duplicates of this one/i);
    expect(failure.stale).toBe(false);
  });

  it("asks for a reason when none was given", () => {
    const failure = fail("22023", "refuse_incident: a reason is required");
    expect(failure.message).toMatch(/type a reason/i);
    expect(failure.stale).toBe(false);
  });

  it("says an over-long reason is refused rather than clipped", () => {
    const failure = fail(
      "22023",
      "refuse_incident: the reason is 501 characters; the limit is 500",
    );
    expect(failure.message).toMatch(/500 characters/);
    expect(failure.stale).toBe(false);
  });

  it("asks for the Original's reference on a Duplicate", () => {
    const failure = fail(
      "22023",
      "refuse_incident: a Duplicate needs the Original's reference number",
    );
    expect(failure.message).toMatch(/original's reference number/i);
    expect(failure.stale).toBe(false);
  });

  it("falls back to a generic sentence for a 22023 it does not recognise", () => {
    const failure = fail(
      "22023",
      "refuse_incident: an Invalid refusal takes no Original reference",
    );
    expect(failure.message).toBe("The refusal could not be saved. Please try again.");
    expect(failure.stale).toBe(false);
  });

  it("never renders the database's own text", () => {
    for (const [code, message] of [
      ["22023", "refuse_incident: INC-2026-000079 cannot be its own Original"],
      ["PT404", "refuse_incident: no report INC-2026-999999"],
      ["XX000", "refuse_incident: something new"],
    ]) {
      expect(fail(code, message).message).not.toMatch(/refuse_incident|INC-/);
    }
  });

  it("falls back on a network failure with no code", () => {
    expect(toRefusalFailure(null).message).toBe(
      "The refusal could not be saved. Please try again.",
    );
  });
});
