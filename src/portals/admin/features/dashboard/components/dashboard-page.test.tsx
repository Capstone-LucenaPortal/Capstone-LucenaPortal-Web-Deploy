// src/portals/admin/features/dashboard/components/dashboard-page.test.tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { metadata } from "@/app/(admin)/admin/(shell)/dashboard/page";
import { DashboardPage } from "./dashboard-page";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { BookingRow } from "@/portals/admin/features/booking/lib/bookings";
import { buildBookingRow as buildSharedBookingRow } from "@/portals/admin/features/booking/lib/fixtures";
import type { DepartmentRow } from "@/portals/admin/lib/supabase/catalogs";
import { presetDateRange } from "@/portals/admin/lib/dates";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module src/app/(admin)/admin/(shell)/dashboard/page.tsx
// imports — the same convention every other converted page's test uses.
//
// src/portals/admin/features/sla/lib/sla.ts is deliberately NOT mocked here (Admin Portal Fix Plan,
// Task 4.2): getSlaByDepartment/getSlaTrend no longer call listIncidents()/
// listApplications()/listDepartments() themselves — they are now pure,
// synchronous functions over rows the page fetches once via the mocks below
// — so the REAL implementation runs against those fetched rows, the same way
// executiveRangeStats/yellowCardRangeStats/etc. already do via aggregate.ts.
const mockListApplications = vi.fn();
const mockListIncidents = vi.fn();
const mockListBookings = vi.fn();
const mockListDepartments = vi.fn();
const mockListBarangays = vi.fn();
const mockListIncidentCategories = vi.fn();
const mockListBookingEventTypes = vi.fn();

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

vi.mock("../../yellow-card/lib/yellow-card", () => ({
  listApplications: (signal?: unknown) => mockListApplications(signal),
}));

vi.mock("../../incidents/lib/incidents", () => ({
  listIncidents: (signal?: unknown) => mockListIncidents(signal),
}));

vi.mock("../../booking/lib/bookings", () => ({
  listBookings: (signal?: unknown) => mockListBookings(signal),
}));

vi.mock("../../../lib/supabase/catalogs", () => ({
  listBarangays: () => mockListBarangays(),
  listDepartments: () => mockListDepartments(),
  listIncidentCategories: () => mockListIncidentCategories(),
  listBookingEventTypes: () => mockListBookingEventTypes(),
}));

// The page's default preset is "Month", and every KPI/module card derives
// from real fetched rows filtered by filterByDateRange against real
// wall-clock "now". Using the current instant, like every other converted
// page's test suite does, is the only submitted_at guaranteed to sit inside
// every preset's [from, today] bounds on any day this suite runs.
function defaultSubmittedAt(): string {
  return new Date().toISOString();
}

// The shared builder's dates are fixed; this page's rows default to now, for
// the reason above.
function buildBookingRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return buildSharedBookingRow({ submitted_at: defaultSubmittedAt(), ...overrides });
}

function buildYellowCardRow(overrides: Partial<YellowCardRow> = {}): YellowCardRow {
  return {
    id: "app-1",
    reference_number: "YC-2026-000001",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    status: "approved",
    submitted_at: defaultSubmittedAt(),
    decided_at: null,
    sla_target_hours: 48,
    sla_elapsed_seconds: 1000,
    sla_breached: false,
    review_cycles: 0,
    due_at: null,
    deadline_state: null,
    is_correction: false,
    ...overrides,
  };
}

function buildIncidentRow(overrides: Partial<IncidentRow> = {}): IncidentRow {
  return {
    id: "inc-1",
    reference_number: "IR-2026-000001",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    incident_type_code: "pothole",
    incident_type_label: "Pothole",
    category_code: "infrastructure",
    incident_level: "medium",
    assigned_department_code: "DPW",
    status: "resolved",
    closure_reason: null,
    submitted_at: defaultSubmittedAt(),
    routed_at: null,
    resolved_at: defaultSubmittedAt(),
    closed_at: null,
    reopened_count: 0,
    time_to_triage_hours: null,
    // Resolved and on time by default, so it has a due time: a report with
    // none never had a clock and is not scored (#125).
    sla_due_at: defaultSubmittedAt(),
    sla_at_risk: null,
    sla_met: true,
    ...overrides,
  };
}

function buildDepartment(overrides: Partial<DepartmentRow> = {}): DepartmentRow {
  return { code: "waste", label: "Waste Management", sort_order: 1, ...overrides };
}

// getSlaTrend/getSlaByDepartment now bucket by real calendar month (Manila
// timezone) rather than returning a canned label, so a test that needs two
// DISTINCT months' worth of trend data computes the real label for a given
// ISO timestamp instead of hardcoding "Jun 2026"/"Jul 2026" literals that
// would only coincidentally match whatever the suite's actual run date is.
function manilaMonthLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", year: "numeric" }).format(
    new Date(iso)
  );
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

describe("DashboardPage", () => {
  beforeEach(() => {
    mockListApplications.mockReset();
    mockListIncidents.mockReset();
    mockListBookings.mockReset();
    mockListDepartments.mockReset();
    mockListApplications.mockResolvedValue([]);
    mockListIncidents.mockResolvedValue([]);
    mockListBookings.mockResolvedValue([]);
    mockListDepartments.mockResolvedValue([]);
    mockListBarangays.mockReset();
    mockListBarangays.mockResolvedValue([]);
    mockListIncidentCategories.mockReset();
    mockListIncidentCategories.mockResolvedValue([]);
    mockListBookingEventTypes.mockReset();
    mockListBookingEventTypes.mockResolvedValue([]);
  });

  // The name comes from the server wrapper, so it is there on the first
  // render, not after the browser has read the session.
  it("greets the admin by the name the server gave it, on the first render", () => {
    render(<DashboardPage displayName="Juan Dela Cruz" />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz · leadership view")).toBeInTheDocument();
    expect(screen.queryByText(/Admin User/)).not.toBeInTheDocument();
  });

  it("falls back to a nameless greeting without a name", () => {
    render(<DashboardPage displayName="" />);
    expect(screen.getByText("Leadership view")).toBeInTheDocument();
  });

  // The other four converted pages each pin both "an empty result renders an
  // empty state, not an error" and "a kind: permission rejection renders the
  // permission message" (see e.g. src/portals/admin/features/yellow-card/components/yellow-card-page.test.tsx). The
  // Dashboard had neither — this brings it in line with the rest.
  it("shows no error banner, not a false permission/load-failure message, when all three fetches resolve to []", async () => {
    render(<DashboardPage displayName="Juan Dela Cruz" />);

    await screen.findByText("Service requests filed");
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unable to load/i)).not.toBeInTheDocument();
  });

  it("shows a permission message when the initial fetch rejects with kind: permission", async () => {
    mockListApplications.mockRejectedValue({
      kind: "permission",
      message: "caller is not an active Admin",
    });

    render(<DashboardPage displayName="Juan Dela Cruz" />);

    expect(
      await screen.findByText("You do not have permission to view dashboard data.")
    ).toBeInTheDocument();
  });

  // Admin Portal Fix Plan, Task 1.5: before this fix, the four hero KPI
  // tiles read straight off `stats` (derived from `yellowCardRows`/
  // `incidentRows`/`bookingRows`, which stay [] on a fetch failure), so a
  // failed fetch painted the exact same "0%"/"0" headline as a genuine quiet
  // period. Every tile must now render "—" and no digit at all on error.
  it("on fetch error, none of the four hero KPI tiles show a number — not 0, not a stale value", async () => {
    mockListApplications.mockRejectedValue({ kind: "unknown", message: "network down" });

    render(<DashboardPage displayName="Juan Dela Cruz" />);

    await screen.findByText(/Unable to load dashboard data/);

    for (const label of ["Service requests filed", "Service backlog", "SLA compliance", "Days with an event"]) {
      const tile = screen.getByText(label).closest("div");
      expect(tile).not.toBeNull();
      // The SLA compliance tile carries one "—" per service (#119).
      expect(within(tile as HTMLElement).getAllByText("—").length).toBeGreaterThan(0);
      expect(within(tile as HTMLElement).queryByText(/\d/)).not.toBeInTheDocument();
    }
  });

  it("renders the four KPI tile labels", async () => {
    render(<DashboardPage displayName="Juan Dela Cruz" />);
    expect(await screen.findByText("Service requests filed")).toBeInTheDocument();
    expect(screen.getByText("Service backlog")).toBeInTheDocument();
    expect(screen.getByText("SLA compliance")).toBeInTheDocument();
    expect(screen.getByText("Days with an event")).toBeInTheDocument();
  });

  it("service requests filed sums real fetched rows across all three modules for the active range", async () => {
    mockListApplications.mockResolvedValue([buildYellowCardRow()]);
    mockListIncidents.mockResolvedValue([buildIncidentRow(), buildIncidentRow({ id: "inc-2" })]);
    mockListBookings.mockResolvedValue([buildBookingRow()]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);

    expect(await screen.findByText("4")).toBeInTheDocument();
  });

  // The backlog uses the Staff Portal's own Backlog statuses, so both Portals
  // give the same number (#116, metrics sheet D2).
  describe("Service backlog (#116)", () => {
    async function backlogTile(): Promise<HTMLElement> {
      await screen.findByText("Service requests filed");
      return screen.getByText("Service backlog").closest("div") as HTMLElement;
    }

    it("leaves out a Yellow Card in revision: it waits on the resident", async () => {
      mockListApplications.mockResolvedValue([
        buildYellowCardRow({ id: "app-1", status: "pending" }),
        buildYellowCardRow({ id: "app-2", status: "resubmitted" }),
        buildYellowCardRow({ id: "app-3", status: "revision_requested" }),
      ]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const tile = await backlogTile();
      await waitFor(() => expect(within(tile).getByText("2")).toBeInTheDocument());
    });

    it("counts a confirmed booking: the office still records the balance", async () => {
      mockListBookings.mockResolvedValue([
        buildBookingRow({ id: "b-1", status: "confirmed" }),
        buildBookingRow({ id: "b-2", status: "awaiting_payment" }),
        buildBookingRow({ id: "b-3", status: "fully_paid" }),
      ]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const tile = await backlogTile();
      await waitFor(() => expect(within(tile).getByText("1")).toBeInTheDocument());
    });

    it("says it ignores the date range, and still says how much of it was filed this period", async () => {
      mockListIncidents.mockResolvedValue([
        buildIncidentRow({ id: "inc-1", status: "open", resolved_at: null }),
        buildIncidentRow({ id: "inc-2", status: "in_progress", resolved_at: null, submitted_at: daysAgoIso(400) }),
      ]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const tile = await backlogTile();
      await waitFor(() => expect(within(tile).getByText("2")).toBeInTheDocument());
      expect(within(tile).getByText("Waiting on the city now · ignores the date range")).toBeInTheDocument();
      expect(within(tile).getByText("+1 newly filed this period")).toBeInTheDocument();
    });
  });

  it("module cards link to their tabs", async () => {
    render(<DashboardPage displayName="Juan Dela Cruz" />);
    await screen.findByText("Service requests filed");
    expect(screen.getByRole("link", { name: /^Yellow Card/ })).toHaveAttribute("href", "/admin/yellow-card");
    expect(screen.getByRole("link", { name: /^Incident Reports/ })).toHaveAttribute("href", "/admin/issue-reports");
    expect(screen.getByRole("link", { name: /^Convention Center/ })).toHaveAttribute("href", "/admin/convention-center");
    expect(screen.getByRole("link", { name: /^SLA Reports/ })).toHaveAttribute("href", "/admin/sla-reports");
  });

  // Regression guard for the fabricated footnote this task removes: the old
  // mock always read "85.6% of monthly target · top: Brgy. 9" regardless of
  // what was fetched. It must now be derived from real rows, and a barangay
  // this fixture never mentions must not appear.
  it("the Yellow Card module card footnote is derived from real rows, not a fixed mock figure", async () => {
    mockListApplications.mockResolvedValue([
      buildYellowCardRow({ barangay_name: "Barangay One", status: "approved" }),
      buildYellowCardRow({ id: "app-2", barangay_name: "Barangay One", status: "approved" }),
    ]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);

    const card = await screen.findByRole("link", { name: /^Yellow Card/ });
    expect(within(card).getByText(/100% approval rate · top: Barangay One/)).toBeInTheDocument();
    expect(within(card).queryByText(/85\.6%/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/Brgy\. 9/)).not.toBeInTheDocument();
  });

  // Admin Portal Fix Plan, Task 1.5: with zero decided applications there is
  // no approval rate to report — the footnote must say so honestly ("No
  // decided applications in range"), not render "0% approval rate", which
  // would misreport a quiet period as a wave of rejections.
  it("the Yellow Card module card states a real gap, not a fabricated top barangay, when there are no rows in range", async () => {
    render(<DashboardPage displayName="Juan Dela Cruz" />);

    const card = await screen.findByRole("link", { name: /^Yellow Card/ });
    expect(within(card).getByText("No decided applications in range")).toBeInTheDocument();
    expect(within(card).queryByText(/0% approval rate/)).not.toBeInTheDocument();
  });

  // #120, sheet I2: the Incident Reports card shows the same Resolution Rate
  // as its page, so a duplicate leaves the denominator here too.
  it("the Incident Reports card's resolution rate leaves duplicates out", async () => {
    mockListIncidents.mockResolvedValue([
      buildIncidentRow(),
      buildIncidentRow({ id: "inc-2", status: "closed", closure_reason: "duplicate", resolved_at: null, sla_due_at: null, sla_met: null }),
    ]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);

    const card = await screen.findByRole("link", { name: /^Incident Reports/ });
    expect(await within(card).findByText(/^100% resolved · top:/)).toBeInTheDocument();
  });

  // Reports were filed but every one was a duplicate: the card must not
  // claim there were no incidents beside a count of 2.
  // Nor may it read "— resolved": there was nothing to resolve (#133).
  it("the Incident Reports card says 'none resolvable' when every report was closed as invalid or a duplicate", async () => {
    const closed = { status: "closed" as const, resolved_at: null, sla_due_at: null, sla_met: null };
    mockListIncidents.mockResolvedValue([
      buildIncidentRow({ ...closed, closure_reason: "duplicate" }),
      buildIncidentRow({ ...closed, id: "inc-2", closure_reason: "invalid" }),
    ]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);

    const card = await screen.findByRole("link", { name: /^Incident Reports/ });
    expect(await within(card).findByText(/^none resolvable · top:/)).toBeInTheDocument();
    expect(within(card).queryByText(/resolved/)).not.toBeInTheDocument();
    expect(within(card).queryByText("No incidents in range")).not.toBeInTheDocument();
  });

  it("the Incident Reports card still reads a real 0% as '0% resolved'", async () => {
    mockListIncidents.mockResolvedValue([buildIncidentRow({ status: "open", resolved_at: null, sla_met: null })]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);

    const card = await screen.findByRole("link", { name: /^Incident Reports/ });
    expect(await within(card).findByText(/^0% resolved · top:/)).toBeInTheDocument();
  });

  // #142: the analytics views carry only the code, so the card reads the
  // label from the public catalog, as the Incident Reports page does.
  describe("module card labels (#142)", () => {
    it("the Incident Reports card names the top category by its label", async () => {
      mockListIncidents.mockResolvedValue([buildIncidentRow({ category_code: "infrastructure" })]);
      mockListIncidentCategories.mockResolvedValue([{ code: "infrastructure", label: "Infrastructure", sort_order: 1 }]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const card = await screen.findByRole("link", { name: /^Incident Reports/ });
      expect(await within(card).findByText(/resolved · top: Infrastructure$/)).toBeInTheDocument();
    });

    it("the Convention Center card names the top event type by its label", async () => {
      mockListBookings.mockResolvedValue([
        buildBookingRow({ event_type_code: "wedding" }),
        buildBookingRow({ id: "booking-2", event_type_code: "wedding" }),
      ]);
      mockListBookingEventTypes.mockResolvedValue([{ code: "wedding", label: "Wedding", sort_order: 1 }]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const card = await screen.findByRole("link", { name: /^Convention Center/ });
      expect(await within(card).findByText(/· top: Wedding \(2\)$/)).toBeInTheDocument();
    });

    it("both cards fall back to the raw code, with no error state, when the catalogs fail to load", async () => {
      mockListIncidents.mockResolvedValue([buildIncidentRow({ category_code: "infrastructure" })]);
      mockListBookings.mockResolvedValue([buildBookingRow({ event_type_code: "wedding" })]);
      mockListIncidentCategories.mockRejectedValue({ kind: "unknown", message: "catalog down" });
      mockListBookingEventTypes.mockRejectedValue({ kind: "unknown", message: "catalog down" });

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const incidentCard = await screen.findByRole("link", { name: /^Incident Reports/ });
      expect(await within(incidentCard).findByText(/resolved · top: infrastructure$/)).toBeInTheDocument();
      const conventionCard = screen.getByRole("link", { name: /^Convention Center/ });
      expect(within(conventionCard).getByText(/· top: wedding \(1\)$/)).toBeInTheDocument();
      expect(screen.queryByText(/Unable to load/)).not.toBeInTheDocument();
      expect(await screen.findByText(/^Updated .*\(Asia\/Manila\)$/)).toBeInTheDocument();
    });

    it("both cards fall back to the raw code when the catalog has no entry for it", async () => {
      mockListIncidents.mockResolvedValue([buildIncidentRow({ category_code: "infrastructure" })]);
      mockListBookings.mockResolvedValue([buildBookingRow({ event_type_code: "wedding" })]);
      mockListIncidentCategories.mockResolvedValue([{ code: "health", label: "Health", sort_order: 1 }]);
      mockListBookingEventTypes.mockResolvedValue([{ code: "conference", label: "Conference", sort_order: 1 }]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const incidentCard = await screen.findByRole("link", { name: /^Incident Reports/ });
      expect(await within(incidentCard).findByText(/resolved · top: infrastructure$/)).toBeInTheDocument();
      const conventionCard = screen.getByRole("link", { name: /^Convention Center/ });
      expect(within(conventionCard).getByText(/· top: wedding \(1\)$/)).toBeInTheDocument();
    });
  });

  // SCRUM-131 / #174 (D5): the Convention Center card leads with the same
  // Booking compliance the SLA compliance tile shows, as the Yellow Card and
  // incident cards lead with their own rates.
  describe("the Convention Center card's decided on time", () => {
    it("shows Booking's SLA compliance, the tile's own figure", async () => {
      mockListBookings.mockResolvedValue([
        buildBookingRow({ id: "b-1", event_type_code: "wedding", sla_scoreable: true, sla_on_time: true }),
        buildBookingRow({ id: "b-2", event_type_code: "wedding", sla_scoreable: true, sla_on_time: true }),
        buildBookingRow({ id: "b-3", event_type_code: "concert", sla_scoreable: true, sla_on_time: false }),
        // No clock: counted as a booking, not scored.
        buildBookingRow({ id: "b-4", event_type_code: "wedding" }),
      ]);
      mockListBookingEventTypes.mockResolvedValue([{ code: "wedding", label: "Wedding", sort_order: 1 }]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const card = await screen.findByRole("link", { name: /^Convention Center/ });
      expect(await within(card).findByText("66.7% decided on time · top: Wedding (3)")).toBeInTheDocument();
      const tile = screen.getByText("SLA compliance").closest("div") as HTMLElement;
      expect(within(tile).getByText("Booking")).toBeInTheDocument();
      expect(within(tile).getByText("66.7%")).toBeInTheDocument();
    });

    it("says nothing was decided, not 0%, when no booking in range was scored", async () => {
      mockListBookings.mockResolvedValue([buildBookingRow({ event_type_code: "wedding" })]);
      mockListBookingEventTypes.mockResolvedValue([{ code: "wedding", label: "Wedding", sort_order: 1 }]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const card = await screen.findByRole("link", { name: /^Convention Center/ });
      expect(await within(card).findByText("Nothing decided in range · top: Wedding (1)")).toBeInTheDocument();
    });
  });

  it("switching range presets re-derives the KPI and module card values from the same fetched rows", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([buildYellowCardRow()]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);
    await screen.findByText("Service requests filed");

    await user.click(screen.getByRole("button", { name: "Today" }));

    // Re-rendering under a different preset must not crash and must still
    // show the module's KPI tile labels.
    expect(screen.getByText("Service requests filed")).toBeInTheDocument();
  });

  // Regression guard: the old mock's needsAttention list was four fixed
  // items regardless of any fetched data. It must now be derived from real
  // signals, and must be empty (with an honest empty state) when none of
  // those signals fire.
  it("shows an honest empty state when no real signal currently needs attention", async () => {
    render(<DashboardPage displayName="Juan Dela Cruz" />);

    expect(await screen.findByText("No items currently need attention.")).toBeInTheDocument();
    expect(screen.getByText("Needs attention · 0")).toBeInTheDocument();
  });

  // Admin Portal Fix Plan, Task 4.2: getSlaByDepartment is no longer mocked
  // to return a canned row — it runs for real against the fetched
  // incidents/departments, so this drives it with a real fixture (1 met, 4
  // unmet in the "waste" department = 20% compliance) instead of a
  // hand-built SlaDepartmentRow.
  it("a department below the 65% threshold surfaces as a needs-attention item linking to /sla-reports", async () => {
    mockListDepartments.mockResolvedValue([buildDepartment({ code: "waste", label: "Waste Management" })]);
    mockListIncidents.mockResolvedValue([
      buildIncidentRow({ id: "inc-1", assigned_department_code: "waste", sla_met: true }),
      buildIncidentRow({ id: "inc-2", assigned_department_code: "waste", sla_met: false }),
      buildIncidentRow({ id: "inc-3", assigned_department_code: "waste", sla_met: false }),
      buildIncidentRow({ id: "inc-4", assigned_department_code: "waste", sla_met: false }),
      buildIncidentRow({ id: "inc-5", assigned_department_code: "waste", sla_met: false }),
    ]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);

    const link = await screen.findByRole("link", { name: /Waste Management SLA at 20%/ });
    expect(link).toHaveAttribute("href", "/admin/sla-reports");
    // #140: several requests keep the plural.
    expect(screen.getByText(/^5 requests in range · below the 65% "Needs attention" threshold$/)).toBeInTheDocument();
  });

  // #140: the detail line said "1 requests in range" for an area resting on
  // one request; metrics.md D6 promises "1 request".
  it("says '1 request in range' for a department below the threshold on one request", async () => {
    mockListDepartments.mockResolvedValue([buildDepartment({ code: "electrical", label: "Electrical" })]);
    mockListIncidents.mockResolvedValue([
      buildIncidentRow({ id: "inc-1", assigned_department_code: "electrical", sla_met: false }),
    ]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);

    expect(await screen.findByText(/^1 request in range · below the 65% "Needs attention" threshold$/)).toBeInTheDocument();
  });

  // SCRUM-131 / #174: the Convention Center is a row in By department (S6),
  // so a booking desk under 65% is flagged like any other service area.
  it("flags the Convention Center when its booking compliance is below the threshold", async () => {
    mockListBookings.mockResolvedValue([
      buildBookingRow({ id: "b-1", sla_scoreable: true, sla_on_time: true }),
      buildBookingRow({ id: "b-2", sla_scoreable: true, sla_on_time: false }),
      buildBookingRow({ id: "b-3", sla_scoreable: true, sla_on_time: false }),
    ]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);

    expect(await screen.findByRole("link", { name: /Convention Center SLA at 33.3%/ })).toHaveAttribute(
      "href",
      "/admin/sla-reports"
    );
  });

  // SCRUM-131 / #174 (D6): what is late right now, per service, counted as
  // SLA Reports' Past due now counts it, whatever the range. Each item opens
  // its page's table narrowed to those requests (#127; Booking's since #175).
  describe("past due now in Needs attention", () => {
    it("raises one item per service with requests past due, linking to them", async () => {
      mockListApplications.mockResolvedValue([
        buildYellowCardRow({ id: "app-1", status: "pending", deadline_state: "overdue" }),
        buildYellowCardRow({ id: "app-2", status: "resubmitted", deadline_state: "overdue" }),
        buildYellowCardRow({ id: "app-3", status: "pending", deadline_state: "at_risk" }),
      ]);
      mockListIncidents.mockResolvedValue([
        buildIncidentRow({ status: "open", incident_level: "critical", submitted_at: hoursAgo(5), sla_due_at: hoursAgo(1) }),
      ]);
      mockListBookings.mockResolvedValue([
        buildBookingRow({ id: "b-1", status: "awaiting_quote", deadline_state: "overdue" }),
        // Confirmed and waiting on its balance: off the clock.
        buildBookingRow({ id: "b-2", status: "confirmed", deadline_state: null }),
      ]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      expect(await screen.findByRole("link", { name: /2 Yellow Card applications past due/ })).toHaveAttribute(
        "href",
        "/admin/yellow-card?sla=past-due"
      );
      expect(screen.getByRole("link", { name: /1 incident report past due/ })).toHaveAttribute(
        "href",
        "/admin/issue-reports?sla=past-due"
      );
      expect(screen.getByRole("link", { name: /1 booking past due/ })).toHaveAttribute(
        "href",
        "/admin/convention-center?sla=past-due"
      );
      expect(screen.getByText("Needs attention · 3")).toBeInTheDocument();
    });

    it("raises none for a service with nothing past due", async () => {
      mockListApplications.mockResolvedValue([buildYellowCardRow({ status: "pending", deadline_state: "on_track" })]);
      mockListBookings.mockResolvedValue([buildBookingRow({ status: "payment_verification", deadline_state: "at_risk" })]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      expect(await screen.findByText("No items currently need attention.")).toBeInTheDocument();
      expect(screen.queryByText(/past due/)).not.toBeInTheDocument();
    });
  });

  it("renders the SLA module card's trend bars from getSlaTrend's real derived data, not a mock table", async () => {
    const recentDate = defaultSubmittedAt();
    mockListIncidents.mockResolvedValue([
      buildIncidentRow({ id: "inc-1", submitted_at: recentDate, resolved_at: recentDate, sla_met: true }),
    ]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);

    const card = await screen.findByRole("link", { name: /^SLA Reports/ });
    const label = manilaMonthLabel(recentDate);
    expect(
      within(card).getByRole("img", { name: `Incidents resolved on time, by month: ${label} 100%` })
    ).toBeInTheDocument();
    expect(within(card).getByText("Bars: incidents resolved on time, by month")).toBeInTheDocument();
  });

  // An event day is a day with a confirmed, fully paid or completed booking
  // (#117, metrics sheet D4). The Convention Center's Event days tile shows
  // the same figure (C2), pinned by the same two cases in its own page test.
  describe("Days with an event (#117)", () => {
    async function eventDaysTile(): Promise<HTMLElement> {
      await screen.findByText("Service requests filed");
      return screen.getByText("Days with an event").closest("div") as HTMLElement;
    }

    it("a booking awaiting a quote, review or payment makes no event day", async () => {
      const user = userEvent.setup();
      const { to: today } = presetDateRange("Today");
      const waiting: BookingRow["status"][] = [
        "pending",
        "awaiting_tier_review",
        "awaiting_resubmission",
        "awaiting_quote",
        "awaiting_payment",
        "payment_verification",
        "cancelled",
      ];
      mockListBookings.mockResolvedValue(
        waiting.map((status, index) => buildBookingRow({ id: `b-${index}`, status, event_date: today }))
      );

      render(<DashboardPage displayName="Juan Dela Cruz" />);
      const tile = await eventDaysTile();
      await user.click(screen.getByRole("button", { name: "Today" }));

      await waitFor(() => expect(within(tile).getByText("0%")).toBeInTheDocument());
      expect(within(tile).getByText("0 of 1 day had an event")).toBeInTheDocument();
    });

    it("two confirmed bookings on one day make one event day, on Annual", async () => {
      const user = userEvent.setup();
      const { from, to } = presetDateRange("Annual");
      mockListBookings.mockResolvedValue([
        buildBookingRow({ id: "b-1", status: "confirmed", event_date: from }),
        buildBookingRow({ id: "b-2", status: "confirmed", event_date: from }),
        buildBookingRow({ id: "b-3", status: "fully_paid", event_date: to }),
        buildBookingRow({ id: "b-4", status: "completed", event_date: to }),
        buildBookingRow({ id: "b-5", status: "awaiting_payment", event_date: `${from.slice(0, 8)}02` }),
      ]);
      const days = new Set([from, to]).size;
      const totalDays = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;

      render(<DashboardPage displayName="Juan Dela Cruz" />);
      const tile = await eventDaysTile();
      await user.click(screen.getByRole("button", { name: "Annual" }));

      await waitFor(() =>
        expect(within(tile).getByText(`${days} of ${totalDays} day${totalDays === 1 ? "" : "s"} had an event`)).toBeInTheDocument()
      );
      expect(within(tile).getByText(`${Math.round((days / totalDays) * 1000) / 10}%`)).toBeInTheDocument();
    });
  });

  // #119: SLA compliance is shown once per service, never pooled, because
  // the Yellow Card clock (3 working days, a legal processing time) and the
  // incident clocks (4-72 calendar hours, voluntary standards) are different
  // promises. The fixture is chosen so a pooled figure would show: Yellow
  // Card 3 of 4 on time (75%), incidents 1 of 2 (50%), pooled 4 of 6
  // (66.7%).
  describe("SLA compliance per service (#119)", () => {
    function slaTile(): HTMLElement {
      return screen.getByText("SLA compliance").closest("div") as HTMLElement;
    }

    async function waitForSlaTile(text: string): Promise<HTMLElement> {
      await screen.findByText("Service requests filed");
      return await waitFor(() => {
        const tile = slaTile();
        expect(within(tile).getByText(text)).toBeInTheDocument();
        return tile;
      });
    }

    function threeOfFourYellowCardsOnTime(): YellowCardRow[] {
      return [
        buildYellowCardRow({ id: "app-1", status: "approved", sla_breached: false }),
        buildYellowCardRow({ id: "app-2", status: "approved", sla_breached: false }),
        buildYellowCardRow({ id: "app-3", status: "rejected", sla_breached: false }),
        buildYellowCardRow({ id: "app-4", status: "approved", sla_breached: true }),
      ];
    }

    function oneOfTwoIncidentsOnTime(): IncidentRow[] {
      return [
        buildIncidentRow({ id: "inc-1", sla_met: true }),
        buildIncidentRow({ id: "inc-2", sla_met: false }),
      ];
    }

    it("shows a Yellow Card figure and an incident figure, each with its gap to the project target, and no pooled one", async () => {
      mockListApplications.mockResolvedValue(threeOfFourYellowCardsOnTime());
      mockListIncidents.mockResolvedValue(oneOfTwoIncidentsOnTime());

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const tile = await waitForSlaTile("75%");
      expect(within(tile).getByText("Yellow Card")).toBeInTheDocument();
      expect(within(tile).getByText("10 pts below 85% project target")).toBeInTheDocument();
      expect(within(tile).getByText("Incidents")).toBeInTheDocument();
      expect(within(tile).getByText("50%")).toBeInTheDocument();
      expect(within(tile).getByText("35 pts below 85% project target")).toBeInTheDocument();
      expect(screen.queryByText("66.7%")).not.toBeInTheDocument();
    });

    it("a withdrawn application is not scored, however long it sat", async () => {
      mockListApplications.mockResolvedValue([
        buildYellowCardRow({ id: "app-1", status: "approved", sla_breached: false }),
        // Withdrawn after five working days on the clock: the resident ended
        // it, not the city, so it is neither on time nor late.
        buildYellowCardRow({ id: "app-2", status: "withdrawn", sla_elapsed_seconds: 45 * 3600, sla_breached: true }),
      ]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const tile = await waitForSlaTile("100%");
      expect(within(tile).getByText("15 pts above 85% project target")).toBeInTheDocument();
      expect(within(tile).queryByText("50%")).not.toBeInTheDocument();
    });

    it('a service with nothing scored reads "—", not 0%', async () => {
      mockListApplications.mockResolvedValue([
        buildYellowCardRow({ id: "app-1", status: "withdrawn", sla_breached: true }),
      ]);
      mockListIncidents.mockResolvedValue(oneOfTwoIncidentsOnTime());

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      const tile = await waitForSlaTile("50%");
      // Yellow Card scored nothing (and Booking, with no rows, neither).
      const yellowCard = within(tile).getByText("Yellow Card").closest("div") as HTMLElement;
      expect(within(yellowCard).getByText("—")).toBeInTheDocument();
      expect(within(yellowCard).getByText("Nothing scored in range")).toBeInTheDocument();
      expect(within(tile).queryByText("0%")).not.toBeInTheDocument();
    });

    it("a withdrawn application raises no Yellow Card needs-attention alert", async () => {
      mockListApplications.mockResolvedValue([
        buildYellowCardRow({ id: "app-1", status: "withdrawn", sla_elapsed_seconds: 45 * 3600, sla_breached: true }),
      ]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      expect(await screen.findByText("No items currently need attention.")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Yellow Card SLA at/ })).not.toBeInTheDocument();
    });

    it("each figure's delta says better or worse against the previous period", async () => {
      const user = userEvent.setup();
      // "Today" compares with yesterday: Yellow Card went from 0 of 1 to 1 of
      // 1 on time, incidents from 1 of 1 to 0 of 1.
      mockListApplications.mockResolvedValue([
        buildYellowCardRow({ id: "app-old", submitted_at: hoursAgo(24), sla_breached: true }),
        buildYellowCardRow({ id: "app-new", sla_breached: false }),
      ]);
      mockListIncidents.mockResolvedValue([
        buildIncidentRow({ id: "inc-old", submitted_at: hoursAgo(24), resolved_at: hoursAgo(23), sla_met: true }),
        buildIncidentRow({ id: "inc-new", sla_met: false }),
      ]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);
      await screen.findByText("Service requests filed");
      await user.click(screen.getByRole("button", { name: "Today" }));

      const tile = await waitForSlaTile("100%");
      expect(within(tile).getByText("+100 pts vs previous period · better")).toHaveClass("text-green-700");
      expect(within(tile).getByText("-100 pts vs previous period · worse")).toHaveClass("text-red-700");
    });

    it("the SLA card shows the same two figures, without a trend average or a best month", async () => {
      mockListApplications.mockResolvedValue(threeOfFourYellowCardsOnTime());
      mockListIncidents.mockResolvedValue(oneOfTwoIncidentsOnTime());

      render(<DashboardPage displayName="Juan Dela Cruz" />);
      await waitForSlaTile("75%");

      const card = screen.getByRole("link", { name: /^SLA Reports/ });
      expect(within(card).getByText("Yellow Card")).toBeInTheDocument();
      expect(within(card).getByText("75%")).toBeInTheDocument();
      expect(within(card).getByText("Incidents")).toBeInTheDocument();
      expect(within(card).getByText("50%")).toBeInTheDocument();
      expect(within(card).queryByText("66.7%")).not.toBeInTheDocument();
      expect(within(card).queryByText(/Trend avg/)).not.toBeInTheDocument();
      expect(within(card).queryByText(/Best/)).not.toBeInTheDocument();
    });
  });

  // Admin Portal Fix Plan, Task 4.2: department/trend figures are now
  // derived (via useMemo) from the SAME once-per-load fetch as the four hero
  // KPI tiles, not a second independently re-fetched dataset — so switching
  // presets can no longer produce the old bug (Phase 1 final review, finding
  // 5) where a failed SECOND fetch left the previous range's figures on
  // screen. This pins the new, stronger guarantee instead: switching presets
  // recomputes the SAME derived figures with NO additional fetch at all (see
  // the "each analytics table is fetched exactly once" test below), so a
  // preset click cannot fail independently — if the initial fetch succeeded,
  // every preset's derived figures are available immediately, with no
  // loading flash and nothing to go stale.
  it("switching range presets recomputes the needs-attention item and SLA module card figures with no new fetch", async () => {
    const user = userEvent.setup();
    mockListDepartments.mockResolvedValue([buildDepartment({ code: "waste", label: "Waste Management" })]);
    mockListIncidents.mockResolvedValue([
      buildIncidentRow({ id: "inc-1", assigned_department_code: "waste", sla_met: false }),
    ]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);
    expect(await screen.findByRole("link", { name: /Waste Management SLA at 0%/ })).toBeInTheDocument();
    const callsBeforeClick = mockListIncidents.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Today" }));

    // Still derivable immediately after the click — no "Loading…"/"Unable to
    // load data" flash, and no additional fetch was needed to produce it.
    expect(await screen.findByRole("link", { name: /Waste Management SLA at 0%/ })).toBeInTheDocument();
    expect(mockListIncidents.mock.calls.length).toBe(callsBeforeClick);
  });

  // Admin Portal Fix Plan, Task 4.2, Step 4: the load-bearing regression test
  // proving the duplicate-fetch bug is actually fixed, not just reorganized.
  // Before this fix, listIncidents alone was fetched THREE times per
  // Dashboard load (once directly, once inside getSlaByDepartment, once
  // inside getSlaTrend's computeTrendBuckets), and listApplications TWICE —
  // and every one of those was re-fetched again on every preset click. This
  // test would have failed against the old code on both counts: the initial
  // call count would already exceed 1, and clicking a second preset would
  // have pushed it higher still.
  it("fetches listApplications/listIncidents/listBookings exactly once per page load, even across preset changes", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([buildIncidentRow()]);
    mockListApplications.mockResolvedValue([buildYellowCardRow()]);
    mockListBookings.mockResolvedValue([buildBookingRow()]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);
    await screen.findByText("Service requests filed");

    expect(mockListApplications).toHaveBeenCalledTimes(1);
    expect(mockListIncidents).toHaveBeenCalledTimes(1);
    expect(mockListBookings).toHaveBeenCalledTimes(1);

    // Clicking through every preset must not trigger any additional fetch —
    // getSlaByDepartment/getSlaTrend/executiveRangeStats/etc. all recompute
    // from the SAME already-fetched rows via useMemo.
    for (const label of ["Today", "Week", "Quarter", "Annual", "Month"]) {
      await user.click(screen.getByRole("button", { name: label }));
    }

    expect(mockListApplications).toHaveBeenCalledTimes(1);
    expect(mockListIncidents).toHaveBeenCalledTimes(1);
    expect(mockListBookings).toHaveBeenCalledTimes(1);
  });

  // Admin Portal Fix Plan, Task 4.3: a failed fetch used to be a dead end —
  // a static error banner with no way to try again short of a full page
  // reload. Retry must re-run the exact single fetch-once-per-mount effect
  // Task 4.2 built (not a second, duplicate one), which this test pins by
  // counting calls the same way the "exactly once per page load" regression
  // test above does.
  describe("Task 4.3: retry affordance and last-updated stamp", () => {
    it("clicking Retry re-invokes the single fetch effect exactly once and recovers from a prior failure", async () => {
      const user = userEvent.setup();
      mockListApplications.mockRejectedValueOnce({ kind: "unknown", message: "boom" });
      // Second render pass (after Retry) succeeds.
      mockListApplications.mockResolvedValueOnce([]);

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      expect(await screen.findByText("Unable to load dashboard data: boom")).toBeInTheDocument();
      expect(mockListApplications).toHaveBeenCalledTimes(1);

      await user.click(screen.getAllByRole("button", { name: "Retry" })[0]);

      await screen.findByText("Needs attention · 0");
      expect(screen.queryByText("Unable to load dashboard data: boom")).not.toBeInTheDocument();
      // Exactly one additional fetch per data source — not zero (Retry did
      // nothing) and not more than one (Retry somehow fired the effect
      // twice), preserving Task 4.2's single-fetch-per-load guarantee.
      expect(mockListApplications).toHaveBeenCalledTimes(2);
      expect(mockListIncidents).toHaveBeenCalledTimes(2);
      expect(mockListBookings).toHaveBeenCalledTimes(2);
    });

    it("shows the Updated stamp only once data has actually loaded, never during loading or after an error", async () => {
      let resolveApplications: (rows: YellowCardRow[]) => void = () => {};
      mockListApplications.mockReturnValue(
        new Promise<YellowCardRow[]>((resolve) => {
          resolveApplications = resolve;
        })
      );

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();

      resolveApplications([]);
      await screen.findByText("Needs attention · 0");

      expect(await screen.findByText(/^Updated .*\(Asia\/Manila\)$/)).toBeInTheDocument();
    });

    // Regression guard for a review finding on this task: Skeleton is
    // aria-hidden (a purely visual placeholder), so replacing the old plain
    // "Loading…" DOM text with Skeleton blocks left screen reader users with
    // zero signal that the page was loading. A role="status" live region
    // must announce it instead, and must disappear once real content has
    // loaded (a stale "loading" announcement would be its own kind of lie).
    it("announces loading to assistive tech via a role=status live region, which clears once loaded", async () => {
      let resolveApplications: (rows: YellowCardRow[]) => void = () => {};
      mockListApplications.mockReturnValue(
        new Promise<YellowCardRow[]>((resolve) => {
          resolveApplications = resolve;
        })
      );

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard data…");

      resolveApplications([]);
      // "Needs attention · 0" is not a safe wait condition here — the count
      // in that heading reads 0 during loading too (needsAttention returns
      // [] whenever status !== "ready"), so it would match before the fetch
      // actually resolves. The Updated stamp only ever appears after a
      // successful load, so waiting on it is the unambiguous signal that
      // `status` has actually flipped to "ready".
      await screen.findByText(/^Updated .*\(Asia\/Manila\)$/);

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("does not show the Updated stamp when the fetch fails", async () => {
      mockListApplications.mockRejectedValue({ kind: "unknown", message: "boom" });

      render(<DashboardPage displayName="Juan Dela Cruz" />);

      expect(await screen.findByText("Unable to load dashboard data: boom")).toBeInTheDocument();
      expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();
    });
  });

  // Task 3.4: the sparkline used to expose its data only through a
  // mouse-only `title=` tooltip on each bar, plus a generic, data-free
  // aria-label ("SLA compliance trend") on the container. It now carries
  // the actual month/value pairs in the aria-label via role="img".
  //
  // Two months, 40 days apart so they always land in different calendar
  // months regardless of which real date this suite runs on (same device as
  // the null-compliance test above) — "Annual" is clicked so both fall
  // inside the active range. Each month's incident mix (4/5, then 9/10) is
  // chosen only so its compliancePct comes out to a round whole-number
  // percentage without a real backend, not for any significance to the
  // number itself.
  it("the SLA trend sparkline's aria-label carries the actual month/compliance data, not a generic label", async () => {
    const user = userEvent.setup();
    const monthA = daysAgoIso(40);
    const monthB = daysAgoIso(1);
    mockListIncidents.mockResolvedValue([
      buildIncidentRow({ id: "a1", submitted_at: monthA, resolved_at: monthA, sla_met: true }),
      buildIncidentRow({ id: "a2", submitted_at: monthA, resolved_at: monthA, sla_met: true }),
      buildIncidentRow({ id: "a3", submitted_at: monthA, resolved_at: monthA, sla_met: true }),
      buildIncidentRow({ id: "a4", submitted_at: monthA, resolved_at: monthA, sla_met: true }),
      buildIncidentRow({ id: "a5", submitted_at: monthA, resolved_at: monthA, sla_met: false }),
      buildIncidentRow({ id: "b1", submitted_at: monthB, resolved_at: monthB, sla_met: true }),
      buildIncidentRow({ id: "b2", submitted_at: monthB, resolved_at: monthB, sla_met: true }),
      buildIncidentRow({ id: "b3", submitted_at: monthB, resolved_at: monthB, sla_met: true }),
      buildIncidentRow({ id: "b4", submitted_at: monthB, resolved_at: monthB, sla_met: true }),
      buildIncidentRow({ id: "b5", submitted_at: monthB, resolved_at: monthB, sla_met: true }),
      buildIncidentRow({ id: "b6", submitted_at: monthB, resolved_at: monthB, sla_met: true }),
      buildIncidentRow({ id: "b7", submitted_at: monthB, resolved_at: monthB, sla_met: true }),
      buildIncidentRow({ id: "b8", submitted_at: monthB, resolved_at: monthB, sla_met: true }),
      buildIncidentRow({ id: "b9", submitted_at: monthB, resolved_at: monthB, sla_met: true }),
      buildIncidentRow({ id: "b10", submitted_at: monthB, resolved_at: monthB, sla_met: false }),
    ]);

    render(<DashboardPage displayName="Juan Dela Cruz" />);
    await screen.findByText("Service requests filed");
    await user.click(screen.getByRole("button", { name: "Annual" }));

    const card = await screen.findByRole("link", { name: /^SLA Reports/ });
    const labelA = manilaMonthLabel(monthA);
    const labelB = manilaMonthLabel(monthB);
    expect(
      await within(card).findByRole("img", {
        name: `Incidents resolved on time, by month: ${labelA} 80%, ${labelB} 90%`,
      })
    ).toBeInTheDocument();
  });

  // Task 3.5: page.tsx is now a server-component wrapper whose only job is
  // to export a per-route metadata.title; app/layout.tsx's title template
  // ("%s · Lucena City Admin Portal") interpolates this into the actual
  // <title>. Asserted directly on the exported object, since RTL's render()
  // never mounts a document <head> and so can't observe next/navigation's
  // resolved <title> the way a real Next.js request would.
  it("exports a per-route title", () => {
    expect(metadata.title).toBe("Dashboard");
  });
});
