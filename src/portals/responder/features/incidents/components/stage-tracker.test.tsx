import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageTracker } from "@/portals/responder/features/incidents/components/stage-tracker";
import { NoteForm } from "@/portals/responder/features/incidents/components/note-form";
import { NOTE_MAX_LENGTH } from "@/portals/responder/features/incidents/lib/work";
import { anEvent } from "@/portals/responder/features/incidents/lib/fixtures";

// The actions call RPCs and redirect; the components only need something to
// hand to `<form action=…>`.
vi.mock("@/portals/responder/features/incidents/actions", () => ({
  advanceStageAction: vi.fn(),
  postNote: vi.fn(),
}));

const stage = (name: string) => screen.getByRole("button", { name });
const reached = (...types: string[]) =>
  types.map((t) => anEvent({ event_type: t as never }));

describe("StageTracker", () => {
  it("offers all three stages on an untouched ticket", () => {
    render(<StageTracker events={reached("claimed")} incidentId="inc-1" />);

    expect(stage("En route")).toBeEnabled();
    expect(stage("On site")).toBeEnabled();
    expect(stage("Working")).toBeEnabled();
  });

  it("makes a reached stage inert and leaves the ones ahead live", () => {
    render(
      <StageTracker events={reached("stage_en_route")} incidentId="inc-1" />,
    );

    expect(stage("En route")).toBeDisabled();
    expect(stage("On site")).toBeEnabled();
    expect(stage("Working")).toBeEnabled();
  });

  it("marks only the furthest reached stage as the current step", () => {
    render(
      <StageTracker
        events={reached("stage_en_route", "stage_on_site")}
        incidentId="inc-1"
      />,
    );

    expect(stage("On site")).toHaveAttribute("aria-current", "step");
    expect(stage("En route")).not.toHaveAttribute("aria-current");
  });

  it("leaves nothing pressable once the last stage is reached", () => {
    render(
      <StageTracker events={reached("stage_working")} incidentId="inc-1" />,
    );

    // A skipped stage is behind you, so it is inert too — going back is not a
    // thing, and trg_stage_monotonic would refuse it anyway.
    expect(stage("En route")).toBeDisabled();
    expect(stage("On site")).toBeDisabled();
    expect(stage("Working")).toBeDisabled();
  });

  it("carries the incident id on every stage form", () => {
    const { container } = render(
      <StageTracker events={[]} incidentId="inc-42" />,
    );

    const ids = container.querySelectorAll('input[name="incidentId"]');
    expect(ids).toHaveLength(3);
    ids.forEach((input) => expect(input).toHaveValue("inc-42"));
  });
});

describe("NoteForm", () => {
  it("offers an optional note and a Post button", () => {
    render(<NoteForm incidentId="inc-1" />);

    const input = screen.getByLabelText("Add a note to the timeline");

    expect(input).toHaveAttribute(
      "placeholder",
      "Add a note to the timeline (optional)",
    );
    expect(input).toHaveAttribute("maxLength", String(NOTE_MAX_LENGTH));
    expect(screen.getByRole("button", { name: "Post" })).toBeEnabled();
  });

  it("carries the incident id the note RPC needs", () => {
    const { container } = render(<NoteForm incidentId="inc-42" />);

    expect(container.querySelector('input[name="incidentId"]')).toHaveValue(
      "inc-42",
    );
  });
});
