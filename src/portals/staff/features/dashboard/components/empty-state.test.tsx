import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardEmptyState } from "./empty-state";

describe("DashboardEmptyState", () => {
  it("tells the staff member to contact their administrator", () => {
    render(<DashboardEmptyState />);

    expect(screen.getByText("No module assigned yet.")).toBeInTheDocument();
    expect(screen.getByText(/contact your administrator/i)).toBeInTheDocument();
  });
});
