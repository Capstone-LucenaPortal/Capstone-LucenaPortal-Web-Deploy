import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import IncidentDetailPage from "./page";
import * as session from "@/portals/staff/features/auth/lib/session";
import * as dossier from "@/portals/staff/features/incidents/lib/incident-dossier";
import * as config from "@/portals/staff/features/incidents/lib/config";
import type { StaffUser } from "@/portals/staff/features/auth/types";
import type { Incident } from "@/portals/staff/features/incidents/types";

// The page renders RouteIncidentAction, a client component that calls
// useRouter, so the mock has to carry it alongside notFound.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

function makeUser(is_supervisor: boolean): StaffUser {
  return {
    id: "staff-001",
    email: "juan.delacruz@lucenacity.gov.ph",
    full_name: "Juan Dela Cruz",
    role: "staff",
    department: "Incident Desk",
    assignedModules: ["incidents"],
    is_supervisor,
    created_at: "2026-01-15T08:00:00.000Z",
  };
}

function makeIncident(over: Partial<Incident> = {}): Incident {
  return {
    id: "000000de-0000-4004-8000-000000000004",
    reference_number: "INC-2026-000079",
    type_label: "Burst main",
    incident_level: "critical",
    status: "in_pool",
    closure_reason: null,
    is_verified: true,
    barangay_name: "Cotta",
    submitted_at: "2026-08-07T06:00:00+08:00",
    sla_armed_at: "2026-08-07T08:00:00+08:00",
    sla_due_at: "2026-08-07T16:00:00+08:00",
    resolved_at: null,
    closed_at: null,
    incident_type_code: "burst_main",
    category_code: "infrastructure",
    description: "Main burst overnight; the whole block has no water.",
    address: "Del Pilar St.",
    barangay_code: "cotta",
    is_anonymous: false,
    verified_at: "2026-08-07T07:00:00+08:00",
    suggested_department_code: "water",
    assigned_department_code: "water",
    assigned_responder_id: null,
    assigned_responder_name: null,
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

/**
 * Two stubbed modules, not five. `getIncidentDossier` answers everything about
 * the incident, so adding a field to the screen no longer means editing a stub
 * block; the session answers who is looking, and the threshold is a third thing
 * the dossier deliberately does not carry.
 *
 * The labels arrive resolved, because resolving them is the dossier's job and
 * is asserted in its own test. What is left at this level is what the page does
 * with a resolved label and with its absence.
 */
function stubReads(
  incident: Incident | null,
  labels: {
    suggestedDepartmentLabel?: string | null;
    assignedDepartmentLabel?: string | null;
  } = {},
  isSupervisor = true,
) {
  vi.spyOn(session, "getCurrentStaffUser").mockResolvedValue(makeUser(isSupervisor));
  vi.spyOn(dossier, "getIncidentDossier").mockResolvedValue(
    incident === null
      ? null
      : {
          incident,
          events: [],
          photos: [],
          suggestedDepartmentLabel: "Water",
          assignedDepartmentLabel: "Water",
          departmentOptions: [["water", "Water"]],
          ...labels,
        },
  );
  vi.spyOn(config, "getAtRiskThreshold").mockResolvedValue(0.5);
}

function renderPage(id = "000000de-0000-4004-8000-000000000004") {
  return IncidentDetailPage({ params: Promise.resolve({ id }) });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IncidentDetailPage", () => {
  it("renders the incident the query returned", async () => {
    stubReads(makeIncident());
    render(await renderPage());

    expect(screen.getByRole("link", { name: /back to incidents/i })).toHaveAttribute(
      "href",
      "/staff/incidents",
    );
    expect(screen.getByText(/INC-2026-000079/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Burst main" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Main burst overnight; the whole block has no water."),
    ).toBeInTheDocument();
    // The page's half of the label rule: a resolved label reaches the screen.
    // Resolving it is the dossier's job and is asserted in the dossier's test.
    expect(screen.getAllByText("Water").length).toBeGreaterThan(0);
  });

  it("calls notFound when the incident is not visible to this staff member", async () => {
    // The view returns no rows for both "does not exist" and "not yours", and
    // the page must not distinguish them.
    stubReads(null);
    await expect(renderPage()).rejects.toThrow("notFound");
  });

  /**
   * The migration, counted: eleven tests before, ten now.
   *
   * **Two left.** "labels a department from the catalogue" and "falls back to
   * the raw code for a department the catalogue does not carry" moved down to
   * incident-dossier.test.ts, which is the layer that now owns both rules. They
   * are not duplicated here — "renders the incident the query returned" asserts
   * that a resolved label reaches the screen, which is the whole of the page's
   * share of them.
   *
   * **One arrived**, below. The two "not yet" strings stayed in the route when
   * the resolution left it, so the route became their only owner, and nothing
   * at any level had asserted them. Its counterpart in the dossier's test —
   * "reports an unrouted incident as null rather than as the screen's copy" —
   * pins the other half of the same rule.
   */
  it("names an unrouted incident rather than leaving the fields blank", async () => {
    stubReads(makeIncident(), {
      suggestedDepartmentLabel: null,
      assignedDepartmentLabel: null,
    });
    render(await renderPage());

    expect(screen.getByText("None suggested")).toBeInTheDocument();
    expect(screen.getByText("Not yet routed")).toBeInTheDocument();
  });

  it("withholds the contact number on an anonymous report", async () => {
    stubReads(
      makeIncident({
        is_anonymous: true,
        reporter_first_name: "Anonymous",
        reporter_phone: null,
      }),
    );
    render(await renderPage());

    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.getByText("Withheld — anonymous report")).toBeInTheDocument();
  });

  it("explains that an unverified report cannot start its clock", async () => {
    stubReads(
      makeIncident({ is_verified: false, verified_at: null, sla_due_at: null }),
    );
    render(await renderPage());

    expect(
      screen.getByText("No evidence photo yet — the SLA clock cannot start."),
    ).toBeInTheDocument();
  });

  it("names how many times a reopened incident came back", async () => {
    stubReads(makeIncident({ reopened_count: 1 }));
    render(await renderPage());
    expect(screen.getByText(/Reopened 1×/)).toBeInTheDocument();
  });

  it("shows the due time and the hour target beside the SLA badge", async () => {
    stubReads(makeIncident());
    render(await renderPage());
    expect(screen.getByText(/4h target/)).toBeInTheDocument();
  });

  it("offers routing on a routable incident", async () => {
    stubReads(makeIncident({ status: "open", routed_at: null }));
    render(await renderPage());
    expect(
      screen.getByRole("button", { name: "Route to department" }),
    ).toBeInTheDocument();
  });

  it("offers force-release to a supervisor on a claimed incident", async () => {
    stubReads(
      makeIncident({
        status: "in_progress",
        assigned_responder_name: "Dev Responder One",
      }),
    );
    render(await renderPage());
    expect(
      screen.getByRole("button", { name: "Force-release claim" }),
    ).toBeInTheDocument();
  });

  it.each(["open", "in_pool"] as const)(
    "offers refusal to any staff member on an %s report",
    async (status) => {
      stubReads(makeIncident({ status }), {}, false);
      render(await renderPage());
      expect(screen.getByRole("button", { name: "Refuse report" })).toBeInTheDocument();
    },
  );

  it.each(["in_progress", "resolved", "closed"] as const)(
    "does not offer refusal on a %s report",
    async (status) => {
      stubReads(makeIncident({ status }));
      render(await renderPage());
      expect(
        screen.queryByRole("button", { name: "Refuse report" }),
      ).not.toBeInTheDocument();
    },
  );

  it("links a Duplicate to its Original", async () => {
    stubReads(
      makeIncident({
        status: "closed",
        closure_reason: "duplicate",
        closed_at: "2026-08-07T09:00:00+08:00",
        duplicate_of: "000000de-0000-4004-8000-000000000001",
        original_reference: "INC-2026-000076",
      }),
    );
    render(await renderPage());
    expect(screen.getByRole("link", { name: "INC-2026-000076" })).toHaveAttribute(
      "href",
      "/staff/incidents/000000de-0000-4004-8000-000000000001",
    );
  });

  it("names no Original on a report that is not a Duplicate", async () => {
    stubReads(makeIncident({ status: "closed", closure_reason: "invalid" }));
    render(await renderPage());
    expect(screen.queryByText(/Duplicate of/)).not.toBeInTheDocument();
  });

  it("hides force-release from a non-supervisor", async () => {
    stubReads(
      makeIncident({
        status: "in_progress",
        assigned_responder_name: "Dev Responder One",
      }),
      {},
      false,
    );
    render(await renderPage());
    expect(
      screen.queryByRole("button", { name: "Force-release claim" }),
    ).not.toBeInTheDocument();
  });
});
