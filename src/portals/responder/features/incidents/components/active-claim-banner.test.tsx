import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActiveClaimBanner } from "@/portals/responder/features/incidents/components/active-claim-banner";

describe("ActiveClaimBanner", () => {
  it("names the ticket being held", () => {
    render(<ActiveClaimBanner heldRef="#4501" />);

    expect(
      screen.getByText("Finish your current ticket first — #4501"),
    ).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("is a link to the ticket", () => {
    render(<ActiveClaimBanner heldRef="#4501" />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/responder/my-ticket");
  });
});
