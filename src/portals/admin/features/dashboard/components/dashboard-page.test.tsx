// src/portals/admin/features/dashboard/components/dashboard-page.test.tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPage, { metadata } from "@/app/(admin)/admin/(shell)/dashboard/page";
import type { YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import type { IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import type { BookingRow } from "@/portals/admin/features/booking/lib/bookings";
import type { DepartmentRow } from "@/portals/admin/lib/supabase/catalogs";
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
const mockGetIncidentConfig = vi.fn();
const mockListBarangays = vi.fn();

// The real public_incident_config values on this deployment: a DIFFERENT
// response target per severity, which is why the dashboard reads them rather
// than measuring every incident against one literal.
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
  getIncidentConfig: () => mockGetIncidentConfig(),
  listBarangays: () => mockListBarangays(),
  listDepartments: () => mockListDepartments(),
}));

vi.mock("../../auth/hooks/use-auth", () => ({
  useAuth: () => ({ profile: { full_name: "Juan Dela Cruz", email: "juan@lucena.gov.ph" } }),
}));

// The page's default preset is "Month", and every KPI/module card derives
// from real fetched rows filtered by filterByDateRange against real
// wall-clock "now". Using the current instant, like every other converted
// page's test suite does, is the only submitted_at guaranteed to sit inside
// every preset's [from, today] bounds on any day this suite runs.
function defaultSubmittedAt(): string {
  return new Date().toISOString();
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
    sla_met: true,
    ...overrides,
  };
}

function buildBookingRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "booking-1",
    reference_number: "CC-2026-000001",
    event_title: "Sample Event",
    event_type_code: "conference",
    classification_code: "private",
    rate_tier: "commercial",
    venue_code: "ATRIUM",
    is_resident: null,
    origin_barangay_code: null,
    origin_locality: null,
    estimated_headcount: 100,
    event_date: new Date().toISOString().slice(0, 10),
    start_time: "09:00:00",
    duration_hours: 4,
    total_fee: 1000,
    status: "confirmed",
    submitted_at: defaultSubmittedAt(),
    lead_time_days: 17,
    cancellation_reason: null,
    completed_at: null,
    confirmed_at: null,
    quoted_at: null,
    tier_verified: null,
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
    mockGetIncidentConfig.mockReset();
    mockGetIncidentConfig.mockResolvedValue(buildIncidentConfig());
    mockListBarangays.mockReset();
    mockListBarangays.mockResolvedValue([]);
  });

  it("renders the header with the signed-in staff member's name instead of a hardcoded 'Admin User'", async () => {
    render(<DashboardPage />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(await screen.findByText("Juan Dela Cruz · leadership view")).toBeInTheDocument();
    expect(screen.queryByText(/Admin User/)).not.toBeInTheDocument();
  });

  // The other four converted pages each pin both "an empty result renders an
  // empty state, not an error" and "a kind: permission rejection renders the
  // permission message" (see e.g. src/portals/admin/features/yellow-card/components/yellow-card-page.test.tsx). The
  // Dashboard had neither — this brings it in line with the rest.
  it("shows no error banner, not a false permission/load-failure message, when all three fetches resolve to []", async () => {
    render(<DashboardPage />);

    await screen.findByText("Citizens engaged");
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unable to load/i)).not.toBeInTheDocument();
  });

  it("shows a permission message when the initial fetch rejects with kind: permission", async () => {
    mockListApplications.mockRejectedValue({
      kind: "permission",
      message: "caller is not an active Admin",
    });

    render(<DashboardPage />);

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

    render(<DashboardPage />);

    await screen.findByText(/Unable to load dashboard data/);

    for (const label of ["Citizens engaged", "Service backlog", "SLA compliance", "Days with an event"]) {
      const tile = screen.getByText(label).closest("div");
      expect(tile).not.toBeNull();
      expect(within(tile as HTMLElement).getByText("—")).toBeInTheDocument();
      expect(within(tile as HTMLElement).queryByText(/\d/)).not.toBeInTheDocument();
    }
  });

  it("renders the four KPI tile labels", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("Citizens engaged")).toBeInTheDocument();
    expect(screen.getByText("Service backlog")).toBeInTheDocument();
    expect(screen.getByText("SLA compliance")).toBeInTheDocument();
    expect(screen.getByText("Days with an event")).toBeInTheDocument();
  });

  it("citizens engaged sums real fetched rows across all three modules for the active range", async () => {
    mockListApplications.mockResolvedValue([buildYellowCardRow()]);
    mockListIncidents.mockResolvedValue([buildIncidentRow(), buildIncidentRow({ id: "inc-2" })]);
    mockListBookings.mockResolvedValue([buildBookingRow()]);

    render(<DashboardPage />);

    expect(await screen.findByText("4")).toBeInTheDocument();
  });

  it("module cards link to their tabs", async () => {
    render(<DashboardPage />);
    await screen.findByText("Citizens engaged");
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

    render(<DashboardPage />);

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
    render(<DashboardPage />);

    const card = await screen.findByRole("link", { name: /^Yellow Card/ });
    expect(within(card).getByText("No decided applications in range")).toBeInTheDocument();
    expect(within(card).queryByText(/0% approval rate/)).not.toBeInTheDocument();
  });

  it("switching range presets re-derives the KPI and module card values from the same fetched rows", async () => {
    const user = userEvent.setup();
    mockListApplications.mockResolvedValue([buildYellowCardRow()]);

    render(<DashboardPage />);
    await screen.findByText("Citizens engaged");

    await user.click(screen.getByRole("button", { name: "Today" }));

    // Re-rendering under a different preset must not crash and must still
    // show the module's KPI tile labels.
    expect(screen.getByText("Citizens engaged")).toBeInTheDocument();
  });

  // Regression guard: the old mock's needsAttention list was four fixed
  // items regardless of any fetched data. It must now be derived from real
  // signals, and must be empty (with an honest empty state) when none of
  // those signals fire.
  it("shows an honest empty state when no real signal currently needs attention", async () => {
    render(<DashboardPage />);

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

    render(<DashboardPage />);

    const link = await screen.findByRole("link", { name: /Waste Management SLA at 20%/ });
    expect(link).toHaveAttribute("href", "/admin/sla-reports");
  });

  // Regression guard for the sla_breached-for-pending fix: this
  // needs-attention item was removed, not repointed. Before the fix, a
  // pending application's sla_breached only accrues on status change (see
  // applicationMet's doc comment in src/portals/admin/features/sla/lib/sla.ts), so it would silently
  // never fire for a genuinely overdue application. Rather than keep an item
  // that can misreport in the "everything's fine" direction, the item is
  // gone entirely until Phase 6 gives pending applications a real due date
  // to alert from.
  it("does not surface a Yellow Card past-SLA needs-attention item — sla_breached is not honest for pending rows", async () => {
    mockListApplications.mockResolvedValue([buildYellowCardRow({ status: "pending", sla_breached: true })]);

    render(<DashboardPage />);
    await screen.findByText("Citizens engaged");

    expect(screen.queryByText(/Yellow Card application.*past SLA/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Yellow Card application.*past SLA/ })).not.toBeInTheDocument();
  });

  // Admin Portal Fix Plan, Task 1.3: this needs-attention item was removed,
  // not repointed, the same call already made for the Yellow Card item just
  // above and for the same reason. backlogPastSla used to compute
  // `ageHours = now - submitted_at` per open row against today's LIVE
  // per-level config — counting never-armed (unverified) incidents as
  // breached, charging routing/verification delay against the department,
  // and re-judging old incidents against a target that may have since
  // changed (see backlogPastSla's doc comment in src/portals/admin/lib/aggregate.ts). It
  // is unconditionally null now, so no incident-backlog alert can fire here
  // even for a critical incident far past its real 4h target, until a Phase
  // 6 migration adds a real armed due date to admin_incident_analytics.
  it("does not surface an incident-backlog-past-SLA needs-attention item — backlogPastSla is unavailable, not honest from submitted_at", async () => {
    mockListIncidents.mockResolvedValue([
      buildIncidentRow({ status: "open", incident_level: "critical", submitted_at: hoursAgo(5) }),
    ]);

    render(<DashboardPage />);
    await screen.findByText("Citizens engaged");

    expect(screen.queryByText(/incident report.*past its SLA/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /incident report.*past its SLA/ })).not.toBeInTheDocument();
    expect(await screen.findByText("No items currently need attention.")).toBeInTheDocument();
  });

  it("raises no incident-SLA alert when the per-level targets could not be read either", async () => {
    mockGetIncidentConfig.mockRejectedValue({ kind: "unknown", message: "boom" });
    mockListIncidents.mockResolvedValue([
      buildIncidentRow({ status: "open", incident_level: "critical", submitted_at: hoursAgo(5) }),
    ]);

    render(<DashboardPage />);

    expect(await screen.findByText("No items currently need attention.")).toBeInTheDocument();
  });

  it("renders the SLA module card's trend bars from getSlaTrend's real derived data, not a mock table", async () => {
    const recentDate = defaultSubmittedAt();
    mockListIncidents.mockResolvedValue([
      buildIncidentRow({ id: "inc-1", submitted_at: recentDate, resolved_at: recentDate, sla_met: true }),
    ]);

    render(<DashboardPage />);

    const card = await screen.findByRole("link", { name: /^SLA Reports/ });
    const label = manilaMonthLabel(recentDate);
    expect(within(card).getByText(`Best: ${label} (100%)`)).toBeInTheDocument();
  });

  // Admin Portal Fix Plan, Phase 1 final review, finding 1: a trend point
  // with compliancePct: null (a month with zero scoreable incidents) must
  // not be averaged in as 0, and must not crown itself "best" via a bare
  // `>` comparison against null. The one real point should win both the
  // trend average and "Best", not a blended/undefined figure.
  //
  // The two incidents are 40 days apart specifically so they always land in
  // different calendar months (40 exceeds every month's length) regardless
  // of which real date this suite runs on, without pinning a literal
  // "Jun 2026"/"Jul 2026" label the way the pre-Task-4.2 mocked version did.
  // The "Annual" preset (Jan 1 of the current year to today) is clicked so
  // both months fall inside the active range — this can only fail if the
  // suite happens to run within the first ~40 days of a calendar year.
  it("excludes a null-compliance trend point from the SLA module card's trend average and best-month figures", async () => {
    const user = userEvent.setup();
    const staleDate = daysAgoIso(40);
    const recentDate = daysAgoIso(1);
    mockListIncidents.mockResolvedValue([
      // Still open — zero scoreable incidents in its bucket, so that bucket's
      // compliancePct is null (see getSlaTrend's doc comment in src/portals/admin/features/sla/lib/sla.ts).
      buildIncidentRow({ id: "inc-null", submitted_at: staleDate, status: "open", resolved_at: null }),
      buildIncidentRow({ id: "inc-real", submitted_at: recentDate, resolved_at: recentDate, sla_met: true }),
    ]);

    render(<DashboardPage />);
    await screen.findByText("Citizens engaged");
    await user.click(screen.getByRole("button", { name: "Annual" }));

    const card = await screen.findByRole("link", { name: /^SLA Reports/ });
    const recentLabel = manilaMonthLabel(recentDate);
    expect(await within(card).findByText("Trend avg: 100%")).toBeInTheDocument();
    expect(within(card).getByText(`Best: ${recentLabel} (100%)`)).toBeInTheDocument();
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

    render(<DashboardPage />);
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

    render(<DashboardPage />);
    await screen.findByText("Citizens engaged");

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

      render(<DashboardPage />);

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

      render(<DashboardPage />);

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

      render(<DashboardPage />);

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

      render(<DashboardPage />);

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

    render(<DashboardPage />);
    await screen.findByText("Citizens engaged");
    await user.click(screen.getByRole("button", { name: "Annual" }));

    const card = await screen.findByRole("link", { name: /^SLA Reports/ });
    const labelA = manilaMonthLabel(monthA);
    const labelB = manilaMonthLabel(monthB);
    expect(
      await within(card).findByRole("img", {
        name: `SLA compliance trend: ${labelA} 80%, ${labelB} 90%`,
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
