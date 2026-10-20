import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/dashboard",
}));

describe("Sidebar", () => {
  it("only shows Dashboard and the assigned module's link", () => {
    render(<Sidebar assignedModules={["incidents"]} />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Incidents" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Yellow Card" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Booking" })).not.toBeInTheDocument();
  });

  it("shows every module link when all are assigned", () => {
    render(<Sidebar assignedModules={["yellow-card", "incidents", "booking"]} />);

    expect(screen.getByRole("link", { name: "Yellow Card" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Incidents" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Booking" })).toBeInTheDocument();
  });

  it("marks the nav link matching the current pathname with aria-current", () => {
    render(<Sidebar assignedModules={["yellow-card", "incidents", "booking"]} />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("does not set aria-current on non-matching nav links", () => {
    render(<Sidebar assignedModules={["yellow-card", "incidents", "booking"]} />);

    expect(screen.getByRole("link", { name: "Yellow Card" })).not.toHaveAttribute(
      "aria-current"
    );
    expect(screen.getByRole("link", { name: "Incidents" })).not.toHaveAttribute(
      "aria-current"
    );
    expect(screen.getByRole("link", { name: "Booking" })).not.toHaveAttribute(
      "aria-current"
    );
  });
});
