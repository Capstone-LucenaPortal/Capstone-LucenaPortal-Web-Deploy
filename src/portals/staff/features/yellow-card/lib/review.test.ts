import { describe, expect, it } from "vitest";
import {
  createFailingFetch,
  createRecordingFetch,
  createTestClient,
  parseProcedureName,
  parseQueryParams,
} from "@/portals/staff/lib/supabase/testing";
import { readAwaitingReviewCount, writeReviewDecision } from "./review";

/**
 * The logic behind the module's two server actions, on the same recording-fetch
 * seam as the reads in ./queries.ts. What is asserted is the request that would
 * have reached the database — which table or procedure, which arguments, which
 * filter — and the rule applied to the answer.
 *
 * The shell in ./actions.ts is deliberately not tested — see the note at the
 * top of ./review.ts.
 */

describe("readAwaitingReviewCount", () => {
  it("counts the reviewable statuses without shipping any rows", async () => {
    const { fetch, requests } = createRecordingFetch([], { rowCount: 7 });

    const count = await readAwaitingReviewCount(createTestClient(fetch));

    const params = parseQueryParams(requests[0].url);
    expect(requests[0].method).toBe("HEAD");
    expect(params.table).toBe("staff_yellow_card_queue");
    expect(params.select).toBe("id");
    expect(count).toBe(7);
  });

  /**
   * revision_requested is excluded on purpose: that application is waiting on
   * the citizen, and it returns as resubmitted when they act. Counting it here
   * would tell the activity bar there is work to do that nobody can do.
   */
  it("counts pending and resubmitted, and nothing else", async () => {
    const { fetch, requests } = createRecordingFetch([], { rowCount: 7 });

    await readAwaitingReviewCount(createTestClient(fetch));

    expect(parseQueryParams(requests[0].url).filters).toEqual({
      status: ["in.(pending,resubmitted)"],
    });
  });

  /**
   * This runs on a timer behind someone's review screen. A blip must not
   * surface as an error mid-review; the caller keeps its last figure and tries
   * again on the next tick.
   */
  it("returns nothing rather than raising when the read fails", async () => {
    const { fetch } = createFailingFetch({ message: "network is unreachable" });

    await expect(
      readAwaitingReviewCount(createTestClient(fetch)),
    ).resolves.toBeNull();
  });

  /** No count header at all is zero work waiting, not an unknown figure. */
  it("reports zero rather than nothing when the count comes back absent", async () => {
    const { fetch } = createRecordingFetch([]);

    expect(await readAwaitingReviewCount(createTestClient(fetch))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The write
// ---------------------------------------------------------------------------

/**
 * Issuing the card, stamping the decision time and resuming the SLA clock all
 * happen inside this one procedure, in the database, so they can never
 * partially succeed. That it stays a single call is the property worth pinning.
 */
describe("writeReviewDecision", () => {
  it("reaches the database as one call to the review procedure", async () => {
    const { fetch, requests } = createRecordingFetch();

    await writeReviewDecision(createTestClient(fetch), {
      applicationId: "app-1",
      decision: "approve",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(parseProcedureName(requests[0].url)).toBe(
      "review_yellow_card_application",
    );
  });

  it("passes the application, the decision and the reason as its arguments", async () => {
    const { fetch, requests } = createRecordingFetch();

    await writeReviewDecision(createTestClient(fetch), {
      applicationId: "app-1",
      decision: "reject",
      reason: "  The photo is unreadable.  ",
    });

    expect(requests[0].body).toEqual({
      p_application_id: "app-1",
      p_decision: "reject",
      p_reason: "The photo is unreadable.",
    });
  });

  /**
   * The procedure requires a reason for revise and reject and enforces that
   * itself. Sending "" would duplicate the rule here and, worse, satisfy a
   * check that is meant to fail — so blank has to arrive as absent.
   */
  it("sends a blank reason and an absent reason as identical arguments", async () => {
    const blank = createRecordingFetch();
    const absent = createRecordingFetch();

    await writeReviewDecision(createTestClient(blank.fetch), {
      applicationId: "app-1",
      decision: "approve",
      reason: "   ",
    });
    await writeReviewDecision(createTestClient(absent.fetch), {
      applicationId: "app-1",
      decision: "approve",
    });

    expect(blank.requests[0].body).toEqual(absent.requests[0].body);
    expect(absent.requests[0].body).toEqual({
      p_application_id: "app-1",
      p_decision: "approve",
    });
  });

  it("reports success", async () => {
    const { fetch } = createRecordingFetch();

    expect(
      await writeReviewDecision(createTestClient(fetch), {
        applicationId: "app-1",
        decision: "approve",
      }),
    ).toEqual({ ok: true });
  });

  /**
   * The mapping table itself is covered by lib/supabase/errors.test.ts. What is
   * asserted here is the wiring: a failure from this RPC reaches translation
   * carrying this module's own sentences rather than the database's, which name
   * the function and the enum value that failed and are wrong for a queue clerk
   * to read.
   */
  it("translates a guard violation into the conflict sentence and marks the page stale", async () => {
    const { fetch } = createFailingFetch({
      status: 400,
      code: "22023",
      message: "review_yellow_card_application: application is not awaiting review",
    });

    const result = await writeReviewDecision(createTestClient(fetch), {
      applicationId: "app-1",
      decision: "approve",
    });

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("no longer awaiting review"),
      stale: true,
    });
  });
});
