import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IncidentTimeline } from "./incident-timeline";
import type { IncidentEvent } from "../types";

function event(over: Partial<IncidentEvent> = {}): IncidentEvent {
  return {
    id: "e1",
    event_type: "routed",
    actor_role: "staff",
    actor_name: "Juan Dela Cruz",
    note: null,
    cycle_number: 1,
    created_at: "2026-08-07T08:00:00+08:00",
    ...over,
  };
}

describe("IncidentTimeline", () => {
  it("says so when nothing has happened", () => {
    render(<IncidentTimeline events={[]} />);
    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
  });

  it("labels the three field stages distinctly", () => {
    // The mock collapsed all three into one "Field update", so a timeline could
    // not distinguish "on my way" from "standing at the site".
    render(
      <IncidentTimeline
        events={[
          event({ id: "a", event_type: "stage_en_route" }),
          event({ id: "b", event_type: "stage_on_site" }),
          event({ id: "c", event_type: "stage_working" }),
        ]}
      />,
    );
    expect(screen.getByText("En route")).toBeInTheDocument();
    expect(screen.getByText("On site")).toBeInTheDocument();
    expect(screen.getByText("Working")).toBeInTheDocument();
  });

  it("names the actor and shows the note", () => {
    render(
      <IncidentTimeline
        events={[event({ note: "Routed to Engineering." })]}
      />,
    );
    expect(screen.getByText(/Juan Dela Cruz/)).toBeInTheDocument();
    expect(screen.getByText("Routed to Engineering.")).toBeInTheDocument();
  });

  it("separates cycles when an incident was reopened", () => {
    render(
      <IncidentTimeline
        events={[
          event({ id: "a", cycle_number: 1 }),
          event({ id: "b", cycle_number: 2, event_type: "reopened" }),
        ]}
      />,
    );
    expect(screen.getByText("Reopened — cycle 2")).toBeInTheDocument();
  });

  it("shows no cycle separator on a single-cycle incident", () => {
    // 24 of 25 sandbox incidents. A "cycle 1" heading on all of them would be
    // noise that means nothing.
    render(<IncidentTimeline events={[event(), event({ id: "b" })]} />);
    expect(screen.queryByText(/cycle/)).not.toBeInTheDocument();
  });

  it("marks a supervisor override", () => {
    render(
      <IncidentTimeline
        events={[
          event({
            event_type: "force_released",
            actor_role: "supervisor",
            note: "Crew pulled to a critical.",
          }),
        ]}
      />,
    );
    const entry = screen.getByText("Force-released").closest("li");
    expect(within(entry!).getByText(/supervisor/i)).toBeInTheDocument();
  });
});
