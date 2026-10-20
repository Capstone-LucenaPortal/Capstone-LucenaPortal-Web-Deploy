import { describe, expect, it } from "vitest";
import { routeForOutcome } from "@/portals/responder/features/incidents/lib/claim-outcome";
import type { ClaimResult } from "@/portals/responder/features/incidents/types";

/**
 * `returns table` columns arrive null whenever the outcome does not populate
 * them -- a winner has no held_reference, a block has no winner. The generated
 * type declares them non-null because codegen cannot see that, so the fixture
 * casts rather than lying about the shape in the assertions.
 */
const outcome = (over: Partial<ClaimResult>): ClaimResult =>
  ({
    incident_id: "abc",
    winner_full_name: null,
    held_reference: null,
    ...over,
  }) as unknown as ClaimResult;

describe("routeForOutcome", () => {
  it("sends a winner to the ticket screen with no notice", () => {
    expect(routeForOutcome(outcome({ outcome: "claimed" }))).toBe("/responder/my-ticket");
  });

  it("treats a double tap as a win — landing on the ticket you already hold", () => {
    expect(routeForOutcome(outcome({ outcome: "already_yours" }))).toBe(
      "/responder/my-ticket",
    );
  });

  it("names the held ticket when a second claim is refused", () => {
    expect(
      routeForOutcome(
        outcome({ outcome: "blocked", held_reference: "INC-2026-000076" }),
      ),
    ).toBe("/responder/my-ticket?notice=blocked");
  });

  it("returns a loser to the pool with the winner's name in the URL", () => {
    expect(
      routeForOutcome(
        outcome({ outcome: "lost", winner_full_name: "Dev Responder One" }),
      ),
    ).toBe("/responder/pool?lost=Dev%20Responder%20One");
  });

  it("returns quietly to the pool when the incident has left it", () => {
    expect(routeForOutcome(outcome({ outcome: "gone" }))).toBe(
      "/responder/pool?notice=gone",
    );
  });

  it("throws on an outcome the database grew and this app has not been taught", () => {
    expect(() => routeForOutcome(outcome({ outcome: "escalated" }))).toThrow(
      /Unknown claim outcome/,
    );
  });
});
