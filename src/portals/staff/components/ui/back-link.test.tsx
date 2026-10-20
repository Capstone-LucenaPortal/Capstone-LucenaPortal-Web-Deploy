import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackLink } from "./back-link";

describe("BackLink", () => {
  it("renders a link to the given href with the given label", () => {
    render(<BackLink href="/yellow-card" label="Back to Yellow Card" />);

    const link = screen.getByRole("link", { name: /back to yellow card/i });
    expect(link).toHaveAttribute("href", "/yellow-card");
  });

  it("uses the primary lucena-blue color", () => {
    render(<BackLink href="/incidents" label="Back to Incidents" />);

    const link = screen.getByRole("link", { name: /back to incidents/i });
    expect(link).toHaveClass("text-lucena-blue");
  });

  it("merges an extra className", () => {
    render(
      <BackLink href="/booking" label="Back to Booking" className="mt-2" />
    );

    const link = screen.getByRole("link", { name: /back to booking/i });
    expect(link).toHaveClass("mt-2");
    expect(link).toHaveClass("text-lucena-blue");
  });
});
