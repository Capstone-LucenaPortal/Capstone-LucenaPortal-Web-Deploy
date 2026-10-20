import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { claimIncident } from "@/portals/responder/features/incidents/actions";
import { ClaimButton } from "@/portals/responder/features/incidents/components/claim-button";

vi.mock("@/portals/responder/features/incidents/actions", () => ({
  claimIncident: vi.fn(),
}));

let answer: (() => void) | undefined;

afterEach(async () => {
  // A transition left in flight leaks into the next test's form status.
  await act(async () => answer?.());
  answer = undefined;
  vi.mocked(claimIncident).mockReset();
});

/** A server action that has not answered yet — a slow field connection. */
function slowAnswer() {
  return new Promise<void>((resolve) => {
    answer = resolve;
  });
}

describe("ClaimButton", () => {
  it("posts the incident id with the label it was given", () => {
    const { container } = render(
      <ClaimButton
        incidentId="inc-4501"
        label="Claim"
        gated={false}
        variant="card"
      />,
    );

    expect(screen.getByRole("button", { name: "Claim" })).toBeEnabled();
    expect(
      container.querySelector('input[name="incidentId"]'),
    ).toHaveValue("inc-4501");
  });

  it("states the reason instead of staying a mystery when gated", () => {
    render(
      <ClaimButton
        incidentId="inc-4501"
        label="Claim"
        gated
        variant="card"
      />,
    );

    const button = screen.getByRole("button", {
      name: "Finish your ticket first",
    });

    expect(button).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
  });

  it("gates the unverified label the same way", () => {
    render(
      <ClaimButton
        incidentId="inc-4487"
        label="Claim anyway"
        gated
        variant="card-outline"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Finish your ticket first" }),
    ).toBeDisabled();
  });

  // ISO-9. A repeat claim is harmless (claim_incident answers it
  // `already_yours`), but on a slow connection it is a second round trip.
  it("sends one claim however often Claim is tapped", async () => {
    vi.mocked(claimIncident).mockImplementation(slowAnswer);
    render(
      <ClaimButton incidentId="inc-4501" label="Claim" gated={false} variant="card" />,
    );
    const claim = screen.getByRole("button", { name: "Claim" });

    // Both taps land before React re-renders — the case a disabled button
    // cannot catch, so the second must be dropped at the action.
    await act(async () => {
      fireEvent.click(claim);
      fireEvent.click(claim);
    });

    expect(claimIncident).toHaveBeenCalledTimes(1);
  });
});
