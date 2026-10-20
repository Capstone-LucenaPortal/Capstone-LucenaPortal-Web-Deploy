import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IncidentStatusBadge } from "./incident-status-badge";
import { IncidentLevelBadge } from "./incident-level-badge";
import { STATUS_ORDER } from "../lib/status";

describe("IncidentStatusBadge", () => {
  it("renders a label for every one of the five real statuses", () => {
    for (const status of STATUS_ORDER) {
      const { unmount } = render(<IncidentStatusBadge status={status} />);
      unmount();
    }
    expect(STATUS_ORDER).toHaveLength(5);
  });

  it("reads in_pool as In Pool, never Assigned", () => {
    // Routing hands an incident to a department, not a person. "Assigned" is
    // what made the mock's queue read as though work were already underway.
    render(<IncidentStatusBadge status="in_pool" />);
    expect(screen.getByText("In Pool")).toBeInTheDocument();
    expect(screen.queryByText("Assigned")).not.toBeInTheDocument();
  });

  it("renders the remaining status labels", () => {
    const { rerender } = render(<IncidentStatusBadge status="open" />);
    expect(screen.getByText("Awaiting Triage")).toBeInTheDocument();
    rerender(<IncidentStatusBadge status="in_progress" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    rerender(<IncidentStatusBadge status="resolved" />);
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    rerender(<IncidentStatusBadge status="closed" />);
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });
});

describe("IncidentLevelBadge", () => {
  it("renders the level label", () => {
    render(<IncidentLevelBadge level="critical" />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });
});
