import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForceReleaseAction } from "./force-release-action";
import * as actions from "../lib/actions";
import type { Incident } from "../types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function makeIncident(over: Partial<Incident> = {}): Incident {
  return {
    id: "000000de-0000-4004-8000-000000000004",
    reference_number: "INC-2026-000079",
    type_label: "Burst main",
    incident_level: "critical",
    status: "in_progress",
    closure_reason: null,
    is_verified: true,
    barangay_name: "Cotta",
    submitted_at: "2026-08-07T06:00:00+08:00",
    sla_armed_at: "2026-08-07T08:00:00+08:00",
    sla_due_at: "2026-08-07T12:00:00+08:00",
    resolved_at: null,
    closed_at: null,
    incident_type_code: "burst_main",
    category_code: "infrastructure",
    description: "Main burst overnight.",
    address: "Del Pilar St.",
    barangay_code: "cotta",
    is_anonymous: false,
    verified_at: "2026-08-07T07:00:00+08:00",
    suggested_department_code: "water",
    assigned_department_code: "water",
    assigned_responder_id: "resp-1",
    assigned_responder_name: "Dev Responder One",
    routed_at: "2026-08-07T08:00:00+08:00",
    sla_target_hours: 4,
    reopened_count: 0,
    reporter_first_name: "Linda",
    reporter_phone: "09170000001",
    photo_count: 2,
    duplicate_of: null,
    original_reference: null,
    ...over,
  };
}

async function openModal() {
  const user = userEvent.setup();
  render(<ForceReleaseAction incident={makeIncident()} />);
  await user.click(screen.getByRole("button", { name: "Force-release claim" }));
  return user;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ForceReleaseAction", () => {
  it("keeps the confirm button disabled until a reason is typed", async () => {
    const user = await openModal();

    const confirm = screen.getByRole("button", { name: "Confirm force-release" });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/Reason/), "Crew pulled to a critical.");
    expect(confirm).toBeEnabled();
  });

  it("calls forceReleaseIncident with the trimmed reason", async () => {
    const release = vi
      .spyOn(actions, "forceReleaseIncident")
      .mockResolvedValue({ ok: true });

    const user = await openModal();
    await user.type(screen.getByLabelText(/Reason/), "  Crew reassigned.  ");
    await user.click(screen.getByRole("button", { name: "Confirm force-release" }));

    expect(release).toHaveBeenCalledWith({
      incidentId: "000000de-0000-4004-8000-000000000004",
      reason: "  Crew reassigned.  ",
    });
  });

  it("renders the failure message", async () => {
    vi.spyOn(actions, "forceReleaseIncident").mockResolvedValue({
      ok: false,
      message: "Only a supervisor can force-release a claim.",
      stale: false,
    });

    const user = await openModal();
    await user.type(screen.getByLabelText(/Reason/), "Crew reassigned.");
    await user.click(screen.getByRole("button", { name: "Confirm force-release" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only a supervisor can force-release a claim.",
    );
  });

  it("clears the reason after a successful release", async () => {
    // A stale reason must not ride along with a later release.
    vi.spyOn(actions, "forceReleaseIncident").mockResolvedValue({ ok: true });

    const user = await openModal();
    await user.type(screen.getByLabelText(/Reason/), "Crew reassigned.");
    await user.click(screen.getByRole("button", { name: "Confirm force-release" }));

    await user.click(
      await screen.findByRole("button", { name: "Force-release claim" }),
    );
    expect(screen.getByLabelText(/Reason/)).toHaveValue("");
  });

  it("shows no success banner — the page re-reads instead", async () => {
    vi.spyOn(actions, "forceReleaseIncident").mockResolvedValue({ ok: true });

    const user = await openModal();
    await user.type(screen.getByLabelText(/Reason/), "Crew reassigned.");
    await user.click(screen.getByRole("button", { name: "Confirm force-release" }));

    expect(screen.queryByText(/returned to the department pool/i)).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Force-release claim" }),
    ).toBeInTheDocument();
  });
});
