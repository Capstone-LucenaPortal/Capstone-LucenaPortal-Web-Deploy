// src/portals/admin/features/incidents/components/issue-reports-page.test.tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IssueReportsPage, { metadata } from "@/app/(admin)/admin/(shell)/issue-reports/page";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { DepartmentRow, IncidentCategoryRow } from "@/portals/admin/lib/supabase/catalogs";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that app/(admin)/issue-reports/
// page.tsx imports.
const mockListIncidents = vi.fn();
const mockReadIncidentPii = vi.fn();
const mockListDepartments = vi.fn();
const mockListIncidentCategories = vi.fn();
const mockGetIncidentConfig = vi.fn();
const mockDownloadCsv = vi.fn();

vi.mock("../lib/incidents", () => ({
  listIncidents: () => mockListIncidents(),
  readIncidentPii: (id: string) => mockReadIncidentPii(id),
}));

vi.mock("../../../lib/supabase/catalogs", () => ({
  listDepartments: () => mockListDepartments(),
  listIncidentCategories: () => mockListIncidentCategories(),
  getIncidentConfig: () => mockGetIncidentConfig(),
}));

// The real public_incident_config values on this deployment: a DIFFERENT
// response target per severity, which is the whole point of reading them
// rather than hardcoding one number.
function buildIncidentConfig() {
  return {
    sla_hours_critical: 4,
    sla_hours_high: 8,
    sla_hours_medium: 24,
    sla_hours_low: 72,
    auto_close_day: 7,
    confirmation_window_days: 3,
    max_active_reports_per_citizen: 3,
    max_photos_per_cycle: 3,
    nudge_day: 5,
  };
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

vi.mock("../../../lib/csv", () => ({
  downloadCsv: (filename: string, header: string[], rows: unknown[][]) =>
    mockDownloadCsv(filename, header, rows),
}));

// The page's default preset is "Month", and the table filters rows through
// filterByDateRange against real wall-clock "now" (most tests below never
// touch the date controls). Every non-Custom preset's "to" bound is "today",
// not the end of the calendar unit, so a hardcoded submitted_at would drift
// out of range the moment the real date moves on. Using the current instant
// is the only value guaranteed to sit inside every preset's [from, today]
// bounds on any day this suite runs. Tests that care about a specific month
// pass an explicit `submitted_at` override.
function defaultSubmittedAt(): string {
  return new Date().toISOString();
}

function buildRow(overrides: Partial<IncidentRow> = {}): IncidentRow {
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
    status: "open",
    closure_reason: null,
    submitted_at: defaultSubmittedAt(),
    routed_at: null,
    resolved_at: null,
    closed_at: null,
    reopened_count: 0,
    time_to_triage_hours: null,
    sla_met: null,
    ...overrides,
  };
}

function buildDepartment(overrides: Partial<DepartmentRow> = {}): DepartmentRow {
  return {
    code: "DPW",
    label: "Department of Public Works",
    sort_order: 1,
    ...overrides,
  };
}

function buildCategory(overrides: Partial<IncidentCategoryRow> = {}): IncidentCategoryRow {
  return {
    code: "infrastructure",
    label: "Infrastructure",
    sort_order: 1,
    ...overrides,
  };
}

function getRecentReportsSection(): HTMLElement {
  return screen.getByText("Recent reports").closest("section")!;
}

describe("IssueReportsPage", () => {
  beforeEach(() => {
    mockListIncidents.mockReset();
    mockReadIncidentPii.mockReset();
    mockListDepartments.mockReset();
    mockListDepartments.mockResolvedValue([]);
    mockListIncidentCategories.mockReset();
    mockListIncidentCategories.mockResolvedValue([]);
    mockGetIncidentConfig.mockReset();
    mockGetIncidentConfig.mockResolvedValue(buildIncidentConfig());
    mockDownloadCsv.mockReset();
  });

  // The Category mix panel is fed the ACTIVE date range's rows, but its
  // subtitle used to read a fixed "Share of reports this month" — so under
  // Annual (or Today, or a Custom range) the caption contradicted the very
  // data beneath it.
  it("the Category mix subtitle names the active range, not a fixed 'this month'", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([buildRow()]);

    render(<IssueReportsPage />);
    await screen.findByText("IR-2026-000001");

    const manilaToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    await user.click(screen.getByRole("button", { name: "Annual" }));

    // The Annual preset runs Jan 1 to today, so the subtitle must say so
    // rather than describing the range as a month.
    expect(
      await screen.findByText(new RegExp(`Share of reports · Jan 1, ${manilaToday.slice(0, 4)}`))
    ).toBeInTheDocument();
    expect(screen.queryByText("Share of reports this month")).not.toBeInTheDocument();
  });

  // The Custom date inputs used to be seeded with literals written the day
  // this page was authored ("2026-04-01"/"2026-04-30"), so clicking into them
  // months later offered a window with nothing to do with the present.
  it("seeds the Custom date inputs from the current Manila month, not authoring-time literals", () => {
    mockListIncidents.mockResolvedValue([]);

    render(<IssueReportsPage />);

    const manilaToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    expect(screen.getByLabelText("Custom range end")).toHaveValue(manilaToday);
    expect(screen.getByLabelText("Custom range start")).toHaveValue(`${manilaToday.slice(0, 7)}-01`);
  });

  // Admin Portal Fix Plan, Task 1.3: Open Backlog's "past SLA" figure used to
  // measure each open incident's age (now - submitted_at) against its
  // level's target from public_incident_config. That counted never-armed
  // (unverified) incidents as breached, charged routing/verification delay
  // against the department, and re-judged old incidents against a target
  // that may have since changed — see backlogPastSla's doc comment in
  // src/portals/admin/lib/aggregate.ts. The tile now always reads "unavailable" rather
  // than a computed count, regardless of how old or severe the open rows
  // are, until a Phase 6 migration adds a real armed due date.
  describe("Open Backlog past-SLA is unavailable, not a submitted_at-derived count", () => {
    it("reads 'unavailable' even for a critical incident well past its 4h target, config included", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", status: "open", incident_level: "critical", submitted_at: hoursAgo(5) }),
        buildRow({ id: "inc-2", reference_number: "IR-2026-000002", status: "open", incident_level: "low", submitted_at: hoursAgo(5) }),
      ]);

      render(<IssueReportsPage />);
      await screen.findByText("IR-2026-000001");

      expect(await screen.findByText(/SLA breach count unavailable/)).toBeInTheDocument();
      expect(screen.queryByText(/past their level's SLA target/)).not.toBeInTheDocument();
    });

    it("stays 'unavailable' the same way when the config cannot be read too", async () => {
      mockGetIncidentConfig.mockRejectedValue({ kind: "unknown", message: "boom" });
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", status: "open", incident_level: "critical", submitted_at: hoursAgo(5) }),
      ]);

      render(<IssueReportsPage />);
      await screen.findByText("IR-2026-000001");

      expect(await screen.findByText(/SLA breach count unavailable/)).toBeInTheDocument();
      expect(screen.queryByText(/past their level's SLA target/)).not.toBeInTheDocument();
    });
  });

  // src/portals/admin/lib/csv.ts was previously untested and the export button was completely
  // uncovered — a mutation adding a "Reporter" column to this header left
  // 306/306 green. Exact array equality (not a subset check) is required so
  // an added PII column fails this test the moment it's introduced.
  it("the exported CSV header is exactly the expected columns", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([buildRow()]);

    render(<IssueReportsPage />);
    await screen.findByText("IR-2026-000001");

    await user.click(within(getRecentReportsSection()).getByRole("button", { name: "↓ Export" }));

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [filename, header] = mockDownloadCsv.mock.calls[0];
    expect(filename).toBe("issue-reports.csv");
    expect(header).toEqual([
      "Reference",
      "Type",
      "Level",
      "Barangay",
      "Department",
      "Submitted",
      "Status",
      "Closure Reason",
      "Reopened",
      "Time to Triage",
    ]);
  });

  // Admin Portal Fix Plan, Task 5.3 follow-up: closure_reason/reopened_count/
  // time_to_triage_hours were surfaced in the visible table but not the CSV
  // export, even though the export's own doc comment claims "every column
  // here also appears in the visible table" (true, but was silently no
  // longer true in the other direction — the visible table had columns the
  // export omitted). Pins the same friendly labels/formatting the table
  // itself uses, not just their presence.
  it("includes closure reason, reopened count, and time-to-triage in the exported row, matching the visible table's formatting", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([
      buildRow({
        id: "inc-1",
        reference_number: "IR-2026-000001",
        status: "closed",
        closure_reason: "auto_confirmed",
        reopened_count: 2,
        time_to_triage_hours: 3.456,
      }),
    ]);

    render(<IssueReportsPage />);
    await screen.findByText("IR-2026-000001");

    await user.click(within(getRecentReportsSection()).getByRole("button", { name: "↓ Export" }));

    const [, , rows] = mockDownloadCsv.mock.calls[0];
    const row = rows[0];
    // Same friendly label the table renders for this closure_reason value
    // (see the "shows the closure reason" table test), not the raw enum code.
    expect(row).toContain("Auto-confirmed");
    // Plain numeric count in the CSV, not the "Reopened ×2" badge text the
    // table shows — a spreadsheet column called "Reopened" holding a number
    // is more useful than a UI-shaped string.
    expect(row).toContain(2);
    // Same rounding the table's formatTriageHours applies.
    expect(row).toContain("3.5h");
  });

  it("shows \"—\" for closure reason, reopened count, and time-to-triage in the export when a row has none of them", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([
      buildRow({
        id: "inc-1",
        reference_number: "IR-2026-000001",
        status: "open",
        closure_reason: null,
        reopened_count: 0,
        time_to_triage_hours: null,
      }),
    ]);

    render(<IssueReportsPage />);
    await screen.findByText("IR-2026-000001");

    await user.click(within(getRecentReportsSection()).getByRole("button", { name: "↓ Export" }));

    const [, , rows] = mockDownloadCsv.mock.calls[0];
    const row = rows[0];
    // Closure Reason and Time to Triage columns both read "—" for a legitimately
    // absent value (mirrors the table's own convention) — Reopened is a real
    // 0, not "—", since it's a count, not a claim about an unmeasurable value.
    expect(row[row.length - 3]).toBe("—");
    expect(row[row.length - 2]).toBe(0);
    expect(row[row.length - 1]).toBe("—");
  });

  // Regression guard: the export used to read `rows` (every fetched
  // incident) instead of `filtered` (the status-tab-narrowed view the table
  // above already shows), silently exporting rows the admin cannot see on
  // screen. The fixture makes filtered vs. unfiltered visibly different —
  // inc-2 is resolved, so switching to the "Awaiting Triage" tab must drop
  // it from the downloaded content entirely.
  it("clicking Export downloads only the rows visible under the active status tab, not every fetched row", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([
      buildRow({ id: "inc-1", reference_number: "IR-2026-000001", status: "open" }),
      buildRow({ id: "inc-2", reference_number: "IR-2026-000002", status: "resolved" }),
    ]);

    render(<IssueReportsPage />);
    await screen.findByText("IR-2026-000001");

    await user.click(screen.getByRole("tab", { name: "Awaiting Triage" }));
    await user.click(within(getRecentReportsSection()).getByRole("button", { name: "↓ Export" }));

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [, , rows] = mockDownloadCsv.mock.calls[0];
    expect(rows.flat()).toContain("IR-2026-000001");
    expect(rows.flat()).not.toContain("IR-2026-000002");
  });

  // Filtering/bucketing are rigorously Manila-anchored (src/portals/admin/lib/dates.ts), but
  // the Submitted column (and the CSV export, which reuses the same
  // formatManilaDate helper) used to render via a local toLocaleDateString
  // call with no timeZone option, reading the HOST's local zone instead of
  // Manila — a row the filter correctly places in August could render, and
  // export, as if it were July on a host whose local zone lags Manila's
  // UTC+8. This pins the page's end-to-end wiring against the boundary
  // instant that exposes the bug class (2026-07-31T16:30:00Z is Jul 31 in
  // UTC but Aug 1 00:30 in Manila). The explicit "Asia/Manila" zone itself
  // is guarded machine-independently by formatManilaDate's own spy test in
  // src/portals/admin/lib/dates.test.ts, since a host-output-only assertion here
  // would spuriously pass on any machine whose ambient zone already happens
  // to be Asia/Manila.
  it("renders the Submitted date — on screen and in the exported CSV — as the Manila calendar day, using the shared formatManilaDate helper", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
    try {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", submitted_at: "2026-07-31T16:30:00Z" }),
      ]);

      render(<IssueReportsPage />);
      await screen.findByText("IR-2026-000001");

      expect(screen.getByText("Aug 1, 2026")).toBeInTheDocument();
      expect(screen.queryByText("Jul 31, 2026")).not.toBeInTheDocument();

      await user.click(within(getRecentReportsSection()).getByRole("button", { name: "↓ Export" }));
      const [, , rows] = mockDownloadCsv.mock.calls[0];
      expect(rows.flat()).toContain("Aug 1, 2026");
      expect(rows.flat()).not.toContain("Jul 31, 2026");
    } finally {
      vi.useRealTimers();
    }
  });

  // This is the Task 4 -> Task 5 handoff regression guard: the list's Review
  // button is only wired correctly if it opens the audited drill-down for
  // THAT row's id, not some other row's or a hardcoded one. Two rows are used
  // deliberately — a single-row fixture can't distinguish "passed the right
  // id" from "passed the only id" — and the second row is the one clicked, so
  // an always-first-row or off-by-one bug would fail this test. Each row's id
  // is also deliberately NOT its reference_number, so a mix-up between the
  // two is detectable.
  it("clicking Review on a row opens the audited PII drill-down for that incident's id", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([
      buildRow({ id: "incident-uuid-1", reference_number: "IR-2026-000001" }),
      buildRow({ id: "incident-uuid-2", reference_number: "IR-2026-000002" }),
    ]);
    mockReadIncidentPii.mockResolvedValue({
      reference: "IR-2026-000002",
      description: "Streetlight out for three nights",
      address: "45 Bonifacio St., Barangay Two",
      barangay_code: "BGY-2",
      barangay_name: "Barangay Two",
      incident_type_code: "streetlight",
      incident_type_label: "Streetlight",
      incident_level: "medium",
      assigned_department_code: "DPW",
      assigned_department_label: "Department of Public Works",
      status: "open",
      submitted_at: "2026-05-01T00:00:00Z",
      is_anonymous: false,
      reporter_first_name: "Maria",
      reporter_middle_name: "Reyes",
      reporter_last_name: "Santos",
      reporter_contact_number: "0917-999-8888",
      reporter_email: "maria.santos@example.com",
    });

    render(<IssueReportsPage />);
    await screen.findByText("IR-2026-000001");
    await screen.findByText("IR-2026-000002");

    const reviewButtons = screen.getAllByRole("button", { name: "Review" });
    expect(reviewButtons).toHaveLength(2);
    await user.click(reviewButtons[1]);

    expect(mockReadIncidentPii).toHaveBeenCalledWith("incident-uuid-2");
    expect(await screen.findByText("maria.santos@example.com")).toBeInTheDocument();
  });

  it("renders a row per returned incident, showing its reference number", async () => {
    mockListIncidents.mockResolvedValue([
      buildRow({ id: "inc-1", reference_number: "IR-2026-000001" }),
      buildRow({ id: "inc-2", reference_number: "IR-2026-000002" }),
    ]);

    render(<IssueReportsPage />);

    expect(await screen.findByText("IR-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("IR-2026-000002")).toBeInTheDocument();
  });

  // This is the privacy regression guard: admin_incident_analytics carries no
  // reporter name, email, phone or address by design, and incidents have no
  // title column at all — only a description, which the view doesn't expose
  // either. The list must not gain a column for any of that. Exact array
  // equality (not a subset/contains check) is required so a Name column
  // added alongside the real columns would still fail this test.
  it("renders exactly the required column set — no reporter PII, no invented Title/Category/Priority/Assigned To", async () => {
    mockListIncidents.mockResolvedValue([buildRow()]);

    render(<IssueReportsPage />);
    await screen.findByText("IR-2026-000001");

    const section = getRecentReportsSection();
    const headers = within(section)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Reference",
      "Type",
      "Level",
      "Barangay",
      "Department",
      "Submitted",
      "Status",
      "Closure Reason",
      "Reopened",
      "Time to Triage",
      "Review",
    ]);
    expect(headers).not.toContain("Reporter");
    expect(headers).not.toContain("Name");
    expect(headers).not.toContain("Email");
    expect(headers).not.toContain("Contact");
  });

  // Admin Portal Fix Plan, Task 5.3: closure_reason/reopened_count/
  // time_to_triage_hours are already on admin_incident_analytics but were
  // never rendered anywhere on this page.
  describe("Task 5.3: closure_reason, reopened_count, time_to_triage_hours", () => {
    it("renders a friendly label for closure_reason, including the newly-reachable auto_confirmed/expired_unverified values", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", status: "closed", closure_reason: "auto_confirmed" }),
        buildRow({ id: "inc-2", reference_number: "IR-2026-000002", status: "closed", closure_reason: "expired_unverified" }),
      ]);

      render(<IssueReportsPage />);

      expect(await screen.findByText("Auto-confirmed")).toBeInTheDocument();
      expect(screen.getByText("Expired (Unverified)")).toBeInTheDocument();
      expect(screen.queryByText("auto_confirmed")).not.toBeInTheDocument();
      expect(screen.queryByText("expired_unverified")).not.toBeInTheDocument();
    });

    it("renders '—' for closure_reason on a still-open incident, not a blank cell", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", status: "open", closure_reason: null }),
      ]);

      render(<IssueReportsPage />);
      await screen.findByText("IR-2026-000001");

      const row = screen.getByText("IR-2026-000001").closest("tr")!;
      expect(within(row).getAllByText("—").length).toBeGreaterThan(0);
    });

    it("shows a Reopened badge with the count only when reopened_count > 0, and '—' otherwise", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", reopened_count: 2 }),
        buildRow({ id: "inc-2", reference_number: "IR-2026-000002", reopened_count: 0 }),
      ]);

      render(<IssueReportsPage />);
      await screen.findByText("IR-2026-000001");

      expect(screen.getByText("Reopened ×2")).toBeInTheDocument();
      const row2 = screen.getByText("IR-2026-000002").closest("tr")!;
      expect(within(row2).queryByText(/Reopened/)).not.toBeInTheDocument();
    });

    it("renders time_to_triage_hours rounded to one decimal, and '—' when null", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", time_to_triage_hours: 3.456 }),
        buildRow({ id: "inc-2", reference_number: "IR-2026-000002", time_to_triage_hours: null }),
      ]);

      render(<IssueReportsPage />);
      await screen.findByText("IR-2026-000001");

      expect(screen.getByText("3.5h")).toBeInTheDocument();
      const row2 = screen.getByText("IR-2026-000002").closest("tr")!;
      expect(within(row2).getAllByText("—").length).toBeGreaterThan(0);
    });
  });

  it("joins assigned_department_code to its label via listDepartments()", async () => {
    mockListIncidents.mockResolvedValue([buildRow({ assigned_department_code: "DPW" })]);
    mockListDepartments.mockResolvedValue([
      buildDepartment({ code: "DPW", label: "Department of Public Works" }),
    ]);

    render(<IssueReportsPage />);

    expect(await screen.findByText("Department of Public Works")).toBeInTheDocument();
  });

  it("falls back to the raw department code when the catalog has no match", async () => {
    mockListIncidents.mockResolvedValue([buildRow({ assigned_department_code: "UNKNOWN-DEPT" })]);
    mockListDepartments.mockResolvedValue([buildDepartment({ code: "DPW", label: "Public Works" })]);

    render(<IssueReportsPage />);

    expect(await screen.findByText("UNKNOWN-DEPT")).toBeInTheDocument();
  });

  it("shows an empty state, not an error, when listIncidents resolves to []", async () => {
    mockListIncidents.mockResolvedValue([]);

    render(<IssueReportsPage />);

    expect(await screen.findByText("No reports match this filter.")).toBeInTheDocument();
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unable to load/i)).not.toBeInTheDocument();
  });

  it("shows a permission message when listIncidents rejects with kind: permission", async () => {
    mockListIncidents.mockRejectedValue({
      kind: "permission",
      message: "caller is not an active Admin",
    });

    render(<IssueReportsPage />);

    expect(
      await screen.findByText("You do not have permission to view Incident Reports.")
    ).toBeInTheDocument();
    expect(screen.queryByText("No reports match this filter.")).not.toBeInTheDocument();
  });

  it("status tabs filter on the real incident_status enum values", async () => {
    const user = userEvent.setup();
    mockListIncidents.mockResolvedValue([
      buildRow({ id: "inc-1", reference_number: "IR-2026-000001", status: "open" }),
      buildRow({ id: "inc-2", reference_number: "IR-2026-000002", status: "in_progress" }),
      buildRow({ id: "inc-3", reference_number: "IR-2026-000003", status: "resolved" }),
    ]);

    render(<IssueReportsPage />);
    await screen.findByText("IR-2026-000001");

    await user.click(screen.getByRole("tab", { name: "In Progress" }));
    expect(screen.queryByText("IR-2026-000001")).not.toBeInTheDocument();
    expect(screen.getByText("IR-2026-000002")).toBeInTheDocument();
    expect(screen.queryByText("IR-2026-000003")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Resolved" }));
    expect(screen.getByText("IR-2026-000003")).toBeInTheDocument();
    expect(screen.queryByText("IR-2026-000002")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "All" }));
    expect(screen.getByText("IR-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("IR-2026-000002")).toBeInTheDocument();
    expect(screen.getByText("IR-2026-000003")).toBeInTheDocument();
  });

  // Regression guard: the table must agree with the date controls above it,
  // the same property Task 4's Yellow Card equivalent pinned.
  it("selecting a date preset that covers only one row's month shows only that row", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockListIncidents.mockResolvedValue([
        buildRow({
          id: "inc-1",
          reference_number: "IR-2026-000001",
          submitted_at: "2026-08-05T04:00:00Z", // inside August, the active Month preset
        }),
        buildRow({
          id: "inc-2",
          reference_number: "IR-2026-000002",
          submitted_at: "2026-05-10T04:00:00Z", // a different month, outside the range
        }),
      ]);

      render(<IssueReportsPage />);
      await screen.findByText("IR-2026-000001");

      // Default preset is already "Month"; click it explicitly to exercise
      // the same path a user selecting it would.
      await user.click(screen.getByRole("button", { name: "Month" }));

      expect(screen.getByText("IR-2026-000001")).toBeInTheDocument();
      expect(screen.queryByText("IR-2026-000002")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // Issue #24: the date type used to reach the KPI tiles only; the table, the
  // Export and the monthly chart stayed on submitted_at. inc-1 is open (no
  // resolved_at), inc-2 was reported in July and resolved this month, inc-3
  // was reported in June and resolved in July.
  it("the date type also drives the table, its date column, the Export and the monthly chart", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", submitted_at: "2026-08-05T04:00:00Z" }),
        buildRow({
          id: "inc-2",
          reference_number: "IR-2026-000002",
          status: "resolved",
          submitted_at: "2026-07-01T04:00:00Z",
          resolved_at: "2026-08-10T04:00:00Z",
        }),
        buildRow({
          id: "inc-3",
          reference_number: "IR-2026-000003",
          status: "resolved",
          submitted_at: "2026-06-02T04:00:00Z",
          resolved_at: "2026-07-20T04:00:00Z",
        }),
      ]);

      render(<IssueReportsPage />);
      await screen.findByText("IR-2026-000001");

      const recent = getRecentReportsSection();
      const chart = screen.getByText("Reports by month").closest("section")!;

      // Default date type: unchanged from before the fix.
      expect(within(recent).getByRole("columnheader", { name: "Submitted" })).toBeInTheDocument();
      expect(within(recent).queryByText("IR-2026-000002")).not.toBeInTheDocument();
      expect(within(chart).getByText("Last 6 months")).toBeInTheDocument();
      expect(within(chart).getByTitle("Jun: 1")).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Date type"), "resolution");

      expect(within(recent).getByText("IR-2026-000002")).toBeInTheDocument();
      expect(within(recent).queryByText("IR-2026-000001")).not.toBeInTheDocument();
      expect(within(recent).queryByText("IR-2026-000003")).not.toBeInTheDocument();
      expect(within(recent).getByRole("columnheader", { name: "Resolved" })).toBeInTheDocument();
      expect(within(recent).queryByRole("columnheader", { name: "Submitted" })).not.toBeInTheDocument();
      expect(within(recent).getByText("Aug 10, 2026")).toBeInTheDocument();

      await user.click(within(recent).getByRole("button", { name: "↓ Export" }));
      const [, , exported] = mockDownloadCsv.mock.calls[0];
      expect(exported.map((row: unknown[]) => row[0])).toEqual(["IR-2026-000002"]);

      expect(within(chart).getByText("By resolution date · Last 6 months")).toBeInTheDocument();
      expect(within(chart).getByTitle("Jul: 1")).toBeInTheDocument();
      expect(within(chart).getByTitle("Aug: 1")).toBeInTheDocument();
      expect(within(chart).queryByTitle("Jun: 1")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // Task 10: the chart panels below the KPI tiles used to read mock data,
  // not listIncidents(). These pin that they now derive from the data-layer
  // rows the page already fetched, via
  // lib/aggregate.
  describe("chart panels derive from listIncidents(), not mock data", () => {
    it("the category mix panel counts rows by category_code", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", category_code: "infrastructure" }),
        buildRow({ id: "inc-2", reference_number: "IR-2026-000002", category_code: "infrastructure" }),
        buildRow({ id: "inc-3", reference_number: "IR-2026-000003", category_code: "sanitation" }),
      ]);

      render(<IssueReportsPage />);

      const section = screen.getByText("Category mix").closest("section")!;
      // listIncidentCategories() resolves to [] by default (see beforeEach),
      // so categoryLabel falls back to the raw category_code — these are NOT
      // the old mock's invented Title Case labels ("Infrastructure", "Public
      // Safety", ...), they're just what's left when the catalog has no
      // match. Waiting on the panel's own content (rather than a row in the
      // table below) is the load signal here, since the table below is
      // separately date-filtered.
      expect(await within(section).findByText("infrastructure")).toBeInTheDocument();
      expect(within(section).getByText("sanitation")).toBeInTheDocument();
      expect(within(section).queryByText("Public Safety")).not.toBeInTheDocument();
    });

    // Fix round 1, item 3: category_code must be joined to its human label
    // via listIncidentCategories(), the same shape listDepartments()/
    // listVenues() already use.
    it("the category mix panel joins category_code to its label via listIncidentCategories()", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", category_code: "infrastructure" }),
      ]);
      mockListIncidentCategories.mockResolvedValue([
        buildCategory({ code: "infrastructure", label: "Infrastructure" }),
      ]);

      render(<IssueReportsPage />);

      const section = screen.getByText("Category mix").closest("section")!;
      expect(await within(section).findByText("Infrastructure")).toBeInTheDocument();
      expect(within(section).queryByText("infrastructure")).not.toBeInTheDocument();
    });

    it("the category mix panel falls back to the raw category_code when the catalog has no match", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", category_code: "unmapped-category" }),
      ]);
      mockListIncidentCategories.mockResolvedValue([
        buildCategory({ code: "infrastructure", label: "Infrastructure" }),
      ]);

      render(<IssueReportsPage />);

      const section = screen.getByText("Category mix").closest("section")!;
      expect(await within(section).findByText("unmapped-category")).toBeInTheDocument();
    });

    // Fix round 1, item 2: categoryMix must respect the active status tab,
    // not just raw rows. The fixture makes filtered vs. unfiltered visibly
    // different — "sanitation" only belongs to a resolved incident — so
    // filtering to "Awaiting Triage" must remove it from the panel entirely.
    it("the category mix panel respects the active status tab, not just raw rows", async () => {
      const user = userEvent.setup();
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", category_code: "infrastructure", status: "open" }),
        buildRow({ id: "inc-2", reference_number: "IR-2026-000002", category_code: "sanitation", status: "resolved" }),
      ]);

      render(<IssueReportsPage />);
      const section = screen.getByText("Category mix").closest("section")!;
      expect(await within(section).findByText("infrastructure")).toBeInTheDocument();
      expect(within(section).getByText("sanitation")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "Awaiting Triage" }));

      expect(within(section).getByText("infrastructure")).toBeInTheDocument();
      expect(within(section).queryByText("sanitation")).not.toBeInTheDocument();
    });

    // Task 3.4: MixBarCard already showed each slice's count as visible
    // text, but the bar itself carried no accessible pairing between the
    // slice's label and its value. It now exposes both together via a
    // role="img" aria-label on the bar.
    it("the category mix panel's bars carry a data-bearing aria-label per slice", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", category_code: "infrastructure" }),
        buildRow({ id: "inc-2", reference_number: "IR-2026-000002", category_code: "infrastructure" }),
      ]);

      render(<IssueReportsPage />);
      const section = screen.getByText("Category mix").closest("section")!;
      expect(await within(section).findByText("infrastructure")).toBeInTheDocument();
      expect(within(section).getByRole("img", { name: "infrastructure: 2" })).toBeInTheDocument();
    });

    it("the reports-by-month panel buckets rows into their Manila submission month", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", submitted_at: "2026-03-10T04:00:00Z" }),
      ]);

      render(<IssueReportsPage />);

      const section = screen.getByText("Reports by month").closest("section")!;
      // The chart derives from the full fetched `rows`, not the date-filtered
      // table below, so a March submission still shows up here even though
      // the page's default "Month" preset would filter it out of the table.
      expect(await within(section).findByTitle("Mar: 1")).toBeInTheDocument();
      // The old mock trend's April total must not still be on screen.
      expect(within(section).queryByTitle("Apr: 1245")).not.toBeInTheDocument();
      // Task 3.4: this panel never passes `showCounts`, so it used to render
      // no visible number at all — only the mouse-only title tooltip above.
      // MonthlyBarCard's default is now true, and the bar itself carries a
      // matching data-bearing aria-label for assistive tech.
      expect(within(section).getByText("1")).toBeInTheDocument();
      expect(within(section).getByRole("img", { name: "Mar: 1" })).toBeInTheDocument();
    });

    it("the reports-by-barangay panel ranks barangays by real report counts and top category", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", reference_number: "IR-2026-000001", barangay_name: "Barangay One", category_code: "infrastructure" }),
        buildRow({ id: "inc-2", reference_number: "IR-2026-000002", barangay_name: "Barangay One", category_code: "infrastructure" }),
        buildRow({ id: "inc-3", reference_number: "IR-2026-000003", barangay_name: "Barangay Two", category_code: "sanitation" }),
      ]);

      render(<IssueReportsPage />);

      const section = screen.getByText("Reports by barangay").closest("section")!;
      expect(await within(section).findByText("Barangay One")).toBeInTheDocument();
      expect(within(section).getByText("Barangay Two")).toBeInTheDocument();
      // "infrastructure" appears twice: once as the category filter's
      // <option>, once as Barangay One's top-category chip.
      expect(within(section).getAllByText("infrastructure").length).toBeGreaterThanOrEqual(1);
      // A barangay this fixture never mentions (from the old mock's 33-row
      // list) must not still be on screen.
      expect(within(section).queryByText("Brgy. 9")).not.toBeInTheDocument();
    });

    // Fix round 1, item 3: the top-category chip on this table must show the
    // human label too, not the raw category_code — barangayIncidentRows
    // itself only knows the code, so the page must join it the same way the
    // mix panel above does.
    it("the reports-by-barangay panel's top-category chip is joined to its label via listIncidentCategories()", async () => {
      mockListIncidents.mockResolvedValue([
        buildRow({ id: "inc-1", barangay_name: "Barangay One", category_code: "infrastructure" }),
      ]);
      mockListIncidentCategories.mockResolvedValue([
        buildCategory({ code: "infrastructure", label: "Infrastructure" }),
      ]);

      render(<IssueReportsPage />);

      const section = screen.getByText("Reports by barangay").closest("section")!;
      expect(await within(section).findAllByText("Infrastructure")).not.toHaveLength(0);
    });

    // Fix round 1, item 2: barangayIncidentRows must respect the active date
    // preset, not just raw rows. Reuses the same fake-timer pattern the
    // table-agreement regression tests above use. The fixture makes filtered
    // vs. unfiltered visibly different: Barangay Two's only report is in a
    // different month than the active "Month" preset (August).
    it("the reports-by-barangay panel respects the active date preset, not just raw rows", async () => {
      vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
      try {
        mockListIncidents.mockResolvedValue([
          buildRow({
            id: "inc-1",
            reference_number: "IR-2026-000001",
            barangay_name: "Barangay One",
            submitted_at: "2026-08-05T04:00:00Z", // inside August, the active Month preset
          }),
          buildRow({
            id: "inc-2",
            reference_number: "IR-2026-000002",
            barangay_name: "Barangay Two",
            submitted_at: "2026-05-10T04:00:00Z", // a different month, outside the range
          }),
        ]);

        render(<IssueReportsPage />);

        // Scoped to the table itself, not the whole section: the panel's
        // derived hotspot callout below the table also names the top
        // barangay by text, so a section-wide query would match twice. The
        // table element renders synchronously (only its rows are
        // data-dependent), so the wait is on the row text, not the table.
        const table = screen.getByRole("table", { name: "Reports by barangay" });
        expect(await within(table).findByText("Barangay One")).toBeInTheDocument();
        expect(within(table).queryByText("Barangay Two")).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // Task 3.5: page.tsx is now a server-component wrapper whose only job is
  // to export a per-route metadata.title; app/layout.tsx's title template
  // ("%s · Lucena City Admin Portal") interpolates this into the actual
  // <title>. Asserted directly on the exported object, since RTL's render()
  // never mounts a document <head> and so can't observe next/navigation's
  // resolved <title> the way a real Next.js request would.
  it("exports a per-route title", () => {
    expect(metadata.title).toBe("Incident Reports");
  });

  // Admin Portal Fix Plan, Task 4.3: a failed fetch used to be a dead end —
  // a static error message with no way to try again short of a full page
  // reload.
  describe("Task 4.3: retry affordance and last-updated stamp", () => {
    it("clicking Retry re-invokes listIncidents and recovers from a prior failure", async () => {
      const user = userEvent.setup();
      mockListIncidents.mockRejectedValueOnce({ kind: "unknown", message: "boom" });
      mockListIncidents.mockResolvedValueOnce([buildRow({ id: "inc-1", reference_number: "IR-2026-000001" })]);

      render(<IssueReportsPage />);

      expect(await screen.findByText("Unable to load reports: boom")).toBeInTheDocument();
      expect(mockListIncidents).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole("button", { name: "Retry" }));

      expect(await screen.findByText("IR-2026-000001")).toBeInTheDocument();
      // Exactly one additional fetch — not zero (Retry did nothing) and not
      // more than one (Retry somehow fired the effect twice).
      expect(mockListIncidents).toHaveBeenCalledTimes(2);
    });

    it("shows the Updated stamp only once data has actually loaded, never during loading or after an error", async () => {
      let resolveIncidents: (rows: IncidentRow[]) => void = () => {};
      mockListIncidents.mockReturnValue(
        new Promise<IncidentRow[]>((resolve) => {
          resolveIncidents = resolve;
        })
      );

      render(<IssueReportsPage />);

      expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();

      resolveIncidents([buildRow({ id: "inc-1", reference_number: "IR-2026-000001" })]);
      await screen.findByText("IR-2026-000001");

      expect(await screen.findByText(/^Updated .*\(Asia\/Manila\)$/)).toBeInTheDocument();
    });

    it("does not show the Updated stamp when the fetch fails", async () => {
      mockListIncidents.mockRejectedValue({ kind: "unknown", message: "boom" });

      render(<IssueReportsPage />);

      expect(await screen.findByText("Unable to load reports: boom")).toBeInTheDocument();
      expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();
    });
  });
});
