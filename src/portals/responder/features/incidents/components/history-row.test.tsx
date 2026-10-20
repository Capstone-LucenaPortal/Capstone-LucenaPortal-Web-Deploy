import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HistoryRow } from "@/portals/responder/features/incidents/components/history-row";
import { aHistoryRow } from "@/portals/responder/features/incidents/lib/fixtures";

describe("HistoryRow", () => {
  it("names the reference, the type, and what the responder DID to it", () => {
    // Story 49: the list is a record of decisions, not of contact.
    render(<HistoryRow row={aHistoryRow()} />);

    expect(screen.getByText("INC-2026-000076")).toBeInTheDocument();
    expect(screen.getByText("Flooding")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("says whether a resolved ticket made its window", () => {
    render(
      <HistoryRow
        row={aHistoryRow({
          sla_due_at: "2026-08-12T04:00:00.000Z",
          resolved_at: "2026-08-12T02:00:00.000Z",
        })}
      />,
    );

    expect(screen.getByText("2h to spare")).toBeInTheDocument();
  });

  it("does not hide a late resolve", () => {
    render(
      <HistoryRow
        row={aHistoryRow({
          sla_due_at: "2026-08-12T04:00:00.000Z",
          resolved_at: "2026-08-12T05:30:00.000Z",
        })}
      />,
    );

    expect(screen.getByText("1h 30m over")).toBeInTheDocument();
  });

  it("still lists a ticket that was RELEASED back to the pool", () => {
    // Story 48: the work done on it is not erased by handing it back. This is
    // why responder_history is scoped to "incidents I have an event on" rather
    // than to assignment.
    render(
      <HistoryRow
        row={aHistoryRow({
          my_last_outcome: "released",
          resolved_at: null,
          status: "in_pool",
        })}
      />,
    );

    expect(screen.getByText("Released")).toBeInTheDocument();
    expect(screen.getByText("INC-2026-000076")).toBeInTheDocument();
  });

  it("lists a rejected ticket too, without an SLA verdict", () => {
    // Rejecting is not a judgement on the promise; it says the promise was
    // never ours to keep.
    render(
      <HistoryRow
        row={aHistoryRow({
          my_last_outcome: "rejected",
          resolved_at: null,
          status: "open",
        })}
      />,
    );

    expect(screen.getByText("Sent back")).toBeInTheDocument();
    expect(screen.queryByText(/to spare|over$/)).not.toBeInTheDocument();
  });

  it("says plainly when a resolved ticket never carried a clock", () => {
    render(
      <HistoryRow
        row={aHistoryRow({
          is_verified: false,
          sla_armed_at: null,
          sla_due_at: null,
        })}
      />,
    );

    expect(screen.getByText("No SLA")).toBeInTheDocument();
  });

  it("flags a ticket the citizen reopened", () => {
    render(<HistoryRow row={aHistoryRow({ reopened_count: 1 })} />);

    expect(screen.getByText("Reopened")).toBeInTheDocument();
  });
});
