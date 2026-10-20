import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteIncidentAction } from "./route-incident-action";
import * as actions from "../lib/actions";
import type { Incident } from "../types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const DEPARTMENTS: [string, string][] = [
  ["engineering", "Engineering"],
  ["water", "Water"],
  ["electrical", "Electrical"],
];

function makeIncident(over: Partial<Incident> = {}): Incident {
  return {
    id: "000000de-0000-4004-8000-000000000001",
    reference_number: "INC-2026-000076",
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

function renderAction(over: Partial<Incident> = {}) {
  return render(
    <RouteIncidentAction incident={makeIncident(over)} departments={DEPARTMENTS} />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RouteIncidentAction", () => {
  it("offers to route an incident that has never been routed", () => {
    renderAction();
    expect(
      screen.getByRole("button", { name: "Route to department" }),
    ).toBeInTheDocument();
  });

  it("offers to reroute one that already has a routed_at", () => {
    renderAction({ status: "in_pool", routed_at: "2026-08-07T08:00:00+08:00" });
    expect(screen.getByRole("button", { name: "Reroute" })).toBeInTheDocument();
  });

  it("refuses to reroute a claimed incident and names who holds it", () => {
    // Rerouting an in_progress incident orphans the responder standing at the
    // site — the RPC allows it, this UI deliberately does not. Decision 7.
    renderAction({
      status: "in_progress",
      assigned_responder_name: "Dev Responder One",
    });

    expect(screen.getByText(/Held by Dev Responder One/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing at all for a resolved incident", () => {
    const { container } = renderAction({ status: "resolved" });
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults the selects to the suggested department and the current level", async () => {
    const user = userEvent.setup();
    renderAction();
    await user.click(screen.getByRole("button", { name: "Route to department" }));

    expect(screen.getByLabelText("Department")).toHaveValue("water");
    expect(screen.getByLabelText("Level")).toHaveValue("high");
  });

  it("calls routeIncident with the chosen department and level", async () => {
    const route = vi
      .spyOn(actions, "routeIncident")
      .mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    renderAction();
    await user.click(screen.getByRole("button", { name: "Route to department" }));
    await user.selectOptions(screen.getByLabelText("Department"), "engineering");
    await user.selectOptions(screen.getByLabelText("Level"), "critical");
    await user.click(screen.getByRole("button", { name: "Confirm route" }));

    expect(route).toHaveBeenCalledWith({
      incidentId: "000000de-0000-4004-8000-000000000001",
      departmentCode: "engineering",
      level: "critical",
      note: "",
    });
  });

  it("shows the failure message and keeps the modal open", async () => {
    vi.spyOn(actions, "routeIncident").mockResolvedValue({
      ok: false,
      message: "This incident can no longer be routed.",
      stale: true,
    });
    const user = userEvent.setup();

    renderAction();
    await user.click(screen.getByRole("button", { name: "Route to department" }));
    await user.click(screen.getByRole("button", { name: "Confirm route" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This incident can no longer be routed.",
    );
    expect(screen.getByLabelText("Department")).toBeInTheDocument();
  });

  it("clears the note after a successful route", async () => {
    // Caught in the live pass: the note survived the dialog closing, so
    // reopening it to reroute silently re-attached the previous routing's note
    // to a different decision.
    vi.spyOn(actions, "routeIncident").mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    renderAction();
    await user.click(screen.getByRole("button", { name: "Route to department" }));
    await user.type(screen.getByLabelText(/Note/), "Routed to Water.");
    await user.click(screen.getByRole("button", { name: "Confirm route" }));

    await user.click(
      await screen.findByRole("button", { name: "Route to department" }),
    );
    expect(screen.getByLabelText(/Note/)).toHaveValue("");
  });

  it("warns about the clock only while the report is unverified", async () => {
    const user = userEvent.setup();

    const { unmount } = renderAction({ is_verified: false });
    await user.click(screen.getByRole("button", { name: "Route to department" }));
    expect(screen.getByText(/will not start the SLA clock/)).toBeInTheDocument();
    unmount();

    renderAction({ is_verified: true });
    await user.click(screen.getByRole("button", { name: "Route to department" }));
    expect(
      screen.queryByText(/will not start the SLA clock/),
    ).not.toBeInTheDocument();
  });
});
