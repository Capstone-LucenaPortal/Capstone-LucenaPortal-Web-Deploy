// src/portals/admin/features/yellow-card/components/yellow-card-page.test.tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import YellowCardPage, { metadata } from "@/app/(admin)/admin/(shell)/yellow-card/page";
import type { YellowCardExportRow, YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that app/(admin)/yellow-card/
// page.tsx imports.
const mockListApplications = vi.fn();
const mockReadApplicationPii = vi.fn();
const mockExportApplications = vi.fn();
const mockListBarangays = vi.fn();
const mockDownloadCsv = vi.fn();

vi.mock("../../../lib/supabase/catalogs", () => ({
  listBarangays: () => mockListBarangays(),
}));

function buildBarangays(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    code: `BGY-${index + 1}`,
    name: `Barangay ${index + 1}`,
    is_poblacion: false,
    sort_order: index + 1,
  }));
}

vi.mock("../lib/yellow-card", () => ({
  listApplications: () => mockListApplications(),
  readApplicationPii: (id: string) => mockReadApplicationPii(id),
  exportApplications: (filter: unknown) => mockExportApplications(filter),
}));

vi.mock("../../../lib/csv", () => ({
  downloadCsv: (filename: string, header: string[], rows: unknown[][]) =>
    mockDownloadCsv(filename, header, rows),
}));

// The page's default preset is "Month", and the table now filters rows
// through filterByDateRange against real wall-clock "now" (most tests below
// never touch the date controls). Every non-Custom preset's "to" bound is
// "today", not the end of the calendar unit, so a hardcoded submitted_at
// would drift out of range the moment the real date moves on, and even a
// fixed mid-month day can be in the future relative to "today" early in the
// month. Using the current instant is the only value guaranteed to sit
// inside every preset's [from, today] bounds on any day this suite runs.
// Tests that care about a specific month (date-range filtering, export
// bounds) pass an explicit `submitted_at` override.
function defaultSubmittedAt(): string {
  return new Date().toISOString();
}

function buildRow(overrides: Partial<YellowCardRow> = {}): YellowCardRow {
  return {
    id: "app-1",
    reference_number: "YC-2026-000001",
    barangay_code: "BGY-1",
    barangay_name: "Barangay One",
    status: "pending",
    submitted_at: defaultSubmittedAt(),
    decided_at: null,
    sla_target_hours: 48,
    sla_elapsed_seconds: 1000,
    sla_breached: false,
    review_cycles: 0,
    ...overrides,
  };
}

// The page has two "↓ Export" buttons — this one for the applications list,
// and another on BarangayCoverageTable — so queries must scope to the
// "Recent applications" section rather than matching on name alone.
function getApplicationsExportButton(): HTMLElement {
  const section = screen.getByText("Recent applications").closest("section")!;
  return within(section).getByRole("button", { name: "↓ Export" });
}

// KPI tile values (e.g. "2") are short enough to collide with other numbers
// on the page (barangay counts, SLA counts, ...), so KPI assertions below
// scope to the specific tile by its label rather than querying the whole
// document.
function getKpiTile(label: string): HTMLElement {
  return screen.getByText(label).closest("div")!;
}

function buildExportRow(overrides: Partial<YellowCardExportRow> = {}): YellowCardExportRow {
  return {
    reference: "YC-2026-EXPORT-999",
    full_name: "Export Only Name",
    barangay_label: "Export Barangay",
    email: "export-only@example.com",
    submitted_on: "2026-05-15",
    status: "approved",
    ...overrides,
  };
}

describe("YellowCardPage", () => {
  beforeEach(() => {
    mockListApplications.mockReset();
    mockReadApplicationPii.mockReset();
    mockExportApplications.mockReset();
    mockListBarangays.mockReset();
    mockListBarangays.mockResolvedValue(buildBarangays(33));
    mockDownloadCsv.mockReset();
  });

  // The Custom date inputs used to be seeded with literals written the day
  // the page was authored ("2026-05-01"/"2026-05-31"), so clicking into them
  // months later offered a window that had nothing to do with the present.
  it("seeds the Custom date inputs from the current Manila month, not authoring-time literals", async () => {
    mockListApplications.mockResolvedValue([]);

    render(<YellowCardPage />);

    const manilaToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    expect(screen.getByLabelText("Custom range end")).toHaveValue(manilaToday);
    expect(screen.getByLabelText("Custom range start")).toHaveValue(`${manilaToday.slice(0, 7)}-01`);
  });

  // The caption used to read a hardcoded "past 48h SLA" — a copy of
  // public_yellow_card_config.processing_time_target_days that would keep
  // claiming 48h after Super Staff changed the real target. It has since
  // been replaced entirely: admin_yellow_card_analytics.sla_breached is only
  // meaningful for DECIDED applications (see applicationMet's doc comment in
  // src/portals/admin/features/sla/lib/sla.ts), so there is no honest "N past SLA" count for the
  // pending backlog until Phase 6 adds a real due date. The caption reads
  // "unavailable" instead of a number, hardcoded or otherwise.
  it("reads SLA status as unavailable for the pending backlog, not a count derived from sla_breached", async () => {
    mockListApplications.mockResolvedValue([
      buildRow({ status: "pending", sla_breached: true, sla_target_hours: 72 }),
    ]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    expect(await screen.findByText("SLA status unavailable for pending applications")).toBeInTheDocument();
    expect(screen.queryByText(/48h SLA/)).not.toBeInTheDocument();
    expect(screen.queryByText(/72h SLA/)).not.toBeInTheDocument();
  });

  // The "Barangays Reached — N / TOTAL" denominator used to be a literal 33
  // pasted into this page (and again into the dashboard). It is real,
  // fetchable reference data: public_barangays. A hardcoded copy silently
  // goes stale the day a barangay is added, split or merged, and there are
  // two copies to miss.
  describe("Barangays Reached denominator comes from public_barangays", () => {
    it("uses the fetched barangay count as the total, not a hardcoded 33", async () => {
      mockListBarangays.mockResolvedValue(buildBarangays(41));
      mockListApplications.mockResolvedValue([
        buildRow({ barangay_name: "Barangay One", status: "approved" }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      expect(await screen.findByText("/ 41")).toBeInTheDocument();
      expect(await screen.findByText("40 with 0 applicants")).toBeInTheDocument();
    });

    it("reports the total as unavailable rather than 0 when the barangay list cannot be read", async () => {
      mockListBarangays.mockRejectedValue({ kind: "unknown", message: "boom" });
      mockListApplications.mockResolvedValue([
        buildRow({ barangay_name: "Barangay One", status: "approved" }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      expect(await screen.findByText("/ —")).toBeInTheDocument();
      // The note must say the list is missing, not assert a count derived
      // from a denominator that was never read. (A bare /with 0 applicants/
      // matcher would also catch the coverage table's static advisory copy
      // further down the page, so this pins the KPI note's exact text.)
      expect(screen.getByText("Barangay list unavailable")).toBeInTheDocument();
      expect(screen.queryByText(/^\d+ with 0 applicants$/)).not.toBeInTheDocument();
    });
  });

  // Filtering/bucketing are rigorously Manila-anchored (src/portals/admin/lib/dates.ts), but
  // the Submitted column used to render via a local toLocaleDateString call
  // with no timeZone option, reading the HOST's local zone instead of
  // Manila — a row the filter correctly places in August could render as if
  // it were July on a host whose local zone lags Manila's UTC+8. This pins
  // the page's end-to-end wiring against the boundary instant that exposes
  // the bug class (2026-07-31T16:30:00Z is Jul 31 in UTC but Aug 1 00:30 in
  // Manila). The explicit "Asia/Manila" zone itself is guarded
  // machine-independently by formatManilaDate's own spy test in
  // src/portals/admin/lib/dates.test.ts, since a host-output-only assertion here
  // would spuriously pass on any machine whose ambient zone already happens
  // to be Asia/Manila.
  it("renders the Submitted date as the Manila calendar day, using the shared formatManilaDate helper", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
    try {
      mockListApplications.mockResolvedValue([
        buildRow({ id: "app-1", reference_number: "YC-2026-000001", submitted_at: "2026-07-31T16:30:00Z" }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      expect(screen.getByText("Aug 1, 2026")).toBeInTheDocument();
      expect(screen.queryByText("Jul 31, 2026")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clicking Review on a row opens the audited PII drill-down for that application's id", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([buildRow({ id: "app-1", reference_number: "YC-2026-000001" })]);
    mockReadApplicationPii.mockResolvedValue({
      reference: "YC-2026-000001",
      first_name: "Juan",
      middle_name: "Santos",
      last_name: "Dela Cruz",
      suffix: "",
      date_of_birth: "1990-01-01",
      gender_code: "male",
      civil_status_code: "single",
      barangay_code: "BGY-1",
      barangay_name: "Barangay One",
      complete_address: "123 Rizal St., Barangay One",
      contact_number: "0917-123-4567",
      email_address: "juan.delacruz@example.com",
      years_of_residency: 10,
      voter_id_number: "1234-5678-9012",
      status: "pending",
      submitted_at: "2026-05-01T00:00:00Z",
    });

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(mockReadApplicationPii).toHaveBeenCalledWith("app-1");
    expect(await screen.findByText("juan.delacruz@example.com")).toBeInTheDocument();
  });

  it("renders a row per returned application, keyed on reference number", async () => {
    mockListApplications.mockResolvedValue([
      buildRow({ id: "app-1", reference_number: "YC-2026-000001" }),
      buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "approved" }),
    ]);

    render(<YellowCardPage />);

    expect(await screen.findByText("YC-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("YC-2026-000002")).toBeInTheDocument();
  });

  // This is the privacy regression guard: admin_yellow_card_analytics carries
  // no applicant name or email by design, so the list must not have a column
  // for either — surfacing identity belongs only to the audited PII drill-down.
  it("renders no Name or Email column — the list carries no applicant PII", async () => {
    mockListApplications.mockResolvedValue([buildRow()]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    const section = screen.getByText("Recent applications").closest("section")!;
    const headers = within(section)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);
    expect(headers).toEqual(["Reference", "Barangay", "Submitted", "Status", "SLA", "Review"]);
    expect(headers).not.toContain("Name");
    expect(headers).not.toContain("Email");
  });

  it("shows an empty state, not an error, when listApplications resolves to []", async () => {
    mockListApplications.mockResolvedValue([]);

    render(<YellowCardPage />);

    expect(await screen.findByText("No applications match this filter.")).toBeInTheDocument();
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unable to load/i)).not.toBeInTheDocument();
  });

  it("shows a permission message when listApplications rejects with kind: permission", async () => {
    mockListApplications.mockRejectedValue({
      kind: "permission",
      message: "caller is not an active Admin",
    });

    render(<YellowCardPage />);

    expect(
      await screen.findByText("You do not have permission to view Yellow Card applications.")
    ).toBeInTheDocument();
    expect(screen.queryByText("No applications match this filter.")).not.toBeInTheDocument();
  });

  it("status tabs filter on the real yellow_card_application_status enum values", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([
      buildRow({ id: "app-1", reference_number: "YC-2026-000001", status: "pending" }),
      buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "approved" }),
      buildRow({ id: "app-3", reference_number: "YC-2026-000003", status: "revision_requested" }),
    ]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    await user.click(screen.getByRole("tab", { name: "Approved" }));
    expect(screen.queryByText("YC-2026-000001")).not.toBeInTheDocument();
    expect(screen.getByText("YC-2026-000002")).toBeInTheDocument();
    expect(screen.queryByText("YC-2026-000003")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Revision Requested" }));
    expect(screen.getByText("YC-2026-000003")).toBeInTheDocument();
    expect(screen.queryByText("YC-2026-000002")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "All" }));
    expect(screen.getByText("YC-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("YC-2026-000002")).toBeInTheDocument();
    expect(screen.getByText("YC-2026-000003")).toBeInTheDocument();
  });

  it("renders the SLA column as a breached/on-time badge for decided applications", async () => {
    mockListApplications.mockResolvedValue([
      buildRow({ id: "app-1", reference_number: "YC-2026-000001", status: "approved", sla_breached: true }),
      buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "rejected", sla_breached: false }),
    ]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    expect(screen.getByText("Breached")).toBeInTheDocument();
    expect(screen.getByText("On time")).toBeInTheDocument();
  });

  // Regression guard for the sla_breached-for-pending fix: sla_breached is
  // not a scoreable value for a still-pending/resubmitted/revision_requested
  // application (see applicationMet's doc comment in src/portals/admin/features/sla/lib/sla.ts), so
  // the badge must not claim "On time" for one just because sla_breached
  // happens to read false — that is exactly the misleading reading the fix
  // removes.
  it("renders the SLA column as Unknown for a pending application, never a false 'On time'", async () => {
    mockListApplications.mockResolvedValue([
      buildRow({ id: "app-1", reference_number: "YC-2026-000001", status: "pending", sla_breached: false }),
    ]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.queryByText("On time")).not.toBeInTheDocument();
    expect(screen.queryByText("Breached")).not.toBeInTheDocument();
  });

  it("switching range presets recomputes the Applications KPI from real fetched rows", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila, a Saturday
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockListApplications.mockResolvedValue([
        // Inside both Month (Aug 1-15) and Week (Aug 10-15, Monday-start).
        buildRow({ id: "app-1", reference_number: "YC-2026-000001", submitted_at: "2026-08-12T04:00:00Z" }),
        // Inside Month only.
        buildRow({ id: "app-2", reference_number: "YC-2026-000002", submitted_at: "2026-08-03T04:00:00Z" }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      expect(within(getKpiTile("Applications")).getByText("2")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Week" }));
      expect(within(getKpiTile("Applications")).getByText("1")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // Regression guard for the hole this task closes: filterRows used to check
  // status only, so the table (and the page beneath its own "↓ Export"
  // button) showed every row regardless of the selected date preset while
  // the CSV export was already date-bounded. The table must now agree with
  // its own export.
  it("selecting a preset that covers only one row's month shows only that row", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockListApplications.mockResolvedValue([
        buildRow({
          id: "app-1",
          reference_number: "YC-2026-000001",
          submitted_at: "2026-08-05T04:00:00Z", // inside August, the active Month preset
        }),
        buildRow({
          id: "app-2",
          reference_number: "YC-2026-000002",
          submitted_at: "2026-05-10T04:00:00Z", // a different month, outside the range
        }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      // Default preset is already "Month"; click it explicitly to exercise
      // the same path a user selecting it would.
      await user.click(screen.getByRole("button", { name: "Month" }));

      expect(screen.getByText("YC-2026-000001")).toBeInTheDocument();
      expect(screen.queryByText("YC-2026-000002")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // "application" reads submitted_at; "completion" reads decided_at. The
  // fixture below is chosen so the two bases visibly disagree: app-1/app-2
  // are still pending (decided_at null) and fall inside the Month window
  // under "application", but drop out entirely under "completion" (a null
  // accessor value is excluded from any active date range); app-3 is the
  // mirror image, decided within the window but submitted months earlier.
  it("changing the date type recalculates the KPIs from the corresponding date field", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockListApplications.mockResolvedValue([
        buildRow({
          id: "app-1",
          reference_number: "YC-2026-000001",
          submitted_at: "2026-08-05T04:00:00Z",
          decided_at: null,
          status: "pending",
        }),
        buildRow({
          id: "app-2",
          reference_number: "YC-2026-000002",
          submitted_at: "2026-08-06T04:00:00Z",
          decided_at: null,
          status: "pending",
        }),
        buildRow({
          id: "app-3",
          reference_number: "YC-2026-000003",
          submitted_at: "2026-07-01T04:00:00Z",
          decided_at: "2026-08-10T04:00:00Z",
          status: "approved",
        }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      expect(within(getKpiTile("Applications")).getByText("2")).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Date type"), "completion");
      expect(within(getKpiTile("Applications")).getByText("1")).toBeInTheDocument();
      expect(within(getKpiTile("Approval Rate")).getByText("100%")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // Issue #24: the date type used to reach the tiles only, so under
  // "Approval/Completion Date" the tiles counted decided applications while
  // the table, Top barangays and the chart still read submitted_at. Same
  // fixture shape as the test above: app-1/app-2 are pending and submitted
  // this month, app-3 was submitted in July and decided this month.
  it("the date type also drives the table, its date column, Top barangays and the monthly chart", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockListApplications.mockResolvedValue([
        buildRow({
          id: "app-1",
          reference_number: "YC-2026-000001",
          barangay_name: "Barangay One",
          submitted_at: "2026-08-05T04:00:00Z",
          decided_at: null,
          status: "pending",
        }),
        buildRow({
          id: "app-2",
          reference_number: "YC-2026-000002",
          barangay_name: "Barangay One",
          submitted_at: "2026-08-06T04:00:00Z",
          decided_at: null,
          status: "pending",
        }),
        buildRow({
          id: "app-3",
          reference_number: "YC-2026-000003",
          barangay_name: "Barangay Three",
          submitted_at: "2026-07-01T04:00:00Z",
          decided_at: "2026-08-10T04:00:00Z",
          status: "approved",
        }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      const recent = screen.getByText("Recent applications").closest("section")!;
      const chart = screen.getByText("Applications by month").closest("section")!;
      const topBarangays = screen.getByText("Top barangays").closest("section")!;

      // Default date type: unchanged from before the fix.
      expect(within(recent).getByRole("columnheader", { name: "Submitted" })).toBeInTheDocument();
      expect(within(recent).queryByText("YC-2026-000003")).not.toBeInTheDocument();
      expect(within(chart).getByText("Last 6 months")).toBeInTheDocument();
      expect(within(chart).getByTitle("Jul: 1")).toBeInTheDocument();
      expect(within(chart).getByTitle("Aug: 2")).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Date type"), "completion");

      expect(within(getKpiTile("Applications")).getByText("1")).toBeInTheDocument();
      expect(within(recent).getByText("YC-2026-000003")).toBeInTheDocument();
      expect(within(recent).queryByText("YC-2026-000001")).not.toBeInTheDocument();
      expect(within(recent).queryByText("YC-2026-000002")).not.toBeInTheDocument();
      expect(within(recent).getByRole("columnheader", { name: "Decided" })).toBeInTheDocument();
      expect(within(recent).queryByRole("columnheader", { name: "Submitted" })).not.toBeInTheDocument();
      expect(within(recent).getByText("Aug 10, 2026")).toBeInTheDocument();

      expect(within(topBarangays).getByText("Barangay Three")).toBeInTheDocument();
      expect(within(topBarangays).queryByText("Barangay One")).not.toBeInTheDocument();

      expect(within(chart).getByText("By decision date · Last 6 months")).toBeInTheDocument();
      expect(within(chart).getByTitle("Aug: 1")).toBeInTheDocument();
      expect(within(chart).queryByTitle("Jul: 1")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("the compare toggle shows and hides the real vs-previous-period delta", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockListApplications.mockResolvedValue([
        // Two applications in the current Month window (Aug 1-15)...
        buildRow({ id: "app-1", reference_number: "YC-2026-000001", submitted_at: "2026-08-05T04:00:00Z" }),
        buildRow({ id: "app-2", reference_number: "YC-2026-000002", submitted_at: "2026-08-06T04:00:00Z" }),
        // ...and one in the immediately preceding 15-day window, so the
        // delta is a real, non-trivial "+100%" rather than an undefined
        // divide-by-zero case.
        buildRow({ id: "app-3", reference_number: "YC-2026-000003", submitted_at: "2026-07-20T04:00:00Z" }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      expect(screen.getByText("+100% vs previous period")).toBeInTheDocument();
      await user.click(screen.getByRole("checkbox", { name: /compare to previous period/i }));
      expect(screen.queryByText("+100% vs previous period")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("picking a custom date range derives the Applications KPI for that exact span", async () => {
    // Pinned so the page's default "Month" preset covers all three fixture
    // rows below (the KPI assertion only starts to discriminate once the
    // Custom range narrows it), the same reason every other test in this
    // file pins "now" for a fixed-month fixture rather than relying on the
    // real current date.
    vi.useFakeTimers().setSystemTime(new Date("2026-05-15T04:00:00Z")); // 2026-05-15 12:00 Manila
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockListApplications.mockResolvedValue([
        buildRow({ id: "app-1", reference_number: "YC-2026-000001", submitted_at: "2026-05-05T04:00:00Z" }),
        buildRow({ id: "app-2", reference_number: "YC-2026-000002", submitted_at: "2026-05-09T04:00:00Z" }),
        // Outside the custom range picked below.
        buildRow({ id: "app-3", reference_number: "YC-2026-000003", submitted_at: "2026-05-15T04:00:00Z" }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      const start = screen.getByLabelText("Custom range start");
      const end = screen.getByLabelText("Custom range end");
      await user.clear(start);
      await user.type(start, "2026-05-01");
      await user.clear(end);
      await user.type(end, "2026-05-10");

      expect(within(getKpiTile("Applications")).getByText("2")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // Regression guard for the hole this task closes: the export used to send
  // { from: null, to: null } whenever the preset was not "Custom" — including
  // the default "Month" preset an admin sees on page load — which silently
  // released every application ever filed instead of the displayed month's
  // worth. The default preset must resolve to real, non-null bounds.
  it("clicking Export with the default preset sends real bounds, not { from: null, to: null }", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([buildRow()]);
    mockExportApplications.mockResolvedValue([]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    // Default state: "All" tab, "Month" preset (not Custom).
    await user.click(getApplicationsExportButton());

    expect(mockExportApplications).toHaveBeenCalledTimes(1);
    const call = mockExportApplications.mock.calls[0][0];
    expect(call).not.toEqual({ status: null, from: null, to: null });
    expect(call.status).toBeNull();
    expect(call.from).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(call.to).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("clicking Export sends the selected status tab and the active custom date range", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([buildRow({ status: "approved" })]);
    mockExportApplications.mockResolvedValue([]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    await user.click(screen.getByRole("tab", { name: "Approved" }));

    const start = screen.getByLabelText("Custom range start");
    const end = screen.getByLabelText("Custom range end");
    await user.clear(start);
    await user.type(start, "2026-05-01");
    await user.clear(end);
    await user.type(end, "2026-05-10");

    await user.click(getApplicationsExportButton());

    expect(mockExportApplications).toHaveBeenCalledWith({
      status: "approved",
      from: "2026-05-01",
      to: "2026-05-10",
    });
  });

  // This is the regression guard for the hole this task closes: the export
  // used to rebuild the CSV from the already-loaded list rows. The list row
  // and the RPC's row below are deliberately distinguishable — a handler that
  // still reads from `rows` instead of the RPC's return value would download
  // the list row's reference, not the export row's.
  it("builds the downloaded CSV from exportApplications' return value, not from the list rows", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([
      buildRow({ id: "app-1", reference_number: "YC-2026-000001" }),
    ]);
    mockExportApplications.mockResolvedValue([
      buildExportRow({
        reference: "YC-2026-EXPORT-999",
        full_name: "Export Only Name",
        barangay_label: "Export Barangay",
        email: "export-only@example.com",
        submitted_on: "2026-05-15",
        status: "approved",
      }),
    ]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    await user.click(getApplicationsExportButton());

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [filename, header, rows] = mockDownloadCsv.mock.calls[0];
    expect(filename).toBe("yellow-card-applications.csv");
    expect(header).toEqual(["Reference", "Name", "Barangay", "Email", "Submitted", "Status"]);
    expect(rows).toEqual([
      [
        "YC-2026-EXPORT-999",
        "Export Only Name",
        "Export Barangay",
        "export-only@example.com",
        "2026-05-15",
        "approved",
      ],
    ]);
    // The list row's reference must never leak into the downloaded content.
    expect(rows.flat()).not.toContain("YC-2026-000001");
  });

  it("a permission failure on export surfaces a message and downloads nothing", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([buildRow()]);
    mockExportApplications.mockRejectedValue({
      kind: "permission",
      message: "caller is not an active Admin",
    });

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    await user.click(getApplicationsExportButton());

    expect(
      await screen.findByText("You do not have permission to export Yellow Card applications.")
    ).toBeInTheDocument();
    expect(mockDownloadCsv).not.toHaveBeenCalled();
  });

  // Security-hardening round: the Custom preset's bounds are raw
  // <input type="date"> strings, and used to be sent to the audited export
  // RPC unvalidated. A reversed range must be refused client-side — no RPC
  // call, no audit row for a release that cannot happen.
  it("refuses to export a reversed custom range instead of calling the RPC", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([buildRow()]);
    mockExportApplications.mockResolvedValue([]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    const start = screen.getByLabelText("Custom range start");
    const end = screen.getByLabelText("Custom range end");
    await user.clear(start);
    await user.type(start, "2026-05-10");
    await user.clear(end);
    await user.type(end, "2026-05-01");

    await user.click(getApplicationsExportButton());

    expect(
      await screen.findByText("The start date must be on or before the end date.")
    ).toBeInTheDocument();
    expect(mockExportApplications).not.toHaveBeenCalled();
    expect(mockDownloadCsv).not.toHaveBeenCalled();
  });

  // Task 10: the chart panels below the KPI tiles used to read mock data,
  // not listApplications(). These pin that they now derive from the
  // data-layer rows the page already fetched,
  // via lib/aggregate.
  describe("chart panels derive from listApplications(), not mock data", () => {
    it("the barangay coverage table and top-barangays panel count real applications, and omit a barangay with none", async () => {
      mockListApplications.mockResolvedValue([
        buildRow({ id: "app-1", reference_number: "YC-2026-000001", barangay_name: "Barangay One", status: "approved" }),
        buildRow({ id: "app-2", reference_number: "YC-2026-000002", barangay_name: "Barangay One", status: "pending" }),
        buildRow({ id: "app-3", reference_number: "YC-2026-000003", barangay_name: "Barangay Two", status: "rejected" }),
      ]);

      render(<YellowCardPage />);

      const coverageSection = screen.getByText("Applicants by barangay").closest("section")!;
      // Waiting on the panel's own content (rather than a row in the table
      // below) is the load signal here, since the table below is separately
      // date-filtered.
      expect(await within(coverageSection).findByText("Barangay One")).toBeInTheDocument();
      expect(within(coverageSection).getByText("Barangay Two")).toBeInTheDocument();
      // A barangay from the old mock's 33-row list that no fetched row
      // mentions must not still be on screen.
      expect(within(coverageSection).queryByText("Brgy. 9")).not.toBeInTheDocument();

      const topBarangaysSection = screen.getByText("Top barangays").closest("section")!;
      expect(within(topBarangaysSection).getByText("Barangay One")).toBeInTheDocument();
      expect(within(topBarangaysSection).getByText("2")).toBeInTheDocument();
    });

    it("the applications-by-month panel buckets rows into their Manila submission month", async () => {
      mockListApplications.mockResolvedValue([
        buildRow({ id: "app-1", submitted_at: "2026-03-10T04:00:00Z" }),
      ]);

      render(<YellowCardPage />);

      const section = screen.getByText("Applications by month").closest("section")!;
      // The chart derives from the full fetched `rows`, not the date-filtered
      // table below, so a March submission still shows up here even though
      // the page's default "Month" preset would filter it out of the table.
      expect(await within(section).findByTitle("Mar: 1")).toBeInTheDocument();
      // The old mock trend's April total must not still be on screen.
      expect(within(section).queryByTitle("Apr: 856")).not.toBeInTheDocument();
    });

    // Fix round 1, item 2: barangayCoverage (and therefore the top-barangays
    // panel derived from it) must read the status-tab-filtered view, not the
    // raw fetched rows, or the panel silently disagrees with the table below
    // it. The fixture is built so filtered vs. unfiltered are visibly
    // different: Barangay Two's only application is rejected, so switching
    // to the "Approved" tab must drop it from the panel entirely.
    it("the barangay coverage panel respects the active status tab, not just raw rows", async () => {
      const user = userEvent.setup();
      mockListApplications.mockResolvedValue([
        buildRow({ id: "app-1", reference_number: "YC-2026-000001", barangay_name: "Barangay One", status: "approved" }),
        buildRow({ id: "app-2", reference_number: "YC-2026-000002", barangay_name: "Barangay Two", status: "rejected" }),
      ]);

      render(<YellowCardPage />);
      const coverageSection = screen.getByText("Applicants by barangay").closest("section")!;
      expect(await within(coverageSection).findByText("Barangay One")).toBeInTheDocument();
      expect(within(coverageSection).getByText("Barangay Two")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "Approved" }));

      expect(within(coverageSection).getByText("Barangay One")).toBeInTheDocument();
      expect(within(coverageSection).queryByText("Barangay Two")).not.toBeInTheDocument();
    });
  });

  // Task 3.5: page.tsx is now a server-component wrapper whose only job is
  // to export a per-route metadata.title; app/layout.tsx's title template
  // ("%s · Lucena City Admin Portal") interpolates this into the actual
  // <title>. Asserted directly on the exported object, since RTL's render()
  // never mounts a document <head> and so can't observe next/navigation's
  // resolved <title> the way a real Next.js request would.
  it("exports a per-route title", () => {
    expect(metadata.title).toBe("Yellow Card Applications");
  });

  // Admin Portal Fix Plan, Task 4.3: a failed fetch used to be a dead end —
  // a static error message with no way to try again short of a full page
  // reload.
  describe("Task 4.3: retry affordance and last-updated stamp", () => {
    it("clicking Retry re-invokes listApplications and recovers from a prior failure", async () => {
      const user = userEvent.setup();
      mockListApplications.mockRejectedValueOnce({ kind: "unknown", message: "boom" });
      mockListApplications.mockResolvedValueOnce([buildRow({ id: "app-1", reference_number: "YC-2026-000001" })]);

      render(<YellowCardPage />);

      expect(await screen.findByText("Unable to load applications: boom")).toBeInTheDocument();
      expect(mockListApplications).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole("button", { name: "Retry" }));

      expect(await screen.findByText("YC-2026-000001")).toBeInTheDocument();
      // Exactly one additional fetch — not zero (Retry did nothing) and not
      // more than one (Retry somehow fired the effect twice).
      expect(mockListApplications).toHaveBeenCalledTimes(2);
    });

    it("shows the Updated stamp only once data has actually loaded, never during loading or after an error", async () => {
      let resolveApplications: (rows: YellowCardRow[]) => void = () => {};
      mockListApplications.mockReturnValue(
        new Promise<YellowCardRow[]>((resolve) => {
          resolveApplications = resolve;
        })
      );

      render(<YellowCardPage />);

      expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();

      resolveApplications([buildRow({ id: "app-1", reference_number: "YC-2026-000001" })]);
      await screen.findByText("YC-2026-000001");

      expect(await screen.findByText(/^Updated .*\(Asia\/Manila\)$/)).toBeInTheDocument();
    });

    // Regression guard for a review finding on this task: Skeleton is
    // aria-hidden (a purely visual placeholder), so replacing the old plain
    // "Loading applications…" DOM text with Skeleton blocks left screen
    // reader users with zero signal that the page was loading. A
    // role="status" live region must announce it instead, and must
    // disappear once real content has loaded (a stale "loading"
    // announcement would be its own kind of lie).
    it("announces loading to assistive tech via a role=status live region, which clears once loaded", async () => {
      let resolveApplications: (rows: YellowCardRow[]) => void = () => {};
      mockListApplications.mockReturnValue(
        new Promise<YellowCardRow[]>((resolve) => {
          resolveApplications = resolve;
        })
      );

      render(<YellowCardPage />);

      expect(screen.getByRole("status")).toHaveTextContent("Loading applications…");

      resolveApplications([buildRow({ id: "app-1", reference_number: "YC-2026-000001" })]);
      await screen.findByText("YC-2026-000001");

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("does not show the Updated stamp when the fetch fails", async () => {
      mockListApplications.mockRejectedValue({ kind: "unknown", message: "boom" });

      render(<YellowCardPage />);

      expect(await screen.findByText("Unable to load applications: boom")).toBeInTheDocument();
      expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();
    });
  });
});
