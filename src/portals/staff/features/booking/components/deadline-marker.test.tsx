import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingDeadlineMarker } from "./deadline-marker";

const DUE = "2026-11-27T09:30:00Z"; // 17:30 Manila

describe("BookingDeadlineMarker", () => {
  // The Yellow Card deadline badge's words and colours, so both desks read
  // urgency the same way: At risk = warning, Overdue = destructive.
  it.each([
    ["at_risk", "At risk", "bg-yellow-100"],
    ["overdue", "Overdue", "bg-red-100"],
  ] as const)("marks a booking %s as %s in its own colour", (state, label, colour) => {
    render(<BookingDeadlineMarker state={state} dueAt={DUE} />);

    expect(screen.getByText(label)).toHaveClass(colour);
  });

  it.each(["at_risk", "overdue"] as const)(
    "shows the Confirmation Deadline in Manila time under %s",
    (state) => {
      render(<BookingDeadlineMarker state={state} dueAt={DUE} />);

      expect(screen.getByText(/Due November 27, 2026/)).toHaveTextContent(/05:30\s*PM/i);
    },
  );

  // Needs Action is a list of what to clear first; a row on track has
  // nothing to say there, and the detail page carries its deadline.
  it("marks nothing for a booking on track", () => {
    const { container } = render(<BookingDeadlineMarker state="on_track" dueAt={DUE} />);

    expect(container).toBeEmptyDOMElement();
  });

  // Both rows reach the marker as the same two nulls, which is the point: the
  // database decides there is no running clock, and the marker takes its word.
  // A confirmed booking waiting on its balance had its clock stopped at
  // confirmation; a booking with no clock at all (a seed row the backfill could
  // not replay) never had one. Neither may break the row.
  it.each([
    ["a confirmed booking waiting on its balance"],
    ["a booking with no clock"],
  ])("marks nothing for %s", () => {
    const { container } = render(<BookingDeadlineMarker state={null} dueAt={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
