// src/portals/admin/features/yellow-card/components/yellow-card-page.test.tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import YellowCardPage, { metadata } from "@/app/(admin)/admin/(shell)/yellow-card/page";
import type { ExportFilter, YellowCardExportRow, YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
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
const mockGetYellowCardConfig = vi.fn();
const mockDownloadCsv = vi.fn();

vi.mock("../../../lib/supabase/catalogs", () => ({
  listBarangays: () => mockListBarangays(),
  getYellowCardConfig: () => mockGetYellowCardConfig(),
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

// The page reads SLA Reports' filter from its URL (#127). Each test sets the
// query string it arrives with; most arrive with none.
let mockSearchParams = new URLSearchParams();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ replace: mockReplace }),
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
    // 3 working days × the database's 9-hour working day (l70a D5): the
    // target every application filed since l70a carries at the default config.
    sla_target_hours: 27,
    sla_elapsed_seconds: 1000,
    sla_breached: false,
    review_cycles: 0,
    due_at: null,
    deadline_state: null,
    is_correction: false,
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
    is_correction: false,
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
    mockGetYellowCardConfig.mockReset();
    mockGetYellowCardConfig.mockResolvedValue({ processing_time_target_days: 3 });
    mockDownloadCsv.mockReset();
    mockSearchParams = new URLSearchParams();
    mockReplace.mockReset();
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

  // Past due and at risk are the database's deadline_state, the one the Staff
  // queue shows (l80, l112), never sla_breached, which a pending row never
  // sets (#124, metrics sheet Y4).
  it("Pending Review's note says how many are past due and at risk, from the database's deadline state", async () => {
    mockListApplications.mockResolvedValue([
      buildRow({ id: "app-1", reference_number: "YC-2026-000001", status: "pending", deadline_state: "overdue" }),
      buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "resubmitted", deadline_state: "overdue" }),
      buildRow({ id: "app-3", reference_number: "YC-2026-000003", status: "pending", deadline_state: "at_risk" }),
      buildRow({ id: "app-4", reference_number: "YC-2026-000004", status: "pending", deadline_state: "on_track", sla_breached: true }),
      // Waiting on the applicant: not in Pending Review, so not past due either.
      buildRow({ id: "app-5", reference_number: "YC-2026-000005", status: "revision_requested", deadline_state: "overdue" }),
    ]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    const tile = screen.getByText("Pending Review", { selector: "p" }).closest("div")!;
    expect(within(tile).getByText("4")).toBeInTheDocument();
    expect(within(tile).getByText("2 past due · 1 at risk")).toBeInTheDocument();
    expect(within(tile).getByText("Past due = past 3-working-day target")).toBeInTheDocument();
    expect(screen.queryByText(/27h/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SLA status unavailable/)).not.toBeInTheDocument();
  });

  // Pending Review is the Yellow Card part of the Dashboard's Service backlog:
  // work waiting on the review desk (#116, metrics sheet Y4).
  it("Pending Review counts pending and resubmitted applications, not one in revision", async () => {
    mockListApplications.mockResolvedValue([
      buildRow({ id: "app-1", reference_number: "YC-2026-000001", status: "pending" }),
      buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "resubmitted" }),
      buildRow({ id: "app-3", reference_number: "YC-2026-000003", status: "revision_requested" }),
      buildRow({ id: "app-4", reference_number: "YC-2026-000004", status: "approved" }),
    ]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    // "Pending Review" is also a status tab and a row badge; the tile's label is the <p>.
    const tile = screen.getByText("Pending Review", { selector: "p" }).closest("div")!;
    expect(within(tile).getByText("2")).toBeInTheDocument();
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

  // A Correction still counts as an application (#177); the table only marks
  // it, next to its reference, where the Staff queue puts its marker.
  it("marks a Correction's row and leaves an ordinary row unmarked", async () => {
    mockListApplications.mockResolvedValue([
      buildRow({ id: "app-1", reference_number: "YC-2026-000001", is_correction: true }),
      buildRow({ id: "app-2", reference_number: "YC-2026-000002", is_correction: false }),
    ]);

    render(<YellowCardPage />);

    const correctionRow = (await screen.findByText("YC-2026-000001")).closest("tr")!;
    const ordinaryRow = screen.getByText("YC-2026-000002").closest("tr")!;
    expect(within(correctionRow).getByText("Correction")).toBeInTheDocument();
    expect(within(ordinaryRow).queryByText("Correction")).not.toBeInTheDocument();
  });

  it("a Correction counts as an application in the Applications tile", async () => {
    mockListApplications.mockResolvedValue([
      buildRow({ id: "app-1", reference_number: "YC-2026-000001", is_correction: true }),
      buildRow({ id: "app-2", reference_number: "YC-2026-000002", is_correction: false }),
    ]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    expect(within(getKpiTile("Applications")).getByText("2")).toBeInTheDocument();
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

  // #115: Approval Rate is an outcome mix with no good direction (sheet Y2),
  // so even a 100-point swing stays grey with no better/worse word.
  it("Approval Rate's delta stays neutral: grey, with no 'better' or 'worse'", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-15T12:00:00+08:00"));
    try {
      mockListApplications.mockResolvedValue([
        buildRow({ id: "app-1", reference_number: "YC-2026-000001", status: "approved", submitted_at: "2026-08-05T04:00:00Z", decided_at: "2026-08-06T04:00:00Z" }),
        buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "rejected", submitted_at: "2026-07-20T04:00:00Z", decided_at: "2026-07-21T04:00:00Z" }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      const tile = getKpiTile("Approval Rate");
      const note = within(tile).getByText("+100 pts vs previous period");
      expect(note).not.toHaveClass("text-green-700");
      expect(note).not.toHaveClass("text-red-700");
      expect(within(tile).queryByText(/better|worse/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // #123, sheet Y2: a high approval rate is not success, so the tile says
  // what it is on screen.
  it("Approval Rate is captioned as an outcome mix, not a target", async () => {
    mockListApplications.mockResolvedValue([buildRow({ status: "approved", decided_at: defaultSubmittedAt() })]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    expect(within(getKpiTile("Approval Rate")).getByText("Outcome mix · not a target")).toBeInTheDocument();
  });

  // #123, sheet Y7. The shared scoring rules (#119): approved and rejected
  // applications are scored, a withdrawal is not, however long it sat.
  describe("Decided on time", () => {
    it("scores approved and rejected applications against the 3-working-day target and leaves a withdrawal out", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-08-15T12:00:00+08:00"));
      try {
        mockListApplications.mockResolvedValue([
          buildRow({ id: "app-1", reference_number: "YC-2026-000001", status: "approved", submitted_at: "2026-08-03T01:00:00Z", decided_at: "2026-08-04T01:00:00Z", sla_target_hours: 27, sla_breached: false }),
          buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "rejected", submitted_at: "2026-08-03T02:00:00Z", decided_at: "2026-08-05T02:00:00Z", sla_target_hours: 27, sla_breached: false }),
          buildRow({ id: "app-3", reference_number: "YC-2026-000003", status: "approved", submitted_at: "2026-08-03T03:00:00Z", decided_at: "2026-08-12T03:00:00Z", sla_target_hours: 27, sla_breached: true }),
          // Sat for weeks before the resident withdrew it: not the city's to score.
          buildRow({ id: "app-4", reference_number: "YC-2026-000004", status: "withdrawn", submitted_at: "2026-08-01T03:00:00Z", decided_at: "2026-08-14T03:00:00Z", sla_target_hours: 27, sla_elapsed_seconds: 900_000, sla_breached: true }),
          buildRow({ id: "app-5", reference_number: "YC-2026-000005", status: "pending", submitted_at: "2026-08-13T03:00:00Z", sla_target_hours: 27 }),
        ]);

        render(<YellowCardPage />);
        await screen.findByText("YC-2026-000001");

        const tile = getKpiTile("Decided on time");
        expect(within(tile).getByText("66.7%")).toBeInTheDocument();
        expect(
          within(tile).getByText("2 of 3 within the 3-working-day target · 18.3 pts below 85% project target")
        ).toBeInTheDocument();
        expect(screen.queryByText(/27h/)).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("follows the page's date type", async () => {
      vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
      try {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        mockListApplications.mockResolvedValue([
          buildRow({ id: "app-1", reference_number: "YC-2026-000001", status: "approved", submitted_at: "2026-08-03T01:00:00Z", decided_at: "2026-08-04T01:00:00Z", sla_breached: false }),
          // Filed in July, decided late in August.
          buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "rejected", submitted_at: "2026-07-28T01:00:00Z", decided_at: "2026-08-06T01:00:00Z", sla_breached: true }),
        ]);

        render(<YellowCardPage />);
        await screen.findByText("YC-2026-000001");

        expect(within(getKpiTile("Decided on time")).getByText("100%")).toBeInTheDocument();

        await user.selectOptions(screen.getByLabelText("Date type"), "completion");
        expect(within(getKpiTile("Decided on time")).getByText("50%")).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("its delta says better when more were decided on time than in the previous period", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-08-15T12:00:00+08:00"));
      try {
        mockListApplications.mockResolvedValue([
          buildRow({ id: "app-1", reference_number: "YC-2026-000001", status: "approved", submitted_at: "2026-08-05T04:00:00Z", decided_at: "2026-08-06T04:00:00Z", sla_breached: false }),
          buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "approved", submitted_at: "2026-07-20T04:00:00Z", decided_at: "2026-07-28T04:00:00Z", sla_breached: true }),
        ]);

        render(<YellowCardPage />);
        await screen.findByText("YC-2026-000001");

        const note = within(getKpiTile("Decided on time")).getByText("+100 pts vs previous period · better");
        expect(note).toHaveClass("text-green-700");
      } finally {
        vi.useRealTimers();
      }
    });

    it("reads a dash, not 0%, when nothing was decided in range", async () => {
      mockListApplications.mockResolvedValue([buildRow({ status: "pending" })]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      const tile = getKpiTile("Decided on time");
      expect(within(tile).getByText("—")).toBeInTheDocument();
      expect(within(tile).getByText("Nothing decided in range")).toBeInTheDocument();
    });
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
      dateBasis: "application",
    });
  });

  // Issue #24 / DB#19: under "Approval/Completion Date" the table lists the
  // applications DECIDED in the range, so the Export must release that same
  // set, not the ones submitted in it. The mock stands in for the RPC's
  // basis filter: it hands back the decided application only when asked for
  // the "completion" basis, so a page that dropped the date type would
  // download the pending one instead.
  it("under Approval/Completion Date, Export sends the date type and downloads the decided set", async () => {
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
          id: "app-3",
          reference_number: "YC-2026-000003",
          submitted_at: "2026-07-01T04:00:00Z",
          decided_at: "2026-08-10T04:00:00Z",
          status: "approved",
        }),
      ]);
      mockExportApplications.mockImplementation(async (filter: ExportFilter) =>
        filter.dateBasis === "completion"
          ? [buildExportRow({ reference: "YC-2026-000003", submitted_on: "2026-07-01", status: "approved" })]
          : [buildExportRow({ reference: "YC-2026-000001", submitted_on: "2026-08-05", status: "pending" })]
      );

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      await user.selectOptions(screen.getByLabelText("Date type"), "completion");
      await user.click(getApplicationsExportButton());

      expect(mockExportApplications).toHaveBeenCalledWith({
        status: null,
        from: "2026-08-01",
        to: "2026-08-15",
        dateBasis: "completion",
      });
      const [, , rows] = mockDownloadCsv.mock.calls[0];
      expect(rows.map((row: unknown[]) => row[0])).toEqual(["YC-2026-000003"]);
    } finally {
      vi.useRealTimers();
    }
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
    expect(header).toEqual(["Reference", "Name", "Barangay", "Email", "Submitted", "Status", "Type"]);
    expect(rows).toEqual([
      [
        "YC-2026-EXPORT-999",
        "Export Only Name",
        "Export Barangay",
        "export-only@example.com",
        "2026-05-15",
        "approved",
        "Application",
      ],
    ]);
    // The list row's reference must never leak into the downloaded content.
    expect(rows.flat()).not.toContain("YC-2026-000001");
  });

  // #177: the export's last column says whether each row is a Correction,
  // read from the export row itself; the first six columns don't move.
  it("the CSV's last column, Type, reads Correction or Application per row", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([buildRow()]);
    mockExportApplications.mockResolvedValue([
      buildExportRow({ reference: "YC-2026-000010", is_correction: true }),
      buildExportRow({ reference: "YC-2026-000011", is_correction: false }),
    ]);

    render(<YellowCardPage />);
    await screen.findByText("YC-2026-000001");

    await user.click(getApplicationsExportButton());

    const [, header, rows] = mockDownloadCsv.mock.calls[0];
    expect(header.at(-1)).toBe("Type");
    expect(rows.map((row: unknown[]) => [row[0], row.at(-1)])).toEqual([
      ["YC-2026-000010", "Correction"],
      ["YC-2026-000011", "Application"],
    ]);
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
  // #127: SLA Reports' Finished late and Past due now link here, and the
  // Recent applications table narrows to exactly the requests they counted.
  describe("Arriving from SLA Reports", () => {
    function tableReferences(): string[] {
      const section = screen.getByText("Recent applications").closest("section")!;
      return within(section)
        .queryAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[0].textContent ?? "");
    }

    const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

    function juneApplications(): YellowCardRow[] {
      return [
        buildRow({ id: "late-approved", reference_number: "YC-LATE-APPROVED", status: "approved", submitted_at: "2026-06-05T02:00:00Z", decided_at: "2026-06-12T02:00:00Z", sla_breached: true }),
        buildRow({ id: "late-rejected", reference_number: "YC-LATE-REJECTED", status: "rejected", submitted_at: "2026-06-20T02:00:00Z", decided_at: "2026-06-29T02:00:00Z", sla_breached: true }),
        buildRow({ id: "on-time", reference_number: "YC-ON-TIME", status: "approved", submitted_at: "2026-06-10T02:00:00Z", decided_at: "2026-06-11T02:00:00Z", sla_breached: false }),
        // The resident withdrew it: never scored, so never finished late.
        buildRow({ id: "withdrawn", reference_number: "YC-WITHDRAWN", status: "withdrawn", submitted_at: "2026-06-10T02:00:00Z", decided_at: "2026-06-25T02:00:00Z", sla_breached: true }),
        buildRow({ id: "pending", reference_number: "YC-PENDING", status: "pending", submitted_at: "2026-06-15T02:00:00Z" }),
        // Late, but filed after the range.
        buildRow({ id: "late-july", reference_number: "YC-LATE-JULY", status: "approved", submitted_at: "2026-07-05T02:00:00Z", decided_at: "2026-07-14T02:00:00Z", sla_breached: true }),
      ];
    }

    it("Finished late narrows the table to the late applications of the linked range, and the filter clears", async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams("sla=late&from=2026-06-01&to=2026-06-30&basis=application");
      mockListApplications.mockResolvedValue(juneApplications());

      render(<YellowCardPage />);

      await screen.findByText("YC-LATE-APPROVED");
      expect(screen.getByLabelText("Custom range start")).toHaveValue("2026-06-01");
      expect(screen.getByLabelText("Custom range end")).toHaveValue("2026-06-30");
      expect(tableReferences()).toEqual(["YC-LATE-APPROVED", "YC-LATE-REJECTED"]);
      expect(screen.getByText("Showing only applications that finished late in the selected range")).toBeInTheDocument();
      // Only the table narrows: the tiles still describe every application in range.
      expect(within(getKpiTile("Applications")).getByText("5")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear filter" }));

      expect(screen.queryByText(/^Showing only applications/)).not.toBeInTheDocument();
      expect(tableReferences()).toHaveLength(5);
      expect(mockReplace).toHaveBeenCalledWith("/admin/yellow-card", { scroll: false });
    });

    it("Finished late on the decision date reads the decided date, as SLA Reports' Resolution Date does", async () => {
      mockSearchParams = new URLSearchParams("sla=late&from=2026-06-01&to=2026-06-30&basis=completion");
      mockListApplications.mockResolvedValue([
        buildRow({ id: "filed-may", reference_number: "YC-FILED-MAY", status: "approved", submitted_at: "2026-05-28T02:00:00Z", decided_at: "2026-06-04T02:00:00Z", sla_breached: true }),
        buildRow({ id: "decided-july", reference_number: "YC-DECIDED-JULY", status: "approved", submitted_at: "2026-06-26T02:00:00Z", decided_at: "2026-07-03T02:00:00Z", sla_breached: true }),
      ]);

      render(<YellowCardPage />);

      await screen.findByText("YC-FILED-MAY");
      expect(tableReferences()).toEqual(["YC-FILED-MAY"]);
      expect(screen.getByLabelText("Date type")).toHaveValue("completion");
    });

    // The clock is pinned mid-June so a February row is in Annual but not in
    // the default Month; only Date is faked, so findBy keeps its real timers.
    it("Finished late on a named preset opens that preset", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-06-15T12:00:00+08:00"));
      try {
        mockSearchParams = new URLSearchParams("sla=late&range=Annual&basis=application");
        mockListApplications.mockResolvedValue([
          buildRow({ id: "late-february", reference_number: "YC-LATE-FEBRUARY", status: "approved", submitted_at: "2026-02-10T02:00:00Z", decided_at: "2026-02-18T02:00:00Z", sla_breached: true }),
          buildRow({ id: "on-time-june", reference_number: "YC-ON-TIME-JUNE", status: "approved", submitted_at: "2026-06-10T02:00:00Z", decided_at: "2026-06-11T02:00:00Z", sla_breached: false }),
          buildRow({ id: "late-last-year", reference_number: "YC-LATE-LAST-YEAR", status: "approved", submitted_at: "2025-11-10T02:00:00Z", decided_at: "2025-11-18T02:00:00Z", sla_breached: true }),
        ]);

        render(<YellowCardPage />);

        await screen.findByText("YC-LATE-FEBRUARY");
        expect(tableReferences()).toEqual(["YC-LATE-FEBRUARY"]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("Past due now lists the overdue waiting applications, whatever the date range", async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams("sla=past-due");
      mockListApplications.mockResolvedValue([
        buildRow({ id: "pending-overdue", reference_number: "YC-PENDING-OVERDUE", status: "pending", submitted_at: daysAgoIso(200), deadline_state: "overdue" }),
        buildRow({ id: "resubmitted-overdue", reference_number: "YC-RESUBMITTED-OVERDUE", status: "resubmitted", submitted_at: daysAgoIso(200), deadline_state: "overdue" }),
        buildRow({ id: "pending-at-risk", reference_number: "YC-PENDING-AT-RISK", status: "pending", deadline_state: "at_risk" }),
        // Waiting on the applicant, not the city.
        buildRow({ id: "revision-overdue", reference_number: "YC-REVISION-OVERDUE", status: "revision_requested", deadline_state: "overdue" }),
        buildRow({ id: "approved-late", reference_number: "YC-APPROVED-LATE", status: "approved", decided_at: defaultSubmittedAt(), sla_breached: true }),
      ]);

      render(<YellowCardPage />);

      await screen.findByText("YC-PENDING-OVERDUE");
      expect(tableReferences()).toEqual(["YC-PENDING-OVERDUE", "YC-RESUBMITTED-OVERDUE"]);
      expect(screen.getByText("Showing only applications past due now, whatever the date range")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Today" }));
      expect(tableReferences()).toEqual(["YC-PENDING-OVERDUE", "YC-RESUBMITTED-OVERDUE"]);
    });

    // The audited export RPC can't narrow to the filter, so a CSV taken now
    // would hold every application in range, not the ones on screen (#128).
    it("Export is off while the filter is on, and comes back when it clears", async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams("sla=late&from=2026-06-01&to=2026-06-30&basis=application");
      mockListApplications.mockResolvedValue(juneApplications());
      mockExportApplications.mockResolvedValue([]);

      render(<YellowCardPage />);

      await screen.findByText("YC-LATE-APPROVED");
      const exportButton = getApplicationsExportButton();
      expect(exportButton).toBeDisabled();
      expect(exportButton).toHaveAccessibleDescription(
        "Export can't narrow to this filter. Clear it to export every application in the range."
      );
      await user.click(exportButton);
      expect(mockExportApplications).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Clear filter" }));

      expect(getApplicationsExportButton()).toBeEnabled();
      expect(screen.queryByText(/^Export can't narrow/)).not.toBeInTheDocument();
      await user.click(getApplicationsExportButton());
      expect(mockExportApplications).toHaveBeenCalledTimes(1);
    });

    // #131: the address is the only source of the filter. The page doesn't
    // remount when only the query string changes (the sidebar link, Back,
    // Forward), so each test changes the search params and re-renders.
    describe("the filter follows the address", () => {
      it("goes when the sidebar link opens the plain page, and comes back with Back", async () => {
        mockSearchParams = new URLSearchParams("sla=past-due");
        mockListApplications.mockResolvedValue([
          buildRow({ id: "pending-overdue", reference_number: "YC-PENDING-OVERDUE", status: "pending", deadline_state: "overdue" }),
          buildRow({ id: "pending-in-time", reference_number: "YC-PENDING-IN-TIME", status: "pending", deadline_state: null }),
        ]);

        const { rerender } = render(<YellowCardPage />);
        await screen.findByText("YC-PENDING-OVERDUE");
        expect(tableReferences()).toEqual(["YC-PENDING-OVERDUE"]);

        // The sidebar's plain Yellow Card link.
        mockSearchParams = new URLSearchParams();
        rerender(<YellowCardPage />);

        await screen.findByText("YC-PENDING-IN-TIME");
        expect(screen.queryByText(/^Showing only applications/)).not.toBeInTheDocument();
        expect(tableReferences()).toEqual(["YC-PENDING-OVERDUE", "YC-PENDING-IN-TIME"]);
        expect(getApplicationsExportButton()).toBeEnabled();

        // Back.
        mockSearchParams = new URLSearchParams("sla=past-due");
        rerender(<YellowCardPage />);

        expect(await screen.findByText("Showing only applications past due now, whatever the date range")).toBeInTheDocument();
        await waitFor(() => expect(tableReferences()).toEqual(["YC-PENDING-OVERDUE"]));
        expect(getApplicationsExportButton()).toBeDisabled();

        // Forward.
        mockSearchParams = new URLSearchParams();
        rerender(<YellowCardPage />);

        await screen.findByText("YC-PENDING-IN-TIME");
        expect(screen.queryByText(/^Showing only applications/)).not.toBeInTheDocument();
        expect(getApplicationsExportButton()).toBeEnabled();
      });

      // Pinned mid-June: an application decided in April is in the Quarter by
      // its decision date, but filed in March, outside it by its filing date.
      it("brings back the late filter's range and date type with Back", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-06-15T12:00:00+08:00"));
        try {
          mockSearchParams = new URLSearchParams("sla=late&range=Quarter&basis=completion");
          mockListApplications.mockResolvedValue([
            buildRow({ id: "late-april", reference_number: "YC-LATE-APRIL", status: "approved", submitted_at: "2026-03-30T02:00:00Z", decided_at: "2026-04-08T02:00:00Z", sla_breached: true }),
            buildRow({ id: "june", reference_number: "YC-JUNE", status: "pending", submitted_at: "2026-06-10T02:00:00Z" }),
          ]);

          const { rerender } = render(<YellowCardPage />);
          await screen.findByText("YC-LATE-APRIL");
          expect(tableReferences()).toEqual(["YC-LATE-APRIL"]);

          mockSearchParams = new URLSearchParams();
          rerender(<YellowCardPage />);

          // The plain page: this month, on the filing date.
          await screen.findByText("YC-JUNE");
          expect(tableReferences()).toEqual(["YC-JUNE"]);
          expect(screen.getByLabelText("Date type")).toHaveValue("application");

          mockSearchParams = new URLSearchParams("sla=late&range=Quarter&basis=completion");
          rerender(<YellowCardPage />);

          await screen.findByText("YC-LATE-APRIL");
          expect(tableReferences()).toEqual(["YC-LATE-APRIL"]);
          expect(screen.getByLabelText("Date type")).toHaveValue("completion");
          expect(screen.getByText("Showing only applications that finished late in the selected range")).toBeInTheDocument();
        } finally {
          vi.useRealTimers();
        }
      });

      // Clear drops only the filter: the range and date type the link set stay,
      // and the clean address Clear leads to doesn't reset them.
      it("Clear leaves a clean address and keeps the range", async () => {
        const user = userEvent.setup();
        mockSearchParams = new URLSearchParams("sla=late&from=2026-06-01&to=2026-06-30&basis=application");
        mockListApplications.mockResolvedValue(juneApplications());

        const { rerender } = render(<YellowCardPage />);
        await screen.findByText("YC-LATE-APPROVED");

        await user.click(screen.getByRole("button", { name: "Clear filter" }));
        expect(mockReplace).toHaveBeenCalledWith("/admin/yellow-card", { scroll: false });
        mockSearchParams = new URLSearchParams();
        rerender(<YellowCardPage />);

        expect(screen.queryByText(/^Showing only applications/)).not.toBeInTheDocument();
        expect(tableReferences()).toHaveLength(5);
        expect(screen.getByLabelText("Custom range start")).toHaveValue("2026-06-01");
        expect(mockListApplications).toHaveBeenCalledTimes(1);

        // Back to the filtered address, should the browser still hold it.
        mockSearchParams = new URLSearchParams("sla=late&from=2026-06-01&to=2026-06-30&basis=application");
        rerender(<YellowCardPage />);

        expect(await screen.findByText("Showing only applications that finished late in the selected range")).toBeInTheDocument();
        await waitFor(() => expect(tableReferences()).toEqual(["YC-LATE-APPROVED", "YC-LATE-REJECTED"]));
      });
    });

    it("an unknown filter is ignored", async () => {
      mockSearchParams = new URLSearchParams("sla=everything");
      mockListApplications.mockResolvedValue([buildRow({ id: "app-1", reference_number: "YC-2026-000001" })]);

      render(<YellowCardPage />);

      await screen.findByText("YC-2026-000001");
      expect(screen.queryByText(/^Showing only applications/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Clear filter" })).not.toBeInTheDocument();
    });
  });

  // #132: the captions name the configured working-day target only when every
  // row the figure counts was scored against it; otherwise "the target".
  describe("the target the captions name", () => {
    function decidedRow(overrides: Partial<YellowCardRow>): YellowCardRow {
      return buildRow({ status: "approved", decided_at: defaultSubmittedAt(), ...overrides });
    }

    it("names the configured days when every counted row carries them", async () => {
      mockGetYellowCardConfig.mockResolvedValue({ processing_time_target_days: 2 });
      mockListApplications.mockResolvedValue([
        decidedRow({ id: "app-1", reference_number: "YC-2026-000001", sla_target_hours: 18 }),
        buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "pending", sla_target_hours: 18 }),
      ]);

      render(<YellowCardPage />);

      expect(
        await within(getKpiTile("Decided on time")).findByText(/^1 of 1 within the 2-working-day target · /)
      ).toBeInTheDocument();
      const pending = screen.getByText("Pending Review", { selector: "p" }).closest("div")!;
      expect(within(pending).getByText("Past due = past 2-working-day target")).toBeInTheDocument();
      expect(screen.queryByText(/\d+h/)).not.toBeInTheDocument();
    });

    it("Decided on time drops the number when its rows mix the current and the legacy 48-hour target", async () => {
      mockListApplications.mockResolvedValue([
        decidedRow({ id: "app-1", reference_number: "YC-2026-000001", sla_target_hours: 27 }),
        decidedRow({ id: "app-2", reference_number: "YC-2026-000002", sla_target_hours: 48 }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      const tile = getKpiTile("Decided on time");
      expect(within(tile).getByText(/^2 of 2 within the target · /)).toBeInTheDocument();
      expect(within(tile).queryByText(/working-day/)).not.toBeInTheDocument();
      // The backlog is empty, and the config was read: new filings get 3 days.
      const pending = screen.getByText("Pending Review", { selector: "p" }).closest("div")!;
      expect(within(pending).getByText("Past due = past 3-working-day target")).toBeInTheDocument();
    });

    it("Pending Review drops the number when the target changed and the backlog was filed under the old one", async () => {
      mockGetYellowCardConfig.mockResolvedValue({ processing_time_target_days: 2 });
      mockListApplications.mockResolvedValue([
        buildRow({ id: "app-1", reference_number: "YC-2026-000001", status: "pending", sla_target_hours: 27 }),
        buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "resubmitted", sla_target_hours: 27 }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      const pending = screen.getByText("Pending Review", { selector: "p" }).closest("div")!;
      expect(within(pending).getByText("Past due = past target")).toBeInTheDocument();
    });

    it.each([
      ["errors", () => mockGetYellowCardConfig.mockRejectedValue({ kind: "unknown", message: "boom" })],
      ["has no row", () => mockGetYellowCardConfig.mockResolvedValue(null)],
    ])("when the config view %s, both captions drop the number and the rest of the page still renders", async (_case, arrange) => {
      arrange();
      mockListApplications.mockResolvedValue([
        decidedRow({ id: "app-1", reference_number: "YC-2026-000001" }),
        buildRow({ id: "app-2", reference_number: "YC-2026-000002", status: "pending", deadline_state: "overdue" }),
      ]);

      render(<YellowCardPage />);
      await screen.findByText("YC-2026-000001");

      expect(within(getKpiTile("Decided on time")).getByText(/^1 of 1 within the target · /)).toBeInTheDocument();
      const pending = screen.getByText("Pending Review", { selector: "p" }).closest("div")!;
      expect(within(pending).getByText("Past due = past target")).toBeInTheDocument();
      expect(within(pending).getByText("1 past due · 0 at risk")).toBeInTheDocument();
      expect(screen.queryByText(/working-day/)).not.toBeInTheDocument();
      expect(within(getKpiTile("Applications")).getByText("2")).toBeInTheDocument();
      expect(screen.getByText("YC-2026-000002")).toBeInTheDocument();
      expect(screen.queryByText(/Unable to load applications/)).not.toBeInTheDocument();
    });
  });

  // #146 (the #141 rule): the Applicants by barangay CSV is built from the
  // loaded rows, which are empty before a load succeeds, so an export then
  // would be a header-only file that looks like a real report. The button is
  // off until the data is ready.
  describe("Applicants by barangay Export is off until the applications have loaded", () => {
    const coverageExportButton = () =>
      within(screen.getByText("Applicants by barangay").closest("section")!).getByRole("button", {
        name: "↓ Export",
      });

    it("is disabled while the applications are loading, and a click downloads nothing", async () => {
      const user = userEvent.setup();
      mockListApplications.mockReturnValue(new Promise<YellowCardRow[]>(() => {}));

      render(<YellowCardPage />);

      expect(coverageExportButton()).toBeDisabled();
      await user.click(coverageExportButton());
      expect(mockDownloadCsv).not.toHaveBeenCalled();
      // Out of scope: Recent applications' Export reads through the audited
      // export RPC, not the page's rows, so it works while the page loads.
      expect(getApplicationsExportButton()).toBeEnabled();
    });

    it("is enabled once a load succeeds, even with no applications in range, and exports its own file", async () => {
      const user = userEvent.setup();
      mockListApplications.mockResolvedValue([]);

      render(<YellowCardPage />);

      await waitFor(() => expect(coverageExportButton()).toBeEnabled());
      await user.click(coverageExportButton());
      expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
      expect(mockDownloadCsv.mock.calls[0][0]).toBe("applicants-by-barangay.csv");
    });

    it("is disabled after a failed load, and stays disabled for the whole of a Retry until it succeeds", async () => {
      // Retry only shows on the error state, so the page never reloads over
      // good data; the case to pin is a Retry with its request held open.
      const user = userEvent.setup();
      mockListApplications.mockRejectedValueOnce({ kind: "unknown", message: "boom" });
      let resolveRetry: (rows: YellowCardRow[]) => void = () => {};
      mockListApplications.mockReturnValueOnce(
        new Promise<YellowCardRow[]>((resolve) => {
          resolveRetry = resolve;
        })
      );

      render(<YellowCardPage />);
      await screen.findByText("Unable to load applications: boom");

      expect(coverageExportButton()).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Retry" }));

      expect(screen.getByRole("status")).toHaveTextContent("Loading applications…");
      expect(coverageExportButton()).toBeDisabled();

      resolveRetry([buildRow({ id: "app-1", reference_number: "YC-2026-000001" })]);
      await screen.findByText("YC-2026-000001");

      expect(coverageExportButton()).toBeEnabled();
    });
  });
});
