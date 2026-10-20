import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";
import * as session from "@/portals/staff/features/auth/lib/session";
import * as yellowCardDashboard from "@/portals/staff/features/yellow-card/lib/dashboard-card";
import * as incidentsDashboard from "@/portals/staff/features/incidents/lib/dashboard-card";
import * as bookingDashboard from "@/portals/staff/features/booking/lib/dashboard-card";
import type { StaffUser } from "@/portals/staff/features/auth/types";

function makeUser(assignedModules: StaffUser["assignedModules"]): StaffUser {
  return {
    id: "staff-001",
    email: "juan.delacruz@lucenacity.gov.ph",
    full_name: "Juan Dela Cruz",
    role: "staff",
    department: "Yellow Card Office",
    assignedModules,
    created_at: "2026-01-15T08:00:00.000Z",
  };
}

beforeEach(() => {
  vi.spyOn(yellowCardDashboard, "getYellowCardCard").mockResolvedValue({
    module: "yellow-card",
    pending: 6,
    atRisk: 1,
    overdue: 3,
    preview: [],
  });
  vi.spyOn(incidentsDashboard, "getIncidentCard").mockResolvedValue({
    module: "incidents",
    awaitingTriage: 9,
    critical: 4,
    high: 7,
    slaBreaches: 2,
    preview: [],
  });
  vi.spyOn(bookingDashboard, "getBookingCard").mockResolvedValue({
    module: "booking",
    awaitingQuote: 2,
    paymentVerification: 3,
    balanceOutstanding: 3,
    preview: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DashboardPage", () => {
  it("renders a card for each assigned module, in fixed order", async () => {
    vi.spyOn(session, "getCurrentStaffUser").mockResolvedValue(
      makeUser(["booking", "yellow-card"])
    );

    render(await DashboardPage());

    expect(screen.getByText("Welcome back, Juan Dela Cruz")).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 3 }).map(
      (el) => el.textContent
    );
    expect(headings).toEqual(["Yellow Card", "Booking"]);
  });

  it("builds the incidents card from the live read, not fixtures", async () => {
    vi.spyOn(session, "getCurrentStaffUser").mockResolvedValue(
      makeUser(["incidents"])
    );

    render(await DashboardPage());

    expect(incidentsDashboard.getIncidentCard).toHaveBeenCalled();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("builds the booking card from the live read, not fixtures", async () => {
    // getMockCard is gone; this was the last module still on fixtures.
    vi.spyOn(session, "getCurrentStaffUser").mockResolvedValue(
      makeUser(["booking"])
    );

    render(await DashboardPage());

    expect(bookingDashboard.getBookingCard).toHaveBeenCalled();
    expect(screen.getByText("Awaiting quote")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders the empty state when no modules are assigned", async () => {
    vi.spyOn(session, "getCurrentStaffUser").mockResolvedValue(makeUser([]));

    render(await DashboardPage());

    expect(screen.getByText("No module assigned yet.")).toBeInTheDocument();
  });
});
