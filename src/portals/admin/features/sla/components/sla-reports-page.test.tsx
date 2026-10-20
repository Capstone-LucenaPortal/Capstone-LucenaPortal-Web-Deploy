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

  it("renders the compliance hero with the derived compliance, target and delta", async () => {
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "inc-1", sla_met: true }),
      buildIncident({ id: "inc-2", sla_met: true }),
      buildIncident({ id: "inc-3", sla_met: true }),
      buildIncident({ id: "inc-4", sla_met: false }),
    ]);

    render(<SLAReportsPage />);
    expect(screen.getByText("Monthly SLA Compliance Report")).toBeInTheDocument();
    // 3 met / 4 = 75%.
    expect(await within(tileFor("Compliance")).findByText("75%")).toBeInTheDocument();
    expect(within(tileFor("Compliance")).getByText("Target: 85%")).toBeInTheDocument();
    // No previous-period rows at all — percentDelta reads "New activity",
    // not a fabricated percentage swing.
    expect(within(tileFor("Responses")).getByText("New activity vs previous period")).toBeInTheDocument();
    await screen.findByText("No department SLA data for this range.");
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
    // hoursAgo(72)/hoursAgo(24) so every incident shares an identical 2-day
    // response time — avgResponseDays comes out to an exact, assertable "2d".
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

    expect(await within(tileFor("Responses")).findByText("5")).toBeInTheDocument();
    expect(within(tileFor("SLA Violations")).getByText("2")).toBeInTheDocument();
    expect(within(tileFor("Avg Response")).getByText("2d")).toBeInTheDocument();
    expect(within(tileFor("Compliance")).getByText("Target: 85%")).toBeInTheDocument();
    await screen.findByText("No department SLA data for this range.");
  });

  // Admin Portal Fix Plan, Phase 1 final review, finding 3: Task 1.1/1.2
  // each individually excluded pending applications / non-scoreable
  // incidents from this tile's count, with the only explanation living in a
  // code comment — an admin comparing this tile against a raw count shown
  // elsewhere had nothing on screen saying why the two disagree. The
  // Responses tile now captions the gap when one exists.
  it("the Responses tile captions the scoreable-vs-total gap when responses is less than totalInRange", async () => {
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "inc-1", sla_met: true }),
      buildIncident({ id: "inc-2", status: "open", resolved_at: null }),
      buildIncident({ id: "inc-3", status: "open", resolved_at: null }),
    ]);
    mockListApplications.mockResolvedValue([buildApplication({ id: "app-1", status: "pending" })]);

    render(<SLAReportsPage />);

    // 1 scoreable incident, 0 decided applications = 1 response, out of
    // 3 incidents + 1 application = 4 total in range.
    expect(await within(tileFor("Responses")).findByText("1")).toBeInTheDocument();
    expect(
      within(tileFor("Responses")).getByText("1 of 4 scoreable (pending/unverified excluded)")
    ).toBeInTheDocument();
  });

  it("the Responses tile omits the scoreable-vs-total caption once responses equals totalInRange", async () => {
    mockListIncidents.mockResolvedValue([
      buildIncident({ id: "inc-1", sla_met: true }),
      buildIncident({ id: "inc-2", sla_met: false }),
    ]);

    render(<SLAReportsPage />);

    expect(await within(tileFor("Responses")).findByText("2")).toBeInTheDocument();
    expect(
      within(tileFor("Responses")).queryByText(/scoreable \(pending\/unverified excluded\)/)
    ).not.toBeInTheDocument();
  });

  // Same reconciliation, per row, on the "By department" table's Requests
  // column — the other place the review found this same unexplained-gap
  // problem.
  it("the department table's Requests column shows the scoreable-vs-total gap per row", async () => {
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

    expect(await screen.findByText("Compliance trend")).toBeInTheDocument();
    const trendSection = sectionFor("Compliance trend");
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
    // Total violations 3 + 2 + 1 = 6; worst month is monthA with 3.
    expect(within(trendSection).getByText("6")).toBeInTheDocument();
    expect(within(trendSection).getByText(`${labelA} (3)`)).toBeInTheDocument();
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
    await screen.findByText("Compliance trend");

    const table = screen.getByRole("table", { name: /compliance trend data/i });
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
  // to render "0% compliance" in the tooltip — reading as "everyone violated
  // SLA" when the true answer is "nothing was scoreable yet." A null point
  // now renders no tooltip/dot at all rather than a fabricated one.
  it('the compliance trend chart does not render "0% compliance" for a null-compliance point', async () => {
    const user = userEvent.setup();
    const nullMonth = daysAgoIso(60);
    // 1 met / 3 = 33.3% — deliberately NOT a multiple of 10: "0% compliance"
    // is itself a substring of any percentage ending in a bare "0" (e.g.
    // "100%", "50%", "80%" all contain the literal substring "0% compliance"
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

    expect(await screen.findByText("Compliance trend")).toBeInTheDocument();
    const nullLabel = manilaMonthLabel(nullMonth);
    const realLabel = manilaMonthLabel(realMonth);
    const titleTexts = Array.from(container.querySelectorAll("svg title")).map((node) => node.textContent);
    expect(titleTexts.some((text) => text?.includes(nullLabel))).toBe(false);
    expect(titleTexts.some((text) => text?.includes("0% compliance"))).toBe(false);
    expect(titleTexts.some((text) => text?.includes(`${realLabel}: 33.3% compliance`))).toBe(true);
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

    for (const label of ["Responses", "SLA Violations", "Compliance", "Avg Response"]) {
      const tile = screen.getByText(label).closest("div") as HTMLElement;
      // The value line specifically — not the whole tile, since the
      // Compliance tile's static "Target: 85%" caption legitimately keeps
      // showing a digit regardless of fetch status (it names the city's
      // fixed SLA target, not a value derived from this fetch).
      const value = tile.querySelector(".text-2xl");
      expect(value).toHaveTextContent("—");
      expect(value?.textContent).not.toMatch(/\d/);
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
    expect(await within(tileFor("Compliance")).findByText("50%")).toBeInTheDocument();
    const callsBeforeClick = mockListIncidents.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(await within(tileFor("Compliance")).findByText("50%")).toBeInTheDocument();
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
    expect(screen.queryByText(/month average/)).not.toBeInTheDocument();
    expect(screen.queryByText("Best month:")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Week" }));

    expect(screen.queryByText(/month average/)).not.toBeInTheDocument();
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

    expect(headers).toEqual(["Service area", "Requests", "Compliance", "Status"]);
    expect(headers).not.toContain("Department");
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
    const responsesTile = screen.getByText("Responses").closest("div") as HTMLElement;
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

    const responsesTile = screen.getByText("Responses").closest("div") as HTMLElement;
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
    const responsesTile = screen.getByText("Responses").closest("div") as HTMLElement;
    expect(within(responsesTile).getByText("0")).toBeInTheDocument();
    const callsBeforeClick = mockListIncidents.mock.calls.length;

    await user.selectOptions(screen.getByLabelText("Date type"), "resolution");

    await waitFor(() => expect(within(responsesTile).getByText("1")).toBeInTheDocument());
    expect(mockListIncidents.mock.calls.length).toBe(callsBeforeClick);
  });

  // Two months 40 days apart (always distinct calendar months — see the
  // trend-chart test above for why), each with a clean, easily-verified
  // total/onTime/violations/avgResponseDays breakdown. "Annual" is clicked
  // so both months fall inside the active range.
  it("renders the monthly compliance history with a real, derived summary footer", async () => {
    const user = userEvent.setup();
    const monthA = daysAgoIso(40);
    const monthB = daysAgoIso(2);
    mockListIncidents.mockResolvedValue([
      ...Array.from({ length: 9 }, (_, i) =>
        buildIncident({ id: `a-met-${i}`, submitted_at: monthA, resolved_at: monthA, sla_met: true })
      ),
      buildIncident({ id: "a-unmet", submitted_at: monthA, resolved_at: monthA, sla_met: false }),
      ...Array.from({ length: 8 }, (_, i) =>
        buildIncident({ id: `b-met-${i}`, submitted_at: monthB, resolved_at: monthB, sla_met: true })
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        buildIncident({ id: `b-unmet-${i}`, submitted_at: monthB, resolved_at: monthB, sla_met: false })
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
    // Month A: 10 total, 9 on time -> 90%. Month B: 10 total, 8 on time -> 80%.
    // Average (90 + 80) / 2 = 85%. Best month is A at 90%. Total processed 20.
    expect(within(historySection).getByText(/85% ·/)).toBeInTheDocument();
    expect(within(historySection).getByText(new RegExp(`${labelA} \\(90%\\)`))).toBeInTheDocument();
    expect(within(historySection).getByText(/20 incidents/)).toBeInTheDocument();
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
    // Average/best are derived from the real month alone (100%), not
    // (0 + 100) / 2 = 50%.
    expect(within(historySection).getByText(/100% ·/)).toBeInTheDocument();
    expect(within(historySection).getByText(new RegExp(`${realLabel} \\(100%\\)`))).toBeInTheDocument();
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
    expect(await within(tileFor("Compliance")).findByText("100%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "↓ Export report" }));

    const label = manilaMonthLabel(defaultSubmittedAt());
    expect(mockDownloadCsv).toHaveBeenCalledWith(
      "sla-report.csv",
      ["Period", "Compliance %", "Violations"],
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
    // state — wait on the always-present "Responses" hero tile instead.
    await screen.findByText("Responses");

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
