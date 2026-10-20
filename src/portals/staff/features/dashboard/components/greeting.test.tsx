import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardGreeting } from "./greeting";

// Built from local components rather than an ISO instant, so the formatted day
// is the same one on any machine's timezone.
const NEW_YEARS_DAY = new Date(2026, 0, 1, 9, 0);

describe("DashboardGreeting", () => {
  it("renders a welcome message with the staff member's name", () => {
    render(<DashboardGreeting name="Juan Dela Cruz" now={NEW_YEARS_DAY} />);

    expect(screen.getByText("Welcome back, Juan Dela Cruz")).toBeInTheDocument();
  });

  it("dates the greeting from the moment it is handed, not the wall clock", () => {
    render(<DashboardGreeting name="Juan Dela Cruz" now={NEW_YEARS_DAY} />);

    expect(screen.getByText("January 1, 2026")).toBeInTheDocument();
  });
});
