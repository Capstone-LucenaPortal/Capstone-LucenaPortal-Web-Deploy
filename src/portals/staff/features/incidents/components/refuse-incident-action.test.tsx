import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RefuseIncidentAction } from "./refuse-incident-action";
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
    incident_level: "high",
    status: "open",
    closure_reason: null,
    is_verified: true,
    barangay_name: "Cotta",
    submitted_at: "2026-08-07T06:00:00+08:00",
    sla_armed_at: null,
    sla_due_at: null,
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
    assigned_department_code: null,
    assigned_responder_id: null,
    assigned_responder_name: null,
    routed_at: null,
    sla_target_hours: null,
    reopened_count: 0,
    reporter_first_name: "Linda",
    reporter_phone: "09170000001",
    photo_count: 1,
    duplicate_of: null,
    original_reference: null,
    ...over,
  };
}

async function openModal(over: Partial<Incident> = {}) {
  const user = userEvent.setup();
  render(<RefuseIncidentAction incident={makeIncident(over)} />);
  await user.click(screen.getByRole("button", { name: "Refuse report" }));
  return user;
}

const confirmButton = () => screen.getByRole("button", { name: "Confirm refusal" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RefuseIncidentAction", () => {
  it.each(["open", "in_pool"] as const)("is offered on an %s report", (status) => {
    render(<RefuseIncidentAction incident={makeIncident({ status })} />);
    expect(screen.getByRole("button", { name: "Refuse report" })).toBeInTheDocument();
  });

  it.each(["in_progress", "resolved", "closed"] as const)(
    "is not offered on a %s report",
    (status) => {
      render(<RefuseIncidentAction incident={makeIncident({ status })} />);
      expect(
        screen.queryByRole("button", { name: "Refuse report" }),
      ).not.toBeInTheDocument();
    },
  );

  it("asks for the Original's reference only on a Duplicate", async () => {
    const user = await openModal();

    expect(screen.queryByLabelText(/Original's reference/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Duplicate"));
    expect(screen.getByLabelText(/Original's reference/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("Invalid"));
    expect(screen.queryByLabelText(/Original's reference/)).not.toBeInTheDocument();
  });

  it("keeps confirm disabled until a reason is typed", async () => {
    const user = await openModal();

    expect(confirmButton()).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason/), "   ");
    expect(confirmButton()).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason/), "Not a city matter.");
    expect(confirmButton()).toBeEnabled();
  });

  it("keeps confirm disabled on a Duplicate until the Original is named", async () => {
    const user = await openModal();

    await user.click(screen.getByLabelText("Duplicate"));
    await user.type(screen.getByLabelText(/Reason/), "Same burst main.");
    expect(confirmButton()).toBeDisabled();
    await user.type(screen.getByLabelText(/Original's reference/), "INC-2026-000076");
    expect(confirmButton()).toBeEnabled();
  });

  it("caps the reason at 500 characters", async () => {
    const user = await openModal();
    const reason = screen.getByLabelText(/Reason/);

    expect(reason).toHaveAttribute("maxLength", "500");
    await user.click(reason);
    await user.paste("x".repeat(520));
    expect(reason).toHaveValue("x".repeat(500));
    expect(screen.getByText("500 / 500")).toBeInTheDocument();
  });

  it("refuses as Invalid with no Original reference", async () => {
    const refuse = vi.spyOn(actions, "refuseIncident").mockResolvedValue({ ok: true });

    const user = await openModal();
    await user.type(screen.getByLabelText(/Reason/), "Not a city matter.");
    await user.click(confirmButton());

    expect(refuse).toHaveBeenCalledWith({
      incidentId: "000000de-0000-4004-8000-000000000004",
      closureReason: "invalid",
      reason: "Not a city matter.",
      originalReference: null,
    });
  });

  it("refuses as a Duplicate with the Original's reference", async () => {
    const refuse = vi.spyOn(actions, "refuseIncident").mockResolvedValue({ ok: true });

    const user = await openModal({ status: "in_pool" });
    await user.click(screen.getByLabelText("Duplicate"));
    await user.type(screen.getByLabelText(/Original's reference/), " INC-2026-000076 ");
    await user.type(screen.getByLabelText(/Reason/), "Same burst main.");
    await user.click(confirmButton());

    expect(refuse).toHaveBeenCalledWith({
      incidentId: "000000de-0000-4004-8000-000000000004",
      closureReason: "duplicate",
      reason: "Same burst main.",
      originalReference: " INC-2026-000076 ",
    });
  });

  it("does not send a reference typed before switching back to Invalid", async () => {
    // refuse_incident refuses an Invalid that carries an Original reference.
    const refuse = vi.spyOn(actions, "refuseIncident").mockResolvedValue({ ok: true });

    const user = await openModal();
    await user.click(screen.getByLabelText("Duplicate"));
    await user.type(screen.getByLabelText(/Original's reference/), "INC-2026-000076");
    await user.click(screen.getByLabelText("Invalid"));
    await user.type(screen.getByLabelText(/Reason/), "Not a city matter.");
    await user.click(confirmButton());

    expect(refuse).toHaveBeenCalledWith(
      expect.objectContaining({ closureReason: "invalid", originalReference: null }),
    );
  });

  it("renders the failure message and keeps what was typed", async () => {
    vi.spyOn(actions, "refuseIncident").mockResolvedValue({
      ok: false,
      message: "No report has the reference number you entered.",
      stale: false,
    });

    const user = await openModal();
    await user.click(screen.getByLabelText("Duplicate"));
    await user.type(screen.getByLabelText(/Original's reference/), "INC-2026-999999");
    await user.type(screen.getByLabelText(/Reason/), "Same burst main.");
    await user.click(confirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No report has the reference number you entered.",
    );
    expect(screen.getByLabelText(/Original's reference/)).toHaveValue("INC-2026-999999");
  });

  it("closes the dialog after a refusal — the page re-reads instead of a banner", async () => {
    vi.spyOn(actions, "refuseIncident").mockResolvedValue({ ok: true });

    const user = await openModal();
    await user.type(screen.getByLabelText(/Reason/), "Not a city matter.");
    await user.click(confirmButton());

    expect(
      await screen.findByRole("button", { name: "Refuse report" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm refusal" })).not.toBeInTheDocument();
  });
});
