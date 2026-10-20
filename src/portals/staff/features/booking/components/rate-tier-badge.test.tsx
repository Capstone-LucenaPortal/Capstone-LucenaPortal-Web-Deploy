import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RateTierBadge } from "./rate-tier-badge";

describe("RateTierBadge", () => {
  it("renders a commercial booking plainly", () => {
    // Nothing to substantiate — the commercial tier is the full rate, and
    // tier_verified is meaningless on it.
    render(<RateTierBadge tier="commercial" verified={false} />);
    expect(screen.getByText("Commercial")).toBeInTheDocument();
  });

  it("does not claim verification on a commercial booking", () => {
    // tier_verified can be true on a commercial row after review_booking
    // rejected a discount claim and repriced. Saying "verified" there would
    // suggest a discount had been substantiated.
    render(<RateTierBadge tier="commercial" verified={true} />);
    expect(screen.getByText("Commercial")).toBeInTheDocument();
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
  });

  it("separates a substantiated discount from an unsubstantiated one", () => {
    // This is the whole reason the badge exists. Fourteen of the twenty-one
    // sandbox bookings claim a discount and not one is substantiated; a plain
    // "Discounted" for both states is what makes an unverified half-price
    // booking look settled.
    const { rerender } = render(<RateTierBadge tier="discounted" verified={true} />);
    expect(screen.getByText("Discounted · verified")).toBeInTheDocument();

    rerender(<RateTierBadge tier="discounted" verified={false} />);
    expect(screen.getByText("Discounted · unverified")).toBeInTheDocument();
  });

  it("styles the unverified claim as a warning and the verified one as success", () => {
    // Distinct at a glance in the queue, not just on close reading.
    const { rerender } = render(<RateTierBadge tier="discounted" verified={false} />);
    expect(screen.getByText("Discounted · unverified").className).toContain("yellow");

    rerender(<RateTierBadge tier="discounted" verified={true} />);
    expect(screen.getByText("Discounted · verified").className).toContain("green");
  });
});
