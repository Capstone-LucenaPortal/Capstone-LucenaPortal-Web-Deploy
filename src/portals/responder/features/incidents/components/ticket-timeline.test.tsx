import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TicketTimeline } from "@/portals/responder/features/incidents/components/ticket-timeline";
import { buildTimeline } from "@/portals/responder/features/incidents/lib/work";
import { anEvent } from "@/portals/responder/features/incidents/lib/fixtures";

const at = (time: string) => `2026-07-28T${time}:00+08:00`;

/** Rows as `responder_incident_events` returns them: ordered, already real. */
const entries = () =>
  buildTimeline([
    anEvent({
      event_type: "claimed",
      actor_name: "Juan",
      created_at: at("09:00"),
    }),
    anEvent({
      event_type: "stage_en_route",
      actor_name: "Juan",
      created_at: at("09:15"),
    }),
    anEvent({
      event_type: "note",
      note: "Traffic on Quezon Ave",
      actor_name: "Juan",
      created_at: at("09:30"),
    }),
    anEvent({
      event_type: "photo_added",
      actor_name: "Juan",
      created_at: at("09:40"),
    }),
  ]);

describe("TicketTimeline", () => {
  it("tells the responder that staff are watching", () => {
    render(<TicketTimeline entries={entries()} />);

    expect(
      screen.getByText("Timeline · staff sees this live"),
    ).toBeInTheDocument();
  });

  it("renders every entry oldest first", () => {
    render(<TicketTimeline entries={entries()} />);

    const items = screen.getAllByRole("listitem").map((li) => li.textContent);

    expect(items[0]).toContain("Claimed");
    expect(items[1]).toContain("En route");
    expect(items[2]).toContain("Traffic on Quezon Ave");
    expect(items[3]).toContain("After photo added");
  });

  it("carries the time and the actor on each entry", () => {
    render(<TicketTimeline entries={entries()} />);

    expect(screen.getByText("9:00 AM · Juan")).toBeInTheDocument();
    expect(screen.getByText("9:15 AM · Juan")).toBeInTheDocument();
    expect(screen.getByText("9:30 AM · Juan · Note")).toBeInTheDocument();
  });
});
