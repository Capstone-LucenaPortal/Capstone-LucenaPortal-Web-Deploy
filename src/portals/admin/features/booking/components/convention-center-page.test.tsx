// src/portals/admin/features/booking/components/convention-center-page.test.tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConventionCenterPage, { metadata } from "@/app/(admin)/admin/(shell)/convention-center/page";
import type { BookingRow, BookingPii } from "@/portals/admin/features/booking/lib/bookings";
import type { VenueRow, BookingEventTypeRow } from "@/portals/admin/lib/supabase/catalogs";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that app/(admin)/convention-center/
// page.tsx imports.
const mockListBookings = vi.fn();
const mockListVenues = vi.fn();
const mockReadBookingPii = vi.fn();
const mockListBookingEventTypes = vi.fn();
const mockDownloadCsv = vi.fn();

vi.mock("../lib/bookings", () => ({
  listBookings: () => mockListBookings(),
  readBookingPii: (id: string) => mockReadBookingPii(id),
}));

vi.mock("../../../lib/supabase/catalogs", () => ({
  listVenues: () => mockListVenues(),
  listBookingEventTypes: () => mockListBookingEventTypes(),
}));

vi.mock("../../../lib/csv", () => ({
  downloadCsv: (filename: string, header: string[], rows: unknown[][]) =>
    mockDownloadCsv(filename, header, rows),
}));

function buildPii(overrides: Partial<BookingPii> = {}): BookingPii {
  return {
    reference: "CC-2026-000002",
    event_title: "Wedding Reception",
    event_type_code: "wedding",
    venue_code: "ATRIUM",
    venue_label: "Atrium",
    event_date: "2026-09-01",
    start_time: "14:00:00",
    duration_hours: 5,
    estimated_headcount: 150,
    total_fee: 20000,
    status: "confirmed",
    submitted_at: "2026-06-01T00:00:00Z",
    special_requirements: "None",
    contact_person: "Ana Reyes",
    contact_number: "0918-555-1212",
    email_address: "ana.reyes@example.com",
    organization_name: "Reyes Family",
    ...overrides,
  };
}

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

function buildRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "booking-1",
    reference_number: "CC-2026-000001",
    event_title: "Annual Business Summit 2026",
    event_type_code: "conference",
    classification_code: "private",
    rate_tier: "commercial",
    venue_code: "ATRIUM",
    is_resident: null,
    origin_barangay_code: null,
    origin_locality: null,
    estimated_headcount: 300,
    event_date: "2026-08-20",
    start_time: "09:00:00",
    duration_hours: 4,
    total_fee: 15000,
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

function buildVenue(overrides: Partial<VenueRow> = {}): VenueRow {
  return {
    code: "ATRIUM",
    label: "Atrium",
    capacity_label: "Capacity: 1,000 pax",
    is_hourly: false,
    sort_order: 1,
    ...overrides,
  };
}

function buildEventType(overrides: Partial<BookingEventTypeRow> = {}): BookingEventTypeRow {
  return {
    code: "conference",
    label: "Conference",
    sort_order: 1,
    ...overrides,
  };
}

function getRecentBookingsSection(): HTMLElement {
  return screen.getByText("Recent bookings").closest("section")!;
}

describe("ConventionCenterPage", () => {
  beforeEach(() => {
    mockListBookings.mockReset();
    mockListVenues.mockReset();
    mockListVenues.mockResolvedValue([]);
    mockReadBookingPii.mockReset();
    mockListBookingEventTypes.mockReset();
    mockListBookingEventTypes.mockResolvedValue([]);
    mockDownloadCsv.mockReset();
  });

  // The Custom date inputs used to be seeded with literals written the day
  // this page was authored ("2026-04-01"/"2026-04-30"), so clicking into them
  // months later offered a window with nothing to do with the present.
  it("seeds the Custom date inputs from the current Manila month, not authoring-time literals", () => {
    mockListBookings.mockResolvedValue([]);

    render(<ConventionCenterPage />);

    const manilaToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    expect(screen.getByLabelText("Custom range end")).toHaveValue(manilaToday);
    expect(screen.getByLabelText("Custom range start")).toHaveValue(`${manilaToday.slice(0, 7)}-01`);
  });

  // src/portals/admin/lib/csv.ts was previously untested and the export button was completely
  // uncovered — a mutation adding an "Organiser" column to this header left
  // 306/306 green. Exact array equality (not a subset check) is required so
  // an added PII column fails this test the moment it's introduced.
  it("the exported CSV header is exactly the expected columns", async () => {
    const user = userEvent.setup();
    mockListBookings.mockResolvedValue([buildRow()]);

    render(<ConventionCenterPage />);
    await screen.findByText("CC-2026-000001");

    await user.click(screen.getByRole("button", { name: "↓ Export" }));

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [filename, header] = mockDownloadCsv.mock.calls[0];
    expect(filename).toBe("convention-center-bookings.csv");
    expect(header).toEqual(["Reference", "Event", "Venue", "Event date", "Status", "Cancellation Reason"]);
  });

  // Admin Portal Fix Plan, Task 5.3 follow-up: cancellation_reason was
  // surfaced in the visible table but not the CSV export.
  it("includes the friendly cancellation reason label in the exported row, matching the visible table", async () => {
    const user = userEvent.setup();
    mockListBookings.mockResolvedValue([
      buildRow({ id: "b-1", reference_number: "CC-2026-000001", status: "cancelled", cancellation_reason: "rejected_by_staff" }),
    ]);

    render(<ConventionCenterPage />);
    await screen.findByText("CC-2026-000001");

    await user.click(screen.getByRole("button", { name: "↓ Export" }));

    const [, , rows] = mockDownloadCsv.mock.calls[0];
    // Same friendly label the table renders, not the raw enum code.
    expect(rows[0]).toContain("Rejected by staff");
    expect(rows[0]).not.toContain("rejected_by_staff");
  });

  it("shows \"—\" for cancellation reason in the export on an active (non-cancelled) booking", async () => {
    const user = userEvent.setup();
    mockListBookings.mockResolvedValue([
      buildRow({ id: "b-1", reference_number: "CC-2026-000001", status: "confirmed", cancellation_reason: null }),
    ]);

    render(<ConventionCenterPage />);
    await screen.findByText("CC-2026-000001");

    await user.click(screen.getByRole("button", { name: "↓ Export" }));

    const [, , rows] = mockDownloadCsv.mock.calls[0];
    expect(rows[0][rows[0].length - 1]).toBe("—");
  });

  // Regression guard: the export used to read `rows` (every fetched
  // booking) instead of `filtered` (the status-tab-narrowed view the table
  // above already shows), silently exporting rows the admin cannot see on
  // screen. The fixture makes filtered vs. unfiltered visibly different —
  // b-2 is cancelled, so switching to the "Confirmed" tab must drop it from
  // the downloaded content entirely.
  it("clicking Export downloads only the rows visible under the active status tab, not every fetched row", async () => {
    const user = userEvent.setup();
    mockListBookings.mockResolvedValue([
      buildRow({ id: "b-1", reference_number: "CC-2026-000001", status: "confirmed" }),
      buildRow({ id: "b-2", reference_number: "CC-2026-000002", status: "cancelled" }),
    ]);

    render(<ConventionCenterPage />);
    await screen.findByText("CC-2026-000001");

    await user.click(screen.getByRole("tab", { name: "Confirmed" }));
    await user.click(screen.getByRole("button", { name: "↓ Export" }));

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [, , rows] = mockDownloadCsv.mock.calls[0];
    expect(rows.flat()).toContain("CC-2026-000001");
    expect(rows.flat()).not.toContain("CC-2026-000002");
  });

  // Filtering/bucketing are rigorously Manila-anchored (src/portals/admin/lib/dates.ts), but
  // the Event date column (and the CSV export, which reuses the same
  // formatManilaDate helper) used to render via a local toLocaleDateString
  // call with no timeZone option, reading the HOST's local zone instead of
  // Manila. event_date is a plain `date` column (no time-of-day component),
  // so parsing it as UTC midnight and rendering under a negative-offset host
  // renders every event a day early — the reviewer's own measured repro
  // (TZ=PST8PDT: "2026-08-20" -> "Aug 19, 2026"). This pins the page's
  // end-to-end wiring; the explicit "Asia/Manila" zone itself is guarded
  // machine-independently by formatManilaDate's own spy test in
  // src/portals/admin/lib/dates.test.ts, since a host-output-only assertion here
  // would spuriously pass on any machine whose ambient zone already happens
  // to be Asia/Manila.
  it("renders the Event date — on screen and in the exported CSV — as the Manila calendar day, using the shared formatManilaDate helper", async () => {
    const user = userEvent.setup();
    mockListBookings.mockResolvedValue([
      buildRow({ id: "b-1", reference_number: "CC-2026-000001", event_date: "2026-08-20" }),
    ]);

    render(<ConventionCenterPage />);
    await screen.findByText("CC-2026-000001");

    expect(screen.getByText("Aug 20, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Aug 19, 2026")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "↓ Export" }));
    const [, , rows] = mockDownloadCsv.mock.calls[0];
    expect(rows.flat()).toContain("Aug 20, 2026");
    expect(rows.flat()).not.toContain("Aug 19, 2026");
  });

  it("renders a row per returned booking, showing its reference number", async () => {
    mockListBookings.mockResolvedValue([
      buildRow({ id: "b-1", reference_number: "CC-2026-000001" }),
      buildRow({ id: "b-2", reference_number: "CC-2026-000002" }),
    ]);

    render(<ConventionCenterPage />);

    expect(await screen.findByText("CC-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("CC-2026-000002")).toBeInTheDocument();
  });

  // The privacy regression guard: admin_booking_analytics carries no
  // organiser name, contact, email or organization by design. That identity
  // is only available behind the audited readBookingPii RPC (Task 8's job).
  // Exact array equality (not a subset/contains check) is required so a
  // Booked By or Organization column added alongside the real columns would
  // still fail this test.
  it("renders exactly the required column set — no organiser PII, and no Origin column", async () => {
    mockListBookings.mockResolvedValue([buildRow()]);

    render(<ConventionCenterPage />);
    await screen.findByText("CC-2026-000001");

    const section = getRecentBookingsSection();
    const headers = within(section)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Reference",
      "Event",
      "Venue",
      "Event date",
      "Status",
      "Cancellation Reason",
      "Review",
    ]);
    expect(headers).not.toContain("Booked By");
    expect(headers).not.toContain("Organization");
    expect(headers).not.toContain("Contact");
    expect(headers).not.toContain("Email");
    expect(headers).not.toContain("Origin");
  });

  // Admin Portal Fix Plan, Task 5.3: cancellation_reason is already on
  // admin_booking_analytics but was never rendered anywhere on this page.
  describe("Task 5.3: cancellation_reason", () => {
    it("renders a friendly label for cancellation_reason, including the newly-reachable rejected_by_staff/expired_unpaid values", async () => {
      mockListBookings.mockResolvedValue([
        buildRow({ id: "b-1", reference_number: "CC-2026-000001", status: "cancelled", cancellation_reason: "rejected_by_staff" }),
        buildRow({ id: "b-2", reference_number: "CC-2026-000002", status: "cancelled", cancellation_reason: "expired_unpaid" }),
      ]);

      render(<ConventionCenterPage />);

      expect(await screen.findByText("Rejected by staff")).toBeInTheDocument();
      expect(screen.getByText("Expired (unpaid)")).toBeInTheDocument();
      expect(screen.queryByText("rejected_by_staff")).not.toBeInTheDocument();
      expect(screen.queryByText("expired_unpaid")).not.toBeInTheDocument();
    });

    it("renders '—' for cancellation_reason on an active (non-cancelled) booking, not a blank cell", async () => {
      mockListBookings.mockResolvedValue([
        buildRow({ id: "b-1", reference_number: "CC-2026-000001", status: "confirmed", cancellation_reason: null }),
      ]);

      render(<ConventionCenterPage />);
      await screen.findByText("CC-2026-000001");

      const row = screen.getByText("CC-2026-000001").closest("tr")!;
      expect(within(row).getAllByText("—").length).toBeGreaterThan(0);
    });
  });

  it("joins venue_code to its label via listVenues()", async () => {
    mockListBookings.mockResolvedValue([buildRow({ venue_code: "ATRIUM" })]);
    mockListVenues.mockResolvedValue([buildVenue({ code: "ATRIUM", label: "Atrium" })]);

    render(<ConventionCenterPage />);
    await screen.findByText("CC-2026-000001");

    // "Atrium" now also appears in the venue utilization panel below the
    // table (Task 10), so this must scope to the recent-bookings section
    // specifically, rather than assert uniqueness across the whole page.
    const section = getRecentBookingsSection();
    expect(within(section).getByText("Atrium")).toBeInTheDocument();
  });

  it("falls back to the raw venue code when the catalog has no match", async () => {
    mockListBookings.mockResolvedValue([buildRow({ venue_code: "UNKNOWN-VENUE" })]);
    mockListVenues.mockResolvedValue([buildVenue({ code: "ATRIUM", label: "Atrium" })]);

    render(<ConventionCenterPage />);

    expect(await screen.findByText("UNKNOWN-VENUE")).toBeInTheDocument();
  });

  it("shows an empty state, not an error, when listBookings resolves to []", async () => {
    mockListBookings.mockResolvedValue([]);

    render(<ConventionCenterPage />);

    expect(await screen.findByText("No bookings match this filter.")).toBeInTheDocument();
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unable to load/i)).not.toBeInTheDocument();
  });

  it("shows a permission message when listBookings rejects with kind: permission", async () => {
    mockListBookings.mockRejectedValue({
      kind: "permission",
      message: "caller is not an active Admin",
    });

    render(<ConventionCenterPage />);

    expect(
      await screen.findByText("You do not have permission to view Convention Center bookings.")
    ).toBeInTheDocument();
    expect(screen.queryByText("No bookings match this filter.")).not.toBeInTheDocument();
  });

  it("status tabs filter on the real booking_status enum values", async () => {
    const user = userEvent.setup();
    mockListBookings.mockResolvedValue([
      buildRow({ id: "b-1", reference_number: "CC-2026-000001", status: "confirmed" }),
      buildRow({ id: "b-2", reference_number: "CC-2026-000002", status: "awaiting_quote" }),
      buildRow({ id: "b-3", reference_number: "CC-2026-000003", status: "completed" }),
    ]);

    render(<ConventionCenterPage />);
    await screen.findByText("CC-2026-000001");

    await user.click(screen.getByRole("tab", { name: "Awaiting quote" }));
    expect(screen.queryByText("CC-2026-000001")).not.toBeInTheDocument();
    expect(screen.getByText("CC-2026-000002")).toBeInTheDocument();
    expect(screen.queryByText("CC-2026-000003")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Completed" }));
    expect(screen.getByText("CC-2026-000003")).toBeInTheDocument();
    expect(screen.queryByText("CC-2026-000002")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "All" }));
    expect(screen.getByText("CC-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("CC-2026-000002")).toBeInTheDocument();
    expect(screen.getByText("CC-2026-000003")).toBeInTheDocument();
  });

  // Regression guard: the table must agree with the date controls above it,
  // the same property Task 4/5's equivalents pinned for incidents and yellow
  // card.
  it("selecting a date preset that covers only one row's month shows only that row", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockListBookings.mockResolvedValue([
        buildRow({
          id: "b-1",
          reference_number: "CC-2026-000001",
          submitted_at: "2026-08-05T04:00:00Z", // inside August, the active Month preset
        }),
        buildRow({
          id: "b-2",
          reference_number: "CC-2026-000002",
          submitted_at: "2026-05-10T04:00:00Z", // a different month, outside the range
        }),
      ]);

      render(<ConventionCenterPage />);
      await screen.findByText("CC-2026-000001");

      // Default preset is already "Month"; click it explicitly to exercise
      // the same path a user selecting it would.
      await user.click(screen.getByRole("button", { name: "Month" }));

      expect(screen.getByText("CC-2026-000001")).toBeInTheDocument();
      expect(screen.queryByText("CC-2026-000002")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // THE PANEL THAT MUST STATE ITS OWN GAP. submit_booking never writes
  // origin_barangay_code or origin_locality, so origin_barangay_code is
  // always null and the generated is_resident column (origin_barangay_code
  // is not null) always evaluates to false, not null — this is not a bug the
  // panel can fix by deriving origin from something else. Bookings are
  // deliberately present in this fixture (not []) to
  // prove the explanation is not merely an empty-data state: even with rows
  // on screen, the origin breakdown must say why it cannot be shown rather
  // than rendering a blank table that reads as "no bookings exist".
  // Issue #24: the date type used to reach the KPI tiles only; the table, the
  // Export and the monthly chart stayed on submitted_at. b-1 was booked this
  // month for an event in October (still ahead), b-2 was booked in June for
  // an event this month, b-3 was booked in May for an event in July.
  it("the date type also drives the table, the Export and the monthly chart, which never shows a future event month", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-08-15T04:00:00Z")); // 2026-08-15 12:00 Manila
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockListBookings.mockResolvedValue([
        buildRow({
          id: "b-1",
          reference_number: "CC-2026-000001",
          submitted_at: "2026-08-05T04:00:00Z",
          event_date: "2026-10-03",
        }),
        buildRow({
          id: "b-2",
          reference_number: "CC-2026-000002",
          submitted_at: "2026-06-10T04:00:00Z",
          event_date: "2026-08-12",
        }),
        buildRow({
          id: "b-3",
          reference_number: "CC-2026-000003",
          submitted_at: "2026-05-01T04:00:00Z",
          event_date: "2026-07-20",
        }),
      ]);

      render(<ConventionCenterPage />);
      await screen.findByText("CC-2026-000001");

      const recent = getRecentBookingsSection();
      const chart = screen.getByText("Bookings by month").closest("section")!;

      // Default date type: unchanged from before the fix.
      expect(within(recent).queryByText("CC-2026-000002")).not.toBeInTheDocument();
      expect(within(chart).getByText("Last 6 months")).toBeInTheDocument();
      expect(within(chart).getByTitle("May: 1")).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Date type"), "event");

      expect(within(recent).getByText("CC-2026-000002")).toBeInTheDocument();
      expect(within(recent).queryByText("CC-2026-000001")).not.toBeInTheDocument();
      expect(within(recent).queryByText("CC-2026-000003")).not.toBeInTheDocument();
      // The column already showed event_date and stays as it is.
      expect(within(recent).getByRole("columnheader", { name: "Event date" })).toBeInTheDocument();

      await user.click(within(recent).getByRole("button", { name: "↓ Export" }));
      const [, , exported] = mockDownloadCsv.mock.calls[0];
      expect(exported.map((row: unknown[]) => row[0])).toEqual(["CC-2026-000002"]);

      expect(within(chart).getByText("By event date · Last 6 months")).toBeInTheDocument();
      expect(within(chart).getByTitle("Jul: 1")).toBeInTheDocument();
      expect(within(chart).getByTitle("Aug: 1")).toBeInTheDocument();
      expect(within(chart).queryByTitle("Oct: 1")).not.toBeInTheDocument();
      expect(within(chart).queryByTitle("May: 1")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("the Booking Origins panel states its own gap even when bookings are present", async () => {
    mockListBookings.mockResolvedValue([
      buildRow({ id: "b-1", reference_number: "CC-2026-000001" }),
      buildRow({ id: "b-2", reference_number: "CC-2026-000002" }),
    ]);

    render(<ConventionCenterPage />);
    await screen.findByText("CC-2026-000001");

    expect(
      screen.getByText(/booking origin is not yet collected/i)
    ).toBeInTheDocument();
    expect(screen.getByText("submit_booking")).toBeInTheDocument();
    expect(screen.getByText("origin_barangay_code")).toBeInTheDocument();
    expect(screen.getByText("origin_locality")).toBeInTheDocument();
    // Not a "no bookings" empty-table message — the rows are on screen above.
    expect(screen.queryByText(/no origin matches/i)).not.toBeInTheDocument();
  });

  // Utilization, Resident Share and Outside Lucena all share the same
  // underlying data gap (no venue capacity figure, no origin/residency
  // data) and so all three now state it honestly rather than showing a
  // fabricated number — "Not tracked" therefore appears three times, once
  // per tile, not once.
  it("the Utilization, Resident Share and Outside Lucena KPI tiles all state their gap instead of a fabricated number", async () => {
    mockListBookings.mockResolvedValue([buildRow()]);

    render(<ConventionCenterPage />);
    await screen.findByText("CC-2026-000001");

    expect(screen.getByText("Utilization")).toBeInTheDocument();
    expect(screen.getByText("Resident Share")).toBeInTheDocument();
    expect(screen.getByText("Outside Lucena")).toBeInTheDocument();
    expect(screen.getAllByText("Not tracked")).toHaveLength(3);
  });

  // Handoff regression guard: the row's `id` (the booking PK, distinct from
  // its reference_number) must be exactly what reaches readBookingPii. Two
  // rows are used, and the SECOND row's Review button is clicked — a
  // single-row fixture can't distinguish "passed the right id" from "passed
  // the only id", and clicking the first row would not catch a bug that
  // always passes the first row's id regardless of which button was clicked.
  it("clicking a row's Review button opens the modal for that row's booking id", async () => {
    const user = userEvent.setup();
    mockListBookings.mockResolvedValue([
      buildRow({ id: "booking-aaa", reference_number: "CC-2026-000001" }),
      buildRow({ id: "booking-bbb", reference_number: "CC-2026-000002" }),
    ]);
    mockReadBookingPii.mockResolvedValue(buildPii());

    render(<ConventionCenterPage />);
    await screen.findByText("CC-2026-000001");
    await screen.findByText("CC-2026-000002");

    const reviewButtons = screen.getAllByRole("button", { name: "Review" });
    expect(reviewButtons).toHaveLength(2);
    await user.click(reviewButtons[1]);

    expect(mockReadBookingPii).toHaveBeenCalledTimes(1);
    expect(mockReadBookingPii).toHaveBeenCalledWith("booking-bbb");
    expect(await screen.findByText("ana.reyes@example.com")).toBeInTheDocument();
  });

  // Task 10: the chart panels below the KPI tiles used to read mock data,
  // not listBookings()/listVenues(). These pin that they now derive from
  // the data-layer rows the page already
  // fetched, via lib/aggregate.
  describe("chart panels derive from listBookings()/listVenues(), not mock data", () => {
    it("the event type mix panel counts rows by event_type_code", async () => {
      mockListBookings.mockResolvedValue([
        buildRow({ id: "b-1", reference_number: "CC-2026-000001", event_type_code: "wedding" }),
        buildRow({ id: "b-2", reference_number: "CC-2026-000002", event_type_code: "wedding" }),
        buildRow({ id: "b-3", reference_number: "CC-2026-000003", event_type_code: "seminar" }),
      ]);

      render(<ConventionCenterPage />);

      const section = screen.getByText("Event type mix").closest("section")!;
      // listBookingEventTypes() resolves to [] by default (see beforeEach),
      // so eventTypeLabel falls back to the raw event_type_code — these are
      // NOT the old mock's invented Title Case labels ("Wedding",
      // "Conference", ...), they're just what's left when the catalog has no
      // match. Waiting on the panel's own content (rather than a row in the
      // table below) is the load signal here, since the table below is
      // separately date-filtered.
      expect(await within(section).findByText("wedding")).toBeInTheDocument();
      expect(within(section).getByText("seminar")).toBeInTheDocument();
      expect(within(section).queryByText("Conference")).not.toBeInTheDocument();
    });

    // Fix round 1, item 3: event_type_code must be joined to its human label
    // via listBookingEventTypes(), the same shape listDepartments()/
    // listVenues()/listIncidentCategories() already use.
    it("the event type mix panel joins event_type_code to its label via listBookingEventTypes()", async () => {
      mockListBookings.mockResolvedValue([buildRow({ id: "b-1", event_type_code: "wedding" })]);
      mockListBookingEventTypes.mockResolvedValue([
        buildEventType({ code: "wedding", label: "Wedding" }),
      ]);

      render(<ConventionCenterPage />);

      const section = screen.getByText("Event type mix").closest("section")!;
      expect(await within(section).findByText("Wedding")).toBeInTheDocument();
      expect(within(section).queryByText("wedding")).not.toBeInTheDocument();
    });

    // Regression guard: EVENT_TYPE_BAR_CLASSES used to be keyed by leftover
    // mock labels (Seminar, Cultural, Public Assembly) that match nothing
    // listBookingEventTypes() ever returns — the real
    // public_booking_event_types labels are Concert, Conference, Other,
    // Religious, Sports, Wedding — so 4 of 6 real event types fell through to
    // the bg-gray-500 default. This pins that a real label gets its own bar
    // color, not the gray fallback.
    it("gives a real event type label (Concert) its own bar color, not the gray fallback", async () => {
      mockListBookings.mockResolvedValue([buildRow({ id: "b-1", event_type_code: "concert" })]);
      mockListBookingEventTypes.mockResolvedValue([buildEventType({ code: "concert", label: "Concert" })]);

      render(<ConventionCenterPage />);

      const section = screen.getByText("Event type mix").closest("section")!;
      await within(section).findByText("Concert");
      expect(section.querySelector(".bg-blue-600")).toBeInTheDocument();
      expect(section.querySelector(".bg-gray-500")).not.toBeInTheDocument();
    });

    it("the event type mix panel falls back to the raw event_type_code when the catalog has no match", async () => {
      mockListBookings.mockResolvedValue([
        buildRow({ id: "b-1", event_type_code: "unmapped-type" }),
      ]);
      mockListBookingEventTypes.mockResolvedValue([
        buildEventType({ code: "wedding", label: "Wedding" }),
      ]);

      render(<ConventionCenterPage />);

      const section = screen.getByText("Event type mix").closest("section")!;
      expect(await within(section).findByText("unmapped-type")).toBeInTheDocument();
    });

    // Fix round 1, item 2: eventTypeMix must respect the active status tab,
    // not just raw rows. The fixture makes filtered vs. unfiltered visibly
    // different — "seminar" only belongs to a cancelled booking — so
    // filtering to "Cancelled" must isolate it and drop "wedding".
    it("the event type mix panel respects the active status tab, not just raw rows", async () => {
      const user = userEvent.setup();
      mockListBookings.mockResolvedValue([
        buildRow({ id: "b-1", reference_number: "CC-2026-000001", event_type_code: "wedding", status: "confirmed" }),
        buildRow({ id: "b-2", reference_number: "CC-2026-000002", event_type_code: "seminar", status: "cancelled" }),
      ]);

      render(<ConventionCenterPage />);
      const section = screen.getByText("Event type mix").closest("section")!;
      expect(await within(section).findByText("wedding")).toBeInTheDocument();
      expect(within(section).getByText("seminar")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "Cancelled" }));

      expect(within(section).queryByText("wedding")).not.toBeInTheDocument();
      expect(within(section).getByText("seminar")).toBeInTheDocument();
    });

    // Task 3.4: MixBarCard already showed each slice's count as visible
    // text, but the bar itself carried no accessible pairing between the
    // slice's label and its value. It now exposes both together via a
    // role="img" aria-label on the bar.
    it("the event type mix panel's bars carry a data-bearing aria-label per slice", async () => {
      mockListBookings.mockResolvedValue([
        buildRow({ id: "b-1", reference_number: "CC-2026-000001", event_type_code: "wedding" }),
        buildRow({ id: "b-2", reference_number: "CC-2026-000002", event_type_code: "wedding" }),
      ]);

      render(<ConventionCenterPage />);
      const section = screen.getByText("Event type mix").closest("section")!;
      expect(await within(section).findByText("wedding")).toBeInTheDocument();
      expect(within(section).getByRole("img", { name: "wedding: 2" })).toBeInTheDocument();
    });

    it("the bookings-by-month panel buckets rows into their Manila submission month", async () => {
      mockListBookings.mockResolvedValue([
        buildRow({ id: "b-1", submitted_at: "2026-03-10T04:00:00Z" }),
      ]);

      render(<ConventionCenterPage />);

      const section = screen.getByText("Bookings by month").closest("section")!;
      // The chart derives from the full fetched `rows`, not the date-filtered
      // table below, so a March submission still shows up here even though
      // the page's default "Month" preset would filter it out of the table.
      expect(await within(section).findByTitle("Mar: 1")).toBeInTheDocument();
      // The old mock trend's April total must not still be on screen.
      expect(within(section).queryByTitle("Apr: 234")).not.toBeInTheDocument();
      // Task 3.4: this panel never passes `showCounts`, so it used to render
      // no visible number at all — only the mouse-only title tooltip above.
      // MonthlyBarCard's default is now true, and the bar itself carries a
      // matching data-bearing aria-label for assistive tech.
      expect(within(section).getByText("1")).toBeInTheDocument();
      expect(within(section).getByRole("img", { name: "Mar: 1" })).toBeInTheDocument();
    });

    // THE PINNED EDGE CASE: a venue nobody booked is still a real venue and
    // must still appear, with bookings: 0 — the mirror image of
    // barangayCoverage dropping a barangay with zero applications.
    it("the venue utilization panel lists every venue from listVenues(), including one with zero bookings", async () => {
      mockListBookings.mockResolvedValue([buildRow({ id: "b-1", venue_code: "ATRIUM" })]);
      mockListVenues.mockResolvedValue([
        buildVenue({ code: "ATRIUM", label: "Atrium", capacity_label: "Capacity: 1,000 pax" }),
        buildVenue({ code: "ARENA", label: "Sports Arena", capacity_label: "Capacity: 3,500 pax" }),
      ]);

      render(<ConventionCenterPage />);

      const section = screen.getByText("Bookings by venue").closest("section")!;
      expect(await within(section).findByText("Sports Arena")).toBeInTheDocument();
      expect(within(section).getByText("Capacity: 3,500 pax")).toBeInTheDocument();
      // avgFillPct has no source (booking_venues.capacity_label is free text,
      // not a number) — the component's own "no cap tracking" gap state must
      // show for every venue, not a fabricated percentage.
      expect(within(section).getAllByText("no cap tracking").length).toBe(2);
    });

    // Task 3.4: VenueUtilizationCard already showed each venue's booking
    // count as visible text, but the bar itself carried no accessible
    // pairing between the venue and its value. It now exposes both together
    // via a role="img" aria-label on the bar.
    it("the venue utilization panel's bars carry a data-bearing aria-label per venue", async () => {
      mockListBookings.mockResolvedValue([buildRow({ id: "b-1", venue_code: "ATRIUM" })]);
      mockListVenues.mockResolvedValue([
        buildVenue({ code: "ATRIUM", label: "Atrium", capacity_label: "Capacity: 1,000 pax" }),
      ]);

      render(<ConventionCenterPage />);

      const section = screen.getByText("Bookings by venue").closest("section")!;
      expect(await within(section).findByText("Atrium")).toBeInTheDocument();
      expect(within(section).getByRole("img", { name: "Atrium: 1 bookings" })).toBeInTheDocument();
    });
  });

  // Task 3.5: page.tsx is now a server-component wrapper whose only job is
  // to export a per-route metadata.title; app/layout.tsx's title template
  // ("%s · Lucena City Admin Portal") interpolates this into the actual
  // <title>. Asserted directly on the exported object, since RTL's render()
  // never mounts a document <head> and so can't observe next/navigation's
  // resolved <title> the way a real Next.js request would.
  it("exports a per-route title", () => {
    expect(metadata.title).toBe("Convention Center");
  });

  // Admin Portal Fix Plan, Task 4.3: a failed fetch used to be a dead end —
  // a static error message with no way to try again short of a full page
  // reload.
  describe("Task 4.3: retry affordance and last-updated stamp", () => {
    it("clicking Retry re-invokes listBookings and recovers from a prior failure", async () => {
      const user = userEvent.setup();
      mockListBookings.mockRejectedValueOnce({ kind: "unknown", message: "boom" });
      mockListBookings.mockResolvedValueOnce([buildRow({ id: "b-1", reference_number: "CC-2026-000001" })]);

      render(<ConventionCenterPage />);

      expect(await screen.findByText("Unable to load bookings: boom")).toBeInTheDocument();
      expect(mockListBookings).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole("button", { name: "Retry" }));

      expect(await screen.findByText("CC-2026-000001")).toBeInTheDocument();
      // Exactly one additional fetch — not zero (Retry did nothing) and not
      // more than one (Retry somehow fired the effect twice).
      expect(mockListBookings).toHaveBeenCalledTimes(2);
    });

    it("shows the Updated stamp only once data has actually loaded, never during loading or after an error", async () => {
      let resolveBookings: (rows: BookingRow[]) => void = () => {};
      mockListBookings.mockReturnValue(
        new Promise<BookingRow[]>((resolve) => {
          resolveBookings = resolve;
        })
      );

      render(<ConventionCenterPage />);

      expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();

      resolveBookings([buildRow({ id: "b-1", reference_number: "CC-2026-000001" })]);
      await screen.findByText("CC-2026-000001");

      expect(await screen.findByText(/^Updated .*\(Asia\/Manila\)$/)).toBeInTheDocument();
    });

    it("does not show the Updated stamp when the fetch fails", async () => {
      mockListBookings.mockRejectedValue({ kind: "unknown", message: "boom" });

      render(<ConventionCenterPage />);

      expect(await screen.findByText("Unable to load bookings: boom")).toBeInTheDocument();
      expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();
    });
  });
});
