// src/portals/admin/features/sla/components/sla-reports-page.test.tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SLAReportsPage, { metadata } from "@/app/(admin)/admin/(shell)/sla-reports/page";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import type { DepartmentRow } from "@/portals/admin/lib/supabase/catalogs";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that app/(admin)/sla-reports/
// page.tsx imports.
//
// src/portals/admin/features/sla/lib/sla.ts is deliberately NOT mocked here (Admin Portal Fix Plan,
// Task 4.2): getSlaByDepartment/getSlaTrend/getSlaRangeStats/
// getSlaMonthlyHistory no longer call listIncidents()/listApplications()/
// listDepartments() themselves — they are now pure, synchronous functions
// over rows the page fetches once via the mocks below, so the REAL
// implementation runs against those fetched rows.
const mockListIncidents = vi.fn();
const mockListApplications = vi.fn();
const mockListDepartments = vi.fn();
const mockDownloadCsv = vi.fn();

vi.mock("../../../lib/csv", () => ({
  downloadCsv: (filename: string, header: string[], rows: unknown[][]) =>
    mockDownloadCsv(filename, header, rows),
}));

vi.mock("../../incidents/lib/incidents", () => ({
  listIncidents: (signal?: unknown) => mockListIncidents(signal),
}));

vi.mock("../../yellow-card/lib/yellow-card", () => ({
  listApplications: (signal?: unknown) => mockListApplications(signal),
}));

vi.mock("../../../lib/supabase/catalogs", () => ({
  listDepartments: () => mockListDepartments(),
}));

// The page's default preset is "Month", and every SLA figure derives from
// real fetched rows filtered by filterByDateRange against real wall-clock
// "now" — the same convention every other converted page's test suite uses
// (see e.g. src/portals/admin/features/dashboard/components/dashboard-page.test.tsx's defaultSubmittedAt).
function defaultSubmittedAt(): string {
  return new Date().toISOString();
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

// getSlaTrend/getSlaMonthlyHistory bucket by real calendar month (Manila
// timezone), so a test needing a specific month's label computes it from the
// same ISO timestamp it fed into the fixture rather than pinning a literal
// "Jun 2026"/"Jul 2026" string that would only coincidentally match whatever
// date this suite actually runs on.
function manilaMonthLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", year: "numeric" }).format(
    new Date(iso)
  );
}

function buildIncident(overrides: Partial<IncidentRow> = {}): IncidentRow {
  return {
    id: "inc-1",
    reference_number: "IR-2026-000001",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    incident_type_code: "pothole",
    incident_type_label: "Pothole",
    category_code: "infrastructure",
    incident_level: "medium",
    // null by default (not "engineering") — most fixtures in this file only
    // care about the hero tiles/trend chart, not the department table, and a
    // department code here would otherwise create an unwanted department
    // row. Tests that DO exercise the department table set this explicitly.
    assigned_department_code: null,
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

function buildApplication(overrides: Partial<YellowCardRow> = {}): YellowCardRow {
  return {
    id: "app-1",
    reference_number: "YC-2026-000001",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    status: "approved",
    submitted_at: defaultSubmittedAt(),
    decided_at: defaultSubmittedAt(),
    review_cycles: 1,
    due_at: null,
    deadline_state: null,
    sla_breached: false,
    sla_elapsed_seconds: 3600,
    sla_target_hours: 24,
    ...overrides,
  };
}

function buildDepartment(overrides: Partial<DepartmentRow> = {}): DepartmentRow {
  return { code: "engineering", label: "Engineering", sort_order: 1, ...overrides };
}

// The hero KPI tiles, the "By department" table, the compliance trend chart
// and the "Monthly compliance history" table all derive from the SAME
// fetched incidents now (Admin Portal Fix Plan, Task 4.2) — with a small
// fixture, the same number or month label frequently appears in more than
// one of them (e.g. a single-bucket trend's compliance % matches the hero
// Compliance tile's value exactly). These two helpers scope a query to one
// KPI tile or one section, rather than asserting page-wide text that a
// pre-Task-4.2 fixture (driven by four independently-mocked functions with
// deliberately distinct canned numbers) never had to disambiguate.
function tileFor(label: string): HTMLElement {
  // "Compliance"/"Responses" etc. can also appear as a DataTable column
  // header (a <th>) once the department/monthly tables have rows — the
  // KpiTile label is always a <p>, so prefer that over any other element
  // sharing the same text.
  const candidates = screen.getAllByText(label);
  const labelEl = candidates.find((el) => el.tagName === "P") ?? candidates[0];
  return labelEl.closest("div") as HTMLElement;
}

function sectionFor(heading: string): HTMLElement {
  return screen.getByText(heading).closest("section") as HTMLElement;
}

// One service's line on a per-service tile (#122): "Yellow Card" or
// "Incidents" inside the tile labelled `label`.
function partFor(label: string, service: "Yellow Card" | "Incidents"): HTMLElement {
  return within(tileFor(label)).getByText(service).closest("div") as HTMLElement;
}

const TREND_TITLE = "Incidents resolved on time, by month";

describe("SLAReportsPage", () => {
  beforeEach(() => {
    mockListIncidents.mockReset();
    mockListApplications.mockReset();
    mockListDepartments.mockReset();
    mockDownloadCsv.mockReset();
    mockListIncidents.mockResolvedValue([]);
    mockListApplications.mockResolvedValue([]);
    mockListDepartments.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The Custom date inputs used to be seeded with literals written the day
  // this page was authored ("2026-07-01"/"2026-07-31"), so clicking into them
  // months later offered a window with nothing to do with the present.
  it("seeds the Custom date inputs from the current Manila month, not authoring-time literals", () => {
    render(<SLAReportsPage />);

    const manilaToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    expect(screen.getByLabelText("Custom range end")).toHaveValue(manilaToday);
    expect(screen.getByLabelText("Custom range start")).toHaveValue(`${manilaToday.slice(0, 7)}-01`);
  });

  it("renders each service's compliance with its gap and the project target", async () => {
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "inc-1", sla_met: true }),
      buildIncident({ id: "inc-2", sla_met: true }),
      buildIncident({ id: "inc-3", sla_met: true }),
      buildIncident({ id: "inc-4", sla_met: false }),
    ]);

    render(<SLAReportsPage />);
    expect(screen.getByText("Monthly SLA Compliance Report")).toBeInTheDocument();
    // 3 met / 4 = 75%.
    expect(await within(partFor("Compliance", "Incidents")).findByText("75%")).toBeInTheDocument();
    expect(within(partFor("Compliance", "Incidents")).getByText("10 pts below 85% project target")).toBeInTheDocument();
    // No application in range: nothing scored, never a fabricated 0%.
    expect(within(partFor("Compliance", "Yellow Card")).getByText("—")).toBeInTheDocument();
    expect(within(partFor("Compliance", "Yellow Card")).getByText("Nothing scored in range")).toBeInTheDocument();
    expect(within(tileFor("Compliance")).getByText("Project target: 85%")).toBeInTheDocument();
    // No previous-period rows at all — percentDelta reads "New activity",
    // not a fabricated percentage swing.
    expect(
      within(partFor("Requests scored", "Incidents")).getByText("New activity vs previous period")
    ).toBeInTheDocument();
    await screen.findByText("No department SLA data for this range.");
  });

  // #119: SLA Reports runs on the Dashboard's scoring rules, so a withdrawn
  // application leaves its numbers too. Scored, it would read 2 scored,
  // 1 finished late and 50%.
  it("does not score a withdrawn application", async () => {
    mockListApplications.mockResolvedValue([
      buildApplication({ id: "app-1", status: "approved", sla_breached: false }),
      buildApplication({ id: "app-2", status: "withdrawn", sla_elapsed_seconds: 45 * 3600, sla_breached: true }),
    ]);

    render(<SLAReportsPage />);

    expect(await within(partFor("Compliance", "Yellow Card")).findByText("100%")).toBeInTheDocument();
    expect(within(partFor("Requests scored", "Yellow Card")).getByText("1")).toBeInTheDocument();
    expect(within(partFor("Finished late", "Yellow Card")).getByText("0")).toBeInTheDocument();
  });

  // #122: the two services are judged against different clocks (ADR 0001),
  // so no tile adds them up. Pooled, this fixture would read 3 scored,
  // 1 finished late and 66.7%.
  it("shows every tile once per service, with no pooled figure", async () => {
    mockListApplications.mockResolvedValue([buildApplication({ id: "app-1", sla_breached: false })]);
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "inc-1", sla_met: true }),
      buildIncident({ id: "inc-2", sla_met: false }),
    ]);

    render(<SLAReportsPage />);

    expect(await within(partFor("Requests scored", "Yellow Card")).findByText("1")).toBeInTheDocument();
    expect(within(partFor("Requests scored", "Incidents")).getByText("2")).toBeInTheDocument();
    expect(within(partFor("Finished late", "Yellow Card")).getByText("0")).toBeInTheDocument();
    expect(within(partFor("Finished late", "Incidents")).getByText("1")).toBeInTheDocument();
    expect(within(partFor("Compliance", "Yellow Card")).getByText("100%")).toBeInTheDocument();
    expect(within(partFor("Compliance", "Incidents")).getByText("50%")).toBeInTheDocument();
    expect(screen.queryByText("66.7%")).not.toBeInTheDocument();
    expect(within(tileFor("Requests scored")).queryByText("3")).not.toBeInTheDocument();
    expect(screen.queryByText("Responses")).not.toBeInTheDocument();
    expect(screen.queryByText("SLA Violations")).not.toBeInTheDocument();
  });

  it("states that Booking has no turnaround clock", async () => {
    render(<SLAReportsPage />);

    expect(
      await screen.findByText("Booking has no turnaround clock yet (voluntary standard, ADR 0001)")
    ).toBeInTheDocument();
  });

  // #126: the waiting work that has already run out of time, per service,
  // counted the way Pending Review's and Open Backlog's notes count it
  // (#124). Every fixture was filed 200 days ago, outside the default Month
  // and the Today preset, because past due describes right now.
  describe("Past due now", () => {
    const longAgo = daysAgoIso(200);
    const dueYesterday = daysAgoIso(1);
    const dueTomorrow = daysAgoIso(-1);

    function waitingApplications(): YellowCardRow[] {
      return [
        buildApplication({ id: "pending-overdue", status: "pending", submitted_at: longAgo, decided_at: null, deadline_state: "overdue" }),
        buildApplication({ id: "resubmitted-overdue", status: "resubmitted", submitted_at: longAgo, decided_at: null, deadline_state: "overdue" }),
        buildApplication({ id: "pending-at-risk", status: "pending", submitted_at: longAgo, decided_at: null, deadline_state: "at_risk" }),
        // Its next move is the resident's: not waiting on the city.
        buildApplication({ id: "revision-overdue", status: "revision_requested", submitted_at: longAgo, decided_at: null, deadline_state: "overdue" }),
      ];
    }

    function waitingIncidents(): IncidentRow[] {
      return [
        // Rejected by a responder, so back in Awaiting Triage with its clock
        // still running (DB l56b): past due once its due time passes (#129).
        buildIncident({ id: "open-late", status: "open", submitted_at: longAgo, resolved_at: null, sla_due_at: dueYesterday }),
        buildIncident({ id: "in-progress-late", status: "in_progress", submitted_at: longAgo, resolved_at: null, sla_due_at: dueYesterday }),
        buildIncident({ id: "in-pool-late", status: "in_pool", submitted_at: longAgo, resolved_at: null, sla_due_at: dueYesterday }),
        buildIncident({ id: "open-in-time", status: "open", submitted_at: longAgo, resolved_at: null, sla_due_at: dueTomorrow, sla_at_risk: true }),
        // Never routed and verified: no clock, never past due.
        buildIncident({ id: "open-no-clock", status: "open", submitted_at: longAgo, resolved_at: null, sla_due_at: null }),
        // Finished: scored, not waiting.
        buildIncident({ id: "resolved-late", status: "resolved", submitted_at: longAgo, resolved_at: longAgo, sla_due_at: dueYesterday, sla_met: false }),
      ];
    }

    it("counts each service's waiting requests past their due time, and replaces Avg Response", async () => {
      mockListApplications.mockResolvedValue(waitingApplications());
      mockListIncidents.mockResolvedValue(waitingIncidents());

      render(<SLAReportsPage />);

      expect(await within(partFor("Past due now", "Yellow Card")).findByText("2")).toBeInTheDocument();
      expect(within(partFor("Past due now", "Incidents")).getByText("3")).toBeInTheDocument();
      expect(within(tileFor("Past due now")).getByText("Right now, whatever the date range")).toBeInTheDocument();
      expect(screen.queryByText("Avg Response")).not.toBeInTheDocument();
    });

    it("changing the range doesn't change them", async () => {
      const user = userEvent.setup();
      mockListApplications.mockResolvedValue(waitingApplications());
      mockListIncidents.mockResolvedValue(waitingIncidents());

      render(<SLAReportsPage />);
      expect(await within(partFor("Past due now", "Incidents")).findByText("3")).toBeInTheDocument();

      for (const preset of ["Today", "Annual"]) {
        await user.click(screen.getByRole("button", { name: preset }));
        expect(within(partFor("Past due now", "Yellow Card")).getByText("2")).toBeInTheDocument();
        expect(within(partFor("Past due now", "Incidents")).getByText("3")).toBeInTheDocument();
      }
      await user.selectOptions(screen.getByLabelText("Date type"), "resolution");
      expect(within(partFor("Past due now", "Yellow Card")).getByText("2")).toBeInTheDocument();
      expect(within(partFor("Past due now", "Incidents")).getByText("3")).toBeInTheDocument();
    });

    it("reads 0, not a blank, when nothing waiting is past due", async () => {
      mockListApplications.mockResolvedValue([
        buildApplication({ id: "pending-on-track", status: "pending", decided_at: null, deadline_state: "on_track" }),
      ]);
      mockListIncidents.mockResolvedValue([
        buildIncident({ id: "open-no-clock", status: "open", resolved_at: null, sla_due_at: null }),
      ]);

      render(<SLAReportsPage />);

      expect(await within(partFor("Past due now", "Yellow Card")).findByText("0")).toBeInTheDocument();
      expect(within(partFor("Past due now", "Incidents")).getByText("0")).toBeInTheDocument();
    });
  });

  // #127: a Mayor who reads "1 finished late" can see which one. Each
  // service's part links to its page, narrowed to the requests counted.
  describe("links to the requests behind Finished late and Past due now", () => {
    it("links each service's count to its page, with the range and date type for Finished late and none for Past due now", async () => {
      const user = userEvent.setup();
      mockListApplications.mockResolvedValue([
        buildApplication({ id: "app-late", status: "approved", sla_breached: true }),
        buildApplication({ id: "app-overdue", status: "pending", decided_at: null, deadline_state: "overdue" }),
      ]);
      mockListIncidents.mockResolvedValue([
        buildIncident({ id: "inc-late", sla_met: false }),
        buildIncident({ id: "inc-late-2", sla_met: false }),
        buildIncident({ id: "inc-overdue", status: "open", resolved_at: null, sla_due_at: daysAgoIso(1) }),
      ]);

      render(<SLAReportsPage />);
      await within(partFor("Finished late", "Incidents")).findByText("2");
      await user.click(screen.getByRole("button", { name: "Annual" }));

      expect(
        within(partFor("Finished late", "Yellow Card")).getByRole("link", { name: "See the 1 application" })
      ).toHaveAttribute("href", "/admin/yellow-card?sla=late&range=Annual&basis=application");
      expect(
        within(partFor("Finished late", "Incidents")).getByRole("link", { name: "See the 2 reports" })
      ).toHaveAttribute("href", "/admin/issue-reports?sla=late&range=Annual&basis=report");
      expect(
        within(partFor("Past due now", "Yellow Card")).getByRole("link", { name: "See the 1 application" })
      ).toHaveAttribute("href", "/admin/yellow-card?sla=past-due");
      expect(
        within(partFor("Past due now", "Incidents")).getByRole("link", { name: "See the 1 report" })
      ).toHaveAttribute("href", "/admin/issue-reports?sla=past-due");
    });

    it("a custom range on the resolution date carries its dates and the pages' own date type", async () => {
      const user = userEvent.setup();
      mockListApplications.mockResolvedValue([
        buildApplication({ id: "app-late", status: "rejected", submitted_at: "2026-06-02T02:00:00Z", decided_at: "2026-06-08T02:00:00Z", sla_breached: true }),
      ]);
      mockListIncidents.mockResolvedValue([
        buildIncident({ id: "inc-late", submitted_at: "2026-06-02T02:00:00Z", resolved_at: "2026-06-05T02:00:00Z", sla_due_at: "2026-06-03T02:00:00Z", sla_met: false }),
      ]);

      render(<SLAReportsPage />);
      await screen.findByText("No department SLA data for this range.");
      const start = screen.getByLabelText("Custom range start");
      const end = screen.getByLabelText("Custom range end");
      await user.clear(start);
      await user.type(start, "2026-06-01");
      await user.clear(end);
      await user.type(end, "2026-06-10");
      await user.selectOptions(screen.getByLabelText("Date type"), "resolution");

      expect(
        await within(partFor("Finished late", "Yellow Card")).findByRole("link", { name: "See the 1 application" })
      ).toHaveAttribute("href", "/admin/yellow-card?sla=late&from=2026-06-01&to=2026-06-10&basis=completion");
      expect(
        within(partFor("Finished late", "Incidents")).getByRole("link", { name: "See the 1 report" })
      ).toHaveAttribute("href", "/admin/issue-reports?sla=late&from=2026-06-01&to=2026-06-10&basis=resolution");
    });

    it("a count of 0 has no link, and neither does a failed load", async () => {
      mockListApplications.mockResolvedValue([buildApplication({ id: "app-on-time", sla_breached: false })]);

      const { unmount } = render(<SLAReportsPage />);
      await within(partFor("Requests scored", "Yellow Card")).findByText("1");
      expect(within(tileFor("Finished late")).queryByRole("link")).not.toBeInTheDocument();
      expect(within(tileFor("Past due now")).queryByRole("link")).not.toBeInTheDocument();
      unmount();

      mockListApplications.mockRejectedValue({ kind: "unknown", message: "boom" });
      render(<SLAReportsPage />);
      await screen.findAllByText("Unable to load SLA data: boom");
      expect(within(tileFor("Finished late")).queryByRole("link")).not.toBeInTheDocument();
      expect(within(tileFor("Past due now")).queryByRole("link")).not.toBeInTheDocument();
    });
  });

  it("renders the date filter bar with presets and SLA date basis options", async () => {
    render(<SLAReportsPage />);
    for (const preset of ["Today", "Week", "Month", "Quarter", "Annual"]) {
      expect(screen.getByRole("button", { name: preset })).toBeInTheDocument();
    }
    const basis = screen.getByLabelText("Date type");
    expect(within(basis).getByText("Request Date")).toBeInTheDocument();
    expect(within(basis).getByText("Resolution Date")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /compare to previous period/i })
    ).toBeInTheDocument();
    await screen.findByText("No department SLA data for this range.");
  });

  it("shows the KPI tiles from getSlaRangeStats' derived figures", async () => {
    // The clock is pinned mid-month: hoursAgo(72) against the real "now"
    // falls in the previous month on the 1st-3rd, outside the default "Month"
    // range (Manila 1st to today), and the incidents dropped out (#76). Only
    // Date is faked, so userEvent/waitFor keep their real timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T12:00:00+08:00"));
    const submittedAt = new Date(Date.now() - 72 * 3_600_000).toISOString();
    const resolvedAt = new Date(Date.now() - 24 * 3_600_000).toISOString();
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "inc-1", submitted_at: submittedAt, resolved_at: resolvedAt, sla_met: true }),
      buildIncident({ id: "inc-2", submitted_at: submittedAt, resolved_at: resolvedAt, sla_met: true }),
      buildIncident({ id: "inc-3", submitted_at: submittedAt, resolved_at: resolvedAt, sla_met: true }),
      buildIncident({ id: "inc-4", submitted_at: submittedAt, resolved_at: resolvedAt, sla_met: false }),
      buildIncident({ id: "inc-5", submitted_at: submittedAt, resolved_at: resolvedAt, sla_met: false }),
    ]);

    render(<SLAReportsPage />);

    expect(await within(partFor("Requests scored", "Incidents")).findByText("5")).toBeInTheDocument();
    expect(within(partFor("Finished late", "Incidents")).getByText("2")).toBeInTheDocument();
    expect(within(tileFor("Compliance")).getByText("Project target: 85%")).toBeInTheDocument();
    await screen.findByText("No department SLA data for this range.");
  });

  // #122: the old caption read "57 of 122 scoreable", but 122 was every
  // request filed, not the scoreable ones. Each service now says what its
  // scored count was out of: the requests of that service in range.
  it("Requests scored says what each service's count was out of", async () => {
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "inc-1", sla_met: true }),
      buildIncident({ id: "inc-2", status: "open", resolved_at: null }),
      buildIncident({ id: "inc-3", status: "open", resolved_at: null }),
    ]);
    mockListApplications.mockResolvedValue([
      buildApplication({ id: "app-1", status: "approved" }),
      buildApplication({ id: "app-2", status: "pending" }),
    ]);

    render(<SLAReportsPage />);

    expect(await within(partFor("Requests scored", "Incidents")).findByText("1")).toBeInTheDocument();
    expect(within(partFor("Requests scored", "Incidents")).getByText("of 3 filed in range")).toBeInTheDocument();
    expect(within(partFor("Requests scored", "Yellow Card")).getByText("of 2 filed in range")).toBeInTheDocument();
    expect(screen.queryByText(/scoreable \(pending\/unverified excluded\)/)).not.toBeInTheDocument();
  });

  // Same reconciliation, per row, on the "By department" table's Scored
  // column — the other place the review found this same unexplained-gap
  // problem.
  it("the department table's Scored column shows the scoreable-vs-total gap per row", async () => {
    mockListDepartments.mockResolvedValue([
      buildDepartment({ code: "waste", label: "Waste Management" }),
      buildDepartment({ code: "engineering", label: "Engineering" }),
    ]);
    const wasteScoreable = Array.from({ length: 12 }, (_, i) =>
      buildIncident({ id: `waste-s-${i}`, assigned_department_code: "waste", sla_met: true })
    );
    const wasteNonScoreable = Array.from({ length: 6 }, (_, i) =>
      buildIncident({ id: `waste-n-${i}`, assigned_department_code: "waste", status: "open", resolved_at: null })
    );
    const engineeringScoreable = Array.from({ length: 40 }, (_, i) =>
      buildIncident({ id: `eng-s-${i}`, assigned_department_code: "engineering", sla_met: true })
    );
    mockListIncidents.mockResolvedValue([...wasteScoreable, ...wasteNonScoreable, ...engineeringScoreable]);

    render(<SLAReportsPage />);

    expect(await screen.findByText("Waste Management")).toBeInTheDocument();
    expect(screen.getByText("of 18 total")).toBeInTheDocument();
    // Engineering's totalInRange equals its requests, so no "of N total" sub-line for it.
    expect(screen.queryByText("of 40 total")).not.toBeInTheDocument();
  });

  // The 3 months are 90/50/5 days apart specifically so each pair always
  // lands in a different calendar month (the smallest gap, 45 days, exceeds
  // every month's length) regardless of which real date this suite runs on
  // — this can only fail if it runs within the first ~90 days of a calendar
  // year, since "Annual" (clicked below) only covers Jan 1 to today.
  it("renders the compliance trend chart from getSlaTrend's derived points", async () => {
    const user = userEvent.setup();
    const monthA = daysAgoIso(90);
    const monthB = daysAgoIso(50);
    const monthC = daysAgoIso(5);
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "a1", submitted_at: monthA, sla_met: false }),
      buildIncident({ id: "a2", submitted_at: monthA, sla_met: false }),
      buildIncident({ id: "a3", submitted_at: monthA, sla_met: false }),
      buildIncident({ id: "b1", submitted_at: monthB, sla_met: false }),
      buildIncident({ id: "b2", submitted_at: monthB, sla_met: false }),
      buildIncident({ id: "c1", submitted_at: monthC, sla_met: false }),
    ]);

    render(<SLAReportsPage />);
    await screen.findByText("No department SLA data for this range.");
    await user.click(screen.getByRole("button", { name: "Annual" }));

    expect(await screen.findByText(TREND_TITLE)).toBeInTheDocument();
    const trendSection = sectionFor(TREND_TITLE);
    const labelA = manilaMonthLabel(monthA);
    const labelB = manilaMonthLabel(monthB);
    const labelC = manilaMonthLabel(monthC);
    // Each month label also appears a second time, as a row header in the
    // sr-only accessible-data-alternative table below the chart (Admin
    // Portal Fix Plan, Phase 3 accessibility task — see the adjacent
    // "exposes the compliance trend's full data..." test) — scope to the
    // visible SVG so this pins the chart's own x-axis labels specifically.
    const svg = trendSection.querySelector("svg")! as unknown as HTMLElement;
    expect(within(svg).getByText(labelA)).toBeInTheDocument();
    expect(within(svg).getByText(labelB)).toBeInTheDocument();
    expect(within(svg).getByText(labelC)).toBeInTheDocument();
    // Finished late 3 + 2 + 1 = 6; worst month is monthA with 3.
    expect(within(trendSection).getByText("6")).toBeInTheDocument();
    expect(within(trendSection).getByText(`${labelA} (3)`)).toBeInTheDocument();
  });

  // #40, then #122: the trend buckets incidents only (computeTrendBuckets),
  // so its title says so, and so do its total and accessible names, rather
  // than a footnote beside a general "Compliance trend".
  it("titles the trend as incidents resolved on time, by month, in its total and accessible names", async () => {
    const user = userEvent.setup();
    const monthA = daysAgoIso(90);
    const monthB = daysAgoIso(5);
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "a1", submitted_at: monthA, sla_met: false }),
      buildIncident({ id: "a2", submitted_at: monthA, sla_met: false }),
      buildIncident({ id: "b1", submitted_at: monthB, sla_met: false }),
    ]);

    render(<SLAReportsPage />);
    await screen.findByText("No department SLA data for this range.");
    await user.click(screen.getByRole("button", { name: "Annual" }));

    expect(await screen.findByRole("heading", { name: TREND_TITLE })).toBeInTheDocument();
    expect(screen.queryByText("Compliance trend")).not.toBeInTheDocument();
    const trendSection = sectionFor(TREND_TITLE);
    const total = within(trendSection).getByText("Incidents finished late:", { exact: false });
    expect(total).toHaveTextContent("Incidents finished late: 3");
    expect(within(trendSection).getByRole("img", { name: new RegExp(TREND_TITLE) })).toBeInTheDocument();
    // The 85% line is the capstone's project target, not a legal one (S8).
    expect(within(trendSection).getByText("Project target 85%")).toBeInTheDocument();
    expect(within(trendSection).getByRole("table", { name: new RegExp(TREND_TITLE) })).toBeInTheDocument();
  });

  // Admin Portal Fix Plan, Phase 3 accessibility task: the chart's SVG has
  // role="img" with a single aria-label carrying no per-point numbers, so a
  // screen reader announces it as one opaque image — ComplianceTrendCard adds
  // a visually-hidden (sr-only) table alongside it as the real data
  // alternative. Reuses the same 3-month fixture as the visible-chart test
  // above so both exercise the identical trend data from two different
  // rendering paths.
  it("exposes the compliance trend's full data to assistive tech via a visually-hidden table", async () => {
    const user = userEvent.setup();
    const monthA = daysAgoIso(90);
    const monthB = daysAgoIso(50);
    const monthC = daysAgoIso(5);
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "a1", submitted_at: monthA, sla_met: false }),
      buildIncident({ id: "a2", submitted_at: monthA, sla_met: false }),
      buildIncident({ id: "a3", submitted_at: monthA, sla_met: false }),
      buildIncident({ id: "b1", submitted_at: monthB, sla_met: false }),
      buildIncident({ id: "b2", submitted_at: monthB, sla_met: false }),
      buildIncident({ id: "c1", submitted_at: monthC, sla_met: false }),
    ]);

    render(<SLAReportsPage />);
    await screen.findByText("No department SLA data for this range.");
    await user.click(screen.getByRole("button", { name: "Annual" }));
    await screen.findByText(TREND_TITLE);

    const table = screen.getByRole("table", { name: new RegExp(`${TREND_TITLE}, data`) });
    const rows = within(table).getAllByRole("row");
    // Header row + one row per trend point (3 months).
    expect(rows.length).toBe(4);

    const labelA = manilaMonthLabel(monthA);
    // All incidents in this fixture are sla_met: false, so every month's
    // compliance is a real, scoreable 0% — not the null "no data" case the
    // adjacent test below covers.
    const rowA = within(table).getByRole("row", { name: new RegExp(labelA) });
    expect(rowA).toHaveTextContent("0%");
    expect(rowA).toHaveTextContent("3");
  });

  // Admin Portal Fix Plan, Phase 1 final review, finding 1: ComplianceTrendCard
  // is outside every individual task's diff, so a null-compliance point
  // (zero scoreable incidents that month) reaching it as a bare number used
  // to render "0% on time" in the tooltip — reading as "everyone violated
  // SLA" when the true answer is "nothing was scoreable yet." A null point
  // now renders no tooltip/dot at all rather than a fabricated one.
  it('the compliance trend chart does not render "0% on time" for a null-compliance point', async () => {
    const user = userEvent.setup();
    const nullMonth = daysAgoIso(60);
    // 1 met / 3 = 33.3% — deliberately NOT a multiple of 10: "0% on time"
    // is itself a substring of any percentage ending in a bare "0" (e.g.
    // "100%", "50%", "80%" all contain the literal substring "0% on time"
    // ), which would make the "no fabricated 0%" assertion below pass even
    // if the null-point exclusion were broken. 33.3% cannot false-positive
    // that check.
    const realMonth = daysAgoIso(2);
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "n1", submitted_at: nullMonth, status: "open", resolved_at: null }),
      buildIncident({ id: "r1", submitted_at: realMonth, resolved_at: realMonth, sla_met: true }),
      buildIncident({ id: "r2", submitted_at: realMonth, resolved_at: realMonth, sla_met: false }),
      buildIncident({ id: "r3", submitted_at: realMonth, resolved_at: realMonth, sla_met: false }),
    ]);

    const { container } = render(<SLAReportsPage />);
    await screen.findByText("No department SLA data for this range.");
    await user.click(screen.getByRole("button", { name: "Annual" }));

    expect(await screen.findByText(TREND_TITLE)).toBeInTheDocument();
    const nullLabel = manilaMonthLabel(nullMonth);
    const realLabel = manilaMonthLabel(realMonth);
    const titleTexts = Array.from(container.querySelectorAll("svg title")).map((node) => node.textContent);
    expect(titleTexts.some((text) => text?.includes(nullLabel))).toBe(false);
    expect(titleTexts.some((text) => text?.includes("0% on time"))).toBe(false);
    expect(titleTexts.some((text) => text?.includes(`${realLabel}: 33.3% on time`))).toBe(true);
    // The data table read "null%" for such a month.
    const table = screen.getByRole("table", { name: new RegExp(`${TREND_TITLE}, data`) });
    expect(within(table).getByRole("row", { name: new RegExp(nullLabel) })).toHaveTextContent("—");
  });

  it("the compliance trend shows an empty state, not an error, when there are no incidents in range", async () => {
    render(<SLAReportsPage />);

    expect(await screen.findByText("No SLA data for this range.")).toBeInTheDocument();
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unable to load/i)).not.toBeInTheDocument();
  });

  it("shows a permission message, not a crash, when the fetch rejects with kind: permission", async () => {
    mockListIncidents.mockRejectedValue({
      kind: "permission",
      message: "caller is not an active Admin",
    });

    render(<SLAReportsPage />);

    const messages = await screen.findAllByText(
      "You do not have permission to view SLA reports."
    );
    expect(messages.length).toBeGreaterThan(0);
    expect(screen.queryByText("No SLA data for this range.")).not.toBeInTheDocument();
    expect(screen.queryByText("No department SLA data for this range.")).not.toBeInTheDocument();
  });

  // Admin Portal Fix Plan, Task 1.5: before this fix the four hero KPI tiles
  // read `stats?.x ?? 0` — `stats` stays null on a fetch failure (it is only
  // ever set inside the success branch), so a failed fetch painted the exact
  // same "0%"/"0" headline a genuinely quiet period would show. Every tile
  // must now render "—" and no digit at all on error.
  it("on fetch error, none of the four hero KPI tiles show a number — not 0, not a stale value", async () => {
    mockListIncidents.mockRejectedValue({ kind: "unknown", message: "network down" });

    render(<SLAReportsPage />);

    await screen.findAllByText(/Unable to load SLA data/);

    // The value lines specifically — not the whole tile, since the
    // Compliance tile's static "Project target: 85%" note legitimately keeps
    // showing a digit regardless of fetch status (it names the fixed
    // project target, not a value derived from this fetch).
    for (const label of ["Requests scored", "Finished late", "Compliance", "Past due now"]) {
      for (const service of ["Yellow Card", "Incidents"] as const) {
        const value = partFor(label, service).querySelector(".text-xl");
        expect(value).toHaveTextContent("—");
        expect(value?.textContent).not.toMatch(/\d/);
      }
    }
  });

  // Admin Portal Fix Plan, Task 4.2: incidents/applications/departments are
  // now fetched exactly ONCE per page load (see the "fetched exactly once"
  // test below); switching a preset/date-basis is a pure client-side
  // recomputation via useMemo, not a new fetch that could independently
  // fail. This replaces the pre-Task-4.2 test that pinned the OLD "a range
  // switch's fetch can fail and leave stale numbers on screen" bug (Phase 1
  // final review, finding 5) — that failure mode no longer exists, because
  // there is no second fetch to fail. This pins the new, stronger guarantee:
  // switching presets recomputes the SAME fetched rows correctly, with zero
  // additional network requests.
  it("switching range presets recomputes the KPI tiles from the same fetched rows, with no new fetch", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "inc-1", sla_met: true }),
      buildIncident({ id: "inc-2", sla_met: false }),
    ]);

    render(<SLAReportsPage />);
    expect(await within(partFor("Compliance", "Incidents")).findByText("50%")).toBeInTheDocument();
    const callsBeforeClick = mockListIncidents.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(await within(partFor("Compliance", "Incidents")).findByText("50%")).toBeInTheDocument();
    expect(mockListIncidents.mock.calls.length).toBe(callsBeforeClick);
  });

  // The mirror-image case: when the ONE fetch this page now makes fails, the
  // monthly-summary strip must stay hidden — including after a later preset
  // click, since a preset click no longer triggers any fetch that could
  // recover it.
  it("does not render the monthly-summary strip when the fetch fails, even after a later preset click", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockRejectedValue({ kind: "unknown", message: "network down" });

    render(<SLAReportsPage />);
    await screen.findAllByText(/Unable to load SLA data/);
    expect(screen.queryByText(/^Across d+ months?:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Best month:")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Week" }));

    expect(screen.queryByText(/^Across d+ months?:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Best month:")).not.toBeInTheDocument();
  });

  // Six departments spanning every departmentStatus band via small, easy
  // fractions rather than the exact percentages a hand-built mock used to
  // pin — this test only asserts department names and derived status
  // labels, never a specific compliance percentage.
  it("renders the department table from getSlaByDepartment's derived rows, with derived statuses", async () => {
    mockListDepartments.mockResolvedValue([
      buildDepartment({ code: "ccm", label: "Convention Center Mgmt" }),
      buildDepartment({ code: "health", label: "Health Office" }),
      buildDepartment({ code: "engineering", label: "Engineering / Public Works" }),
      buildDepartment({ code: "environmental", label: "Environmental Office" }),
      buildDepartment({ code: "safety", label: "Public Safety Office" }),
      buildDepartment({ code: "waste", label: "Waste Management" }),
    ]);
    function group(code: string, met: number, unmet: number): IncidentRow[] {
      return [
        ...Array.from({ length: met }, (_, i) =>
          buildIncident({ id: `${code}-met-${i}`, assigned_department_code: code, sla_met: true })
        ),
        ...Array.from({ length: unmet }, (_, i) =>
          buildIncident({ id: `${code}-unmet-${i}`, assigned_department_code: code, sla_met: false })
        ),
      ];
    }
    mockListIncidents.mockResolvedValue([
      ...group("ccm", 1, 0), // 100% -> Meeting target
      ...group("health", 4, 1), // 80% -> Near target (>=75)
      ...group("engineering", 6, 4), // 60% -> Needs attention (<65)
      ...group("environmental", 13, 7), // 65% -> Below target (>=65)
      ...group("safety", 3, 2), // 60% -> Needs attention (<65)
      ...group("waste", 3, 7), // 30% -> Needs attention
    ]);

    render(<SLAReportsPage />);

    expect(screen.getByText("By department")).toBeInTheDocument();
    expect(await screen.findByText("Convention Center Mgmt")).toBeInTheDocument();
    expect(screen.getByText("Meeting target")).toBeInTheDocument();
    expect(screen.getByText("Near target")).toBeInTheDocument();
    // Admin Portal Fix Plan, final review, Fix 3: the "Below target"/"Needs
    // attention" boundary tightened from 50 to 65, so engineering and safety
    // (both 60%) moved out of "Below target" and into "Needs attention" —
    // only environmental (65%, right on the new boundary) stays "Below
    // target".
    expect(screen.getAllByText("Below target").length).toBe(1);
    expect(screen.getByText("Waste Management")).toBeInTheDocument();
    expect(screen.getAllByText("Needs attention").length).toBe(3);
  });

  // The synthetic Yellow Card row's compliance figure is correct on its own
  // terms (computed independently, nothing averaged across regimes) — the
  // problem fix round 1 addressed was only the column label implying it's a
  // peer of a real, department-routed row like "Engineering" or "Waste
  // Management". "Service area" doesn't carry that implication.
  it("labels the table's first column 'Service area', not 'Department'", async () => {
    mockListDepartments.mockResolvedValue([buildDepartment({ code: "ccm", label: "Convention Center Mgmt" })]);
    mockListIncidents.mockResolvedValue([buildIncident({ assigned_department_code: "ccm", sla_met: true })]);

    render(<SLAReportsPage />);
    await screen.findByText("Convention Center Mgmt");

    const section = screen.getByText("By department").closest("section")!;
    const headers = within(section)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual(["Service area", "Scored", "Compliance", "Status"]);
    expect(headers).not.toContain("Department");
    // #122: 85% is the capstone's project target, not a city or legal standard.
    expect(within(section).getByText("Compliance against the 85% project target")).toBeInTheDocument();
  });

  it("shows an empty state, not an error, when getSlaByDepartment resolves to []", async () => {
    render(<SLAReportsPage />);

    expect(
      await screen.findByText("No department SLA data for this range.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unable to load/i)).not.toBeInTheDocument();
  });

  it("switching range presets recomputes SLA data for the newly selected range without a new fetch", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([
      // Well outside every preset except Annual/Custom.
      buildIncident({ id: "inc-old", submitted_at: daysAgoIso(200), sla_met: true }),
      // "now" — inside every preset's [from, today] bounds.
      buildIncident({ id: "inc-recent", sla_met: true }),
    ]);

    render(<SLAReportsPage />);
    await screen.findByText("No department SLA data for this range.");
    const callsBeforeClick = mockListIncidents.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Week" }));

    // Only the recent incident falls inside "Week" — responses narrows from
    // 2 to 1, purely from the same already-fetched rows.
    const responsesTile = partFor("Requests scored", "Incidents");
    await waitFor(() => expect(within(responsesTile).getByText("1")).toBeInTheDocument());
    expect(mockListIncidents.mock.calls.length).toBe(callsBeforeClick);
  });

  it("the compare toggle shows and hides the derived comparison deltas", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([buildIncident({ id: "inc-1", sla_met: true })]);

    render(<SLAReportsPage />);
    await screen.findByText("No department SLA data for this range.");
    expect(screen.getByText("New activity vs previous period")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /compare to previous period/i }));
    expect(screen.queryByText("New activity vs previous period")).not.toBeInTheDocument();
  });

  // Also pins the page-level wiring for filterByDateRange: picking an exact
  // custom range must recompute the SLA figures against exactly that
  // {from, to} window, without triggering any additional fetch.
  it("picking a custom date range recomputes SLA data for those exact bounds, with no new fetch", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "inc-in", submitted_at: "2026-06-05T04:00:00Z", sla_met: true }),
      buildIncident({ id: "inc-out", submitted_at: "2026-07-05T04:00:00Z", sla_met: true }),
    ]);

    render(<SLAReportsPage />);
    await screen.findByText("No department SLA data for this range.");
    const callsBeforeClick = mockListIncidents.mock.calls.length;

    const start = screen.getByLabelText("Custom range start");
    const end = screen.getByLabelText("Custom range end");
    await user.clear(start);
    await user.type(start, "2026-06-01");
    await user.clear(end);
    await user.type(end, "2026-06-10");

    const responsesTile = partFor("Requests scored", "Incidents");
    await waitFor(() => expect(within(responsesTile).getByText("1")).toBeInTheDocument());
    expect(mockListIncidents.mock.calls.length).toBe(callsBeforeClick);
  });

  // Fix round 1, finding 3: the "Date type" toggle must actually change what
  // gets computed — it was previously read into local state but never
  // reached any SLA computation at all. This drives it with a fixture where
  // "request"/"resolution" visibly disagree: submitted well outside the
  // default "Month" range, but resolved "now" (inside it) — only the
  // resolution basis should count it.
  it("changing the date basis recomputes SLA data using the resolution date, with no new fetch", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "inc-1", submitted_at: daysAgoIso(40), resolved_at: defaultSubmittedAt(), sla_met: true }),
    ]);

    render(<SLAReportsPage />);
    await screen.findByText("No department SLA data for this range.");
    const responsesTile = partFor("Requests scored", "Incidents");
    expect(within(responsesTile).getByText("0")).toBeInTheDocument();
    const callsBeforeClick = mockListIncidents.mock.calls.length;

    await user.selectOptions(screen.getByLabelText("Date type"), "resolution");

    await waitFor(() => expect(within(responsesTile).getByText("1")).toBeInTheDocument());
    // Under Resolution Date the count is out of the requests closed in range.
    expect(within(responsesTile).getByText("of 1 closed in range")).toBeInTheDocument();
    expect(mockListIncidents.mock.calls.length).toBe(callsBeforeClick);
  });

  // Two months 40 days apart (always distinct calendar months — see the
  // trend-chart test above for why), of very different sizes. "Annual" is
  // clicked so both months fall inside the active range.
  //
  // #122: the footer divides on time by scored across the months, so a
  // one-case month can't count as much as a nine-case one. Averaging the
  // two monthly percentages would read (0 + 100) / 2 = 50%.
  it("the monthly history footer is weighted by cases and equals the incident compliance tile", async () => {
    const user = userEvent.setup();
    const monthA = daysAgoIso(40);
    const monthB = daysAgoIso(2);
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "a-unmet", submitted_at: monthA, resolved_at: monthA, sla_met: false }),
      ...Array.from({ length: 9 }, (_, i) =>
        buildIncident({ id: `b-met-${i}`, submitted_at: monthB, resolved_at: monthB, sla_met: true })
      ),
    ]);

    render(<SLAReportsPage />);
    await screen.findByText("No department SLA data for this range.");
    await user.click(screen.getByRole("button", { name: "Annual" }));

    const labelA = manilaMonthLabel(monthA);
    const labelB = manilaMonthLabel(monthB);
    expect(await screen.findByText("Monthly compliance history")).toBeInTheDocument();
    const historySection = sectionFor("Monthly compliance history");
    expect(within(historySection).getByText(labelA)).toBeInTheDocument();
    expect(within(historySection).getByText(labelB)).toBeInTheDocument();
    // Month A: 1 scored, 0 on time. Month B: 9 scored, 9 on time. 9 of 10.
    const footer = within(historySection).getByText("Across 2 months:").closest("div") as HTMLElement;
    expect(footer).toHaveTextContent("Across 2 months: 90% on time (9 of 10 scored)");
    expect(footer).toHaveTextContent(`Best month: ${labelB} (100%)`);
    expect(footer).not.toHaveTextContent("50%");
    expect(within(partFor("Compliance", "Incidents")).getByText("90%")).toBeInTheDocument();
  });

  // Admin Portal Fix Plan, Phase 1 final review, finding 1: a month with
  // zero scoreable incidents now arrives as compliancePct: null, not 0. The
  // table cell renders "—" (via formatRate) instead of "0%", and the
  // summary footer's average/best figures exclude the null month rather
  // than averaging it in as 0 or crowning it "best".
  it('renders "—" for a null-compliance month and excludes it from the summary footer\'s average/best', async () => {
    const user = userEvent.setup();
    const nullMonth = daysAgoIso(60);
    const realMonth = daysAgoIso(2);
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "n1", submitted_at: nullMonth, status: "open", resolved_at: null }),
      buildIncident({ id: "r1", submitted_at: realMonth, resolved_at: realMonth, sla_met: true }),
    ]);

    render(<SLAReportsPage />);
    await screen.findByText("No department SLA data for this range.");
    await user.click(screen.getByRole("button", { name: "Annual" }));

    const nullLabel = manilaMonthLabel(nullMonth);
    const realLabel = manilaMonthLabel(realMonth);
    expect(await screen.findByText("Monthly compliance history")).toBeInTheDocument();
    const historySection = sectionFor("Monthly compliance history");
    expect(within(historySection).getByText(nullLabel)).toBeInTheDocument();
    // The null month's Compliance cell reads "—", not "0%".
    expect(within(historySection).getAllByText("—").length).toBeGreaterThan(0);
    expect(within(historySection).queryByText("0%")).not.toBeInTheDocument();
    // The footer and best month come from the real month alone (100%),
    // not (0 + 100) / 2 = 50%.
    const footer = within(historySection).getByText("Across 2 months:").closest("div") as HTMLElement;
    expect(footer).toHaveTextContent("Across 2 months: 100% on time (1 of 1 scored)");
    expect(footer).toHaveTextContent(`Best month: ${realLabel} (100%)`);
  });

  // #115: an effectiveness delta says which way it moved, in words and in
  // colour; a volume delta stays grey. Month on 2026-06-15 is Jun 1-15, so
  // the previous period is May 17-31.
  describe("Effectiveness deltas say better or worse", () => {
    // `count` resolved incidents filed on `filedOn`, each resolved
    // `resolvedAfterHours` later, met or missed as `slaMet` says.
    function incidents(prefix: string, filedOn: string, count: number, resolvedAfterHours: number, slaMet: boolean): IncidentRow[] {
      const submittedAt = `${filedOn}T00:00:00Z`;
      return Array.from({ length: count }, (_, i) =>
        buildIncident({
          id: `${prefix}-${i}`,
          reference_number: `IR-2026-${prefix}-${i}`,
          submitted_at: submittedAt,
          resolved_at: new Date(Date.parse(submittedAt) + resolvedAfterHours * 3_600_000).toISOString(),
          sla_met: slaMet,
        })
      );
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-06-15T12:00:00+08:00"));
    });

    it("more incidents Finished late read 'worse' in red", async () => {
      mockListIncidents.mockResolvedValue([
        ...incidents("CUR", "2026-06-10", 2, 1, false),
        ...incidents("PREV", "2026-05-20", 1, 24, true),
      ]);

      render(<SLAReportsPage />);
      await screen.findByText("Monthly compliance history");

      const violations = await within(partFor("Finished late", "Incidents")).findByText("+2 vs previous period · worse");
      expect(violations).toHaveClass("text-red-700");
    });

    it("fewer incidents Finished late read 'better' in green", async () => {
      mockListIncidents.mockResolvedValue([
        ...incidents("CUR", "2026-06-10", 1, 24, true),
        ...incidents("PREV", "2026-05-20", 2, 1, false),
      ]);

      render(<SLAReportsPage />);
      await screen.findByText("Monthly compliance history");

      const violations = await within(partFor("Finished late", "Incidents")).findByText("-2 vs previous period · better");
      expect(violations).toHaveClass("text-green-700");
    });

    // Annual on the Sandbox: 2025 scored nothing, so "+16 · worse" compared
    // 16 late requests against no figure at all.
    it("Finished late has nothing to compare when the previous period scored nothing: grey, no word", async () => {
      mockListIncidents.mockResolvedValue(incidents("CUR", "2026-06-10", 2, 1, false));

      render(<SLAReportsPage />);
      await screen.findByText("Monthly compliance history");

      const violations = await within(partFor("Finished late", "Incidents")).findByText("No comparable data vs previous period");
      expect(violations).not.toHaveClass("text-red-700");
      expect(within(partFor("Finished late", "Incidents")).queryByText(/better|worse/)).not.toBeInTheDocument();
    });

    it("Requests scored is a volume figure: its delta stays grey with no word", async () => {
      mockListIncidents.mockResolvedValue([
        ...incidents("CUR", "2026-06-10", 2, 1, false),
        ...incidents("PREV", "2026-05-20", 1, 24, true),
      ]);

      render(<SLAReportsPage />);
      await screen.findByText("Monthly compliance history");

      const responses = await within(partFor("Requests scored", "Incidents")).findByText("+100% vs previous period");
      expect(responses).not.toHaveClass("text-green-700");
      expect(responses).not.toHaveClass("text-red-700");
      expect(within(partFor("Requests scored", "Incidents")).queryByText(/better|worse/)).not.toBeInTheDocument();
    });
  });

  it("names the monthly history's columns in plain words, with Avg time to resolve", async () => {
    mockListIncidents.mockResolvedValue([buildIncident({ id: "inc-1", sla_met: true })]);

    render(<SLAReportsPage />);
    await screen.findByText("Monthly compliance history");

    const historySection = sectionFor("Monthly compliance history");
    const headers = within(historySection)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers).toEqual(["Period", "Scored", "On time", "Finished late", "Compliance", "Avg time to resolve"]);
  });

  it("the monthly history's Avg time to resolve reads '—' for a month with nothing resolved, the formatted mean otherwise", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T12:00:00+08:00"));
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "open", submitted_at: "2026-05-10T00:00:00Z", status: "open", resolved_at: null }),
      buildIncident({ id: "quick", submitted_at: "2026-06-10T00:00:00Z", resolved_at: "2026-06-10T05:12:00Z", sla_met: true }),
    ]);

    render(<SLAReportsPage />);
    await screen.findByText("No department SLA data for this range.");
    await user.click(screen.getByRole("button", { name: "Annual" }));

    const historySection = sectionFor("Monthly compliance history");
    const mayRow = (await within(historySection).findByText("May 2026")).closest("tr") as HTMLElement;
    const juneRow = within(historySection).getByText("Jun 2026").closest("tr") as HTMLElement;
    // May: Compliance and Avg time to resolve both "—" (nothing scoreable, nothing resolved).
    expect(within(mayRow).getAllByText("—")).toHaveLength(2);
    expect(within(juneRow).getByText("5.2h")).toBeInTheDocument();
    expect(within(historySection).queryByText(/days$/)).not.toBeInTheDocument();
  });

  it("shows an empty state, not a crash, when there are no incidents at all", async () => {
    render(<SLAReportsPage />);

    expect(
      await screen.findByText("No monthly compliance history for this range.")
    ).toBeInTheDocument();
  });

  it("the CSV export reads the same trend the chart derives, not a separate mock table", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([buildIncident({ id: "inc-1", sla_met: true })]);

    render(<SLAReportsPage />);
    expect(await within(partFor("Compliance", "Incidents")).findByText("100%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "↓ Export report" }));

    const label = manilaMonthLabel(defaultSubmittedAt());
    expect(mockDownloadCsv).toHaveBeenCalledWith(
      "sla-report.csv",
      ["Period", "Incidents resolved on time %", "Incidents finished late"],
      [[label, 100, 0]]
    );
  });

  // Task 3.5: page.tsx is now a server-component wrapper whose only job is
  // to export a per-route metadata.title; app/layout.tsx's title template
  // ("%s · Lucena City Admin Portal") interpolates this into the actual
  // <title>. Asserted directly on the exported object, since RTL's render()
  // never mounts a document <head> and so can't observe next/navigation's
  // resolved <title> the way a real Next.js request would.
  it("exports a per-route title", () => {
    expect(metadata.title).toBe("SLA Reports");
  });

  // Admin Portal Fix Plan, Task 4.2, Step 4 (the same load-bearing guarantee
  // the Dashboard's equivalent test pins): every table this page reads —
  // Incidents, Yellow Card applications, and the department catalog — is
  // fetched exactly ONCE per page load, even across preset/date-basis
  // changes. Before this fix, each of getSlaByDepartment/getSlaTrend/
  // getSlaRangeStats/getSlaMonthlyHistory independently re-fetched
  // listIncidents()/listApplications() (and getSlaByDepartment also
  // re-fetched listDepartments()) — a single page load issued up to four
  // redundant reads of the same two tables, ALL re-issued again on every
  // preset/date-basis click. This test would have failed against the old
  // code on both counts.
  it("fetches listIncidents/listApplications exactly once per page load, even across preset and date-basis changes", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([buildIncident()]);
    mockListApplications.mockResolvedValue([buildApplication()]);

    render(<SLAReportsPage />);
    // buildApplication() is a DECIDED (approved) application, so the
    // synthetic "Yellow Card" department row renders instead of the empty
    // state — wait on the always-present "Requests scored" hero tile instead.
    await screen.findByText("Requests scored");

    expect(mockListIncidents).toHaveBeenCalledTimes(1);
    expect(mockListApplications).toHaveBeenCalledTimes(1);

    for (const label of ["Today", "Week", "Quarter", "Annual", "Month"]) {
      await user.click(screen.getByRole("button", { name: label }));
    }
    await user.selectOptions(screen.getByLabelText("Date type"), "resolution");
    await user.selectOptions(screen.getByLabelText("Date type"), "request");

    expect(mockListIncidents).toHaveBeenCalledTimes(1);
    expect(mockListApplications).toHaveBeenCalledTimes(1);
  });

  // Admin Portal Fix Plan, Task 4.3: a failed fetch used to be a dead end —
  // a static error message with no way to try again short of a full page
  // reload. Retry must re-run the exact single fetch-once-per-mount effect
  // Task 4.2 built (not a second, duplicate one), which this test pins by
  // counting calls the same way the "exactly once per page load" regression
  // test above does.
  describe("Task 4.3: retry affordance and last-updated stamp", () => {
    it("clicking Retry re-invokes the single fetch effect exactly once and recovers from a prior failure", async () => {
      const user = userEvent.setup();
      mockListIncidents.mockRejectedValueOnce({ kind: "unknown", message: "boom" });
      // Second render pass (after Retry) succeeds.
      mockListIncidents.mockResolvedValueOnce([]);

      render(<SLAReportsPage />);

      // Each of the three gated sections (compliance trend, by-department,
      // monthly history) renders the same error message independently.
      expect((await screen.findAllByText(/Unable to load SLA data: boom/)).length).toBeGreaterThan(0);
      expect(mockListIncidents).toHaveBeenCalledTimes(1);

      await user.click(screen.getAllByRole("button", { name: "Retry" })[0]);

      await screen.findByText("No SLA data for this range.");
      expect(screen.queryAllByText(/Unable to load SLA data: boom/)).toHaveLength(0);
      // Exactly one additional fetch per data source — not zero (Retry did
      // nothing) and not more than one (Retry somehow fired the effect
      // twice), preserving Task 4.2's single-fetch-per-load guarantee.
      expect(mockListIncidents).toHaveBeenCalledTimes(2);
      expect(mockListApplications).toHaveBeenCalledTimes(2);
    });

    it("shows the Updated stamp only once data has actually loaded, never during loading or after an error", async () => {
      let resolveIncidents: (rows: IncidentRow[]) => void = () => {};
      mockListIncidents.mockReturnValue(
        new Promise<IncidentRow[]>((resolve) => {
          resolveIncidents = resolve;
        })
      );

      render(<SLAReportsPage />);

      expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();

      resolveIncidents([]);
      await screen.findByText("No SLA data for this range.");

      expect(await screen.findByText(/^Updated .*\(Asia\/Manila\)$/)).toBeInTheDocument();
    });

    // Regression guard for a review finding on this task: Skeleton is
    // aria-hidden (a purely visual placeholder), so replacing the old plain
    // "Loading SLA data…" DOM text with Skeleton blocks left screen reader
    // users with zero signal that the page was loading. A role="status" live
    // region must announce it instead, and must disappear once real content
    // has loaded (a stale "loading" announcement would be its own kind of
    // lie).
    it("announces loading to assistive tech via a role=status live region, which clears once loaded", async () => {
      let resolveIncidents: (rows: IncidentRow[]) => void = () => {};
      mockListIncidents.mockReturnValue(
        new Promise<IncidentRow[]>((resolve) => {
          resolveIncidents = resolve;
        })
      );

      render(<SLAReportsPage />);

      expect(screen.getByRole("status")).toHaveTextContent("Loading SLA data…");

      resolveIncidents([]);
      await screen.findByText("No SLA data for this range.");

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("does not show the Updated stamp when the fetch fails", async () => {
      mockListIncidents.mockRejectedValue({ kind: "unknown", message: "boom" });

      render(<SLAReportsPage />);

      expect((await screen.findAllByText(/Unable to load SLA data: boom/)).length).toBeGreaterThan(0);
      expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();
    });
  });
});
