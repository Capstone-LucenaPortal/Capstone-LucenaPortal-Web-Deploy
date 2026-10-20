import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeadlineBadge } from "./deadline-badge";
import type { DeadlineState } from "../lib/deadline";

const DUE = "2026-10-13T09:30:00Z"; // 17:30 Manila

describe("DeadlineBadge", () => {
  // The incident SLA_STATE_VARIANT colours, so amber means the same thing on
  // both queues: On track = info, At risk = warning, Overdue = destructive.
  const cases: Array<[DeadlineState, string, string]> = [
    ["on_track", "On track", "bg-blue-100"],
    ["at_risk", "At risk", "bg-yellow-100"],
    ["overdue", "Overdue", "bg-red-100"],
  ];

  it.each(cases)("renders %s as %s in its own colour", (state, label, colour) => {
    render(<DeadlineBadge state={state} dueAt={DUE} />);

    expect(screen.getByText(label)).toHaveClass(colour);
  });

  it.each(cases)("shows the Processing Deadline in Manila time under %s", (state) => {
    render(<DeadlineBadge state={state} dueAt={DUE} />);

    expect(screen.getByText(/Due October 13, 2026/)).toHaveTextContent(/05:30\s*PM/i);
  });

  it("renders nothing for an application whose clock is not running", () => {
    const { container } = render(<DeadlineBadge state={null} dueAt={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
