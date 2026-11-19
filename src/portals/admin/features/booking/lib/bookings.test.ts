import { listBookings, readBookingPii } from "@/portals/admin/features/booking/lib/bookings";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that src/portals/admin/features/booking/lib/bookings.ts
// imports.

// One chainable builder stands in for both requests listViewNewestFirst
// sends: the newest-row read, which is awaited, and the paged read, which
// fetchAllRows drives through .range(). Every chain method returns the builder.
const NEWEST = "2026-01-01T00:00:00.000649+00:00";
let newestResponse: { data: { submitted_at: string | null }[] | null; error: unknown };
const mockRange = vi.fn();
const builder = {
  select: vi.fn(() => builder),
  order: vi.fn(() => builder),
  limit: vi.fn(() => builder),
  lte: vi.fn(() => builder),
  abortSignal: vi.fn(() => builder),
  range: mockRange,
  then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(newestResponse).then(resolve, reject),
};
const mockFrom = vi.fn(() => builder);
const mockRpc = vi.fn();

const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock("../../../../../shared/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

describe("listBookings", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    for (const method of [builder.select, builder.order, builder.limit, builder.lte, builder.abortSignal]) {
      method.mockClear();
    }
    mockRange.mockReset();
    newestResponse = { data: [{ submitted_at: NEWEST }], error: null };
  });

  it("reads admin_booking_analytics: its newest submitted_at, then every row (select *) up to it, newest first by submitted_at then id", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });

    await listBookings();

    // Assert the exact view name. That view carries no organiser PII by
    // design; reading a base table instead would 403, and reading a
    // different view would leak. This is the guard against someone
    // "optimising" it away.
    expect(mockFrom.mock.calls).toEqual([["admin_booking_analytics"], ["admin_booking_analytics"]]);
    expect(builder.select.mock.calls).toEqual([["submitted_at"], ["*"]]);
    expect(builder.limit).toHaveBeenCalledWith(1);
    expect(builder.lte).toHaveBeenCalledWith("submitted_at", NEWEST);
    expect(builder.order.mock.calls).toEqual([
      ["submitted_at", { ascending: false }],
      ["submitted_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(mockRange).toHaveBeenCalledWith(0, 999);
  });

  // Admin Portal Fix Plan, Task 4.2.
  it("does not call .abortSignal() when no signal is given", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });

    await listBookings();

    expect(builder.abortSignal).not.toHaveBeenCalled();
  });

  // Both requests carry the signal, so a cancelled load cancels whichever one
  // is in flight; fetchAllRows gets it too, so no further page is asked for.
  it("attaches a given AbortSignal to both requests via .abortSignal()", async () => {
    mockRange.mockResolvedValue({ data: [], error: null });
    const controller = new AbortController();

    await listBookings(controller.signal);

    expect(builder.abortSignal.mock.calls).toEqual([[controller.signal], [controller.signal]]);
    expect(mockRange).toHaveBeenCalledWith(0, 999);
  });

  it("asks for no page when the given signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(listBookings(controller.signal)).rejects.toBeTruthy();

    expect(mockRange).not.toHaveBeenCalled();
  });

  it("returns [] for an empty view, asking for no page — an empty gate result is not an error", async () => {
    newestResponse = { data: [], error: null };

    const result = await listBookings();

    expect(result).toEqual([]);
    expect(mockRange).not.toHaveBeenCalled();
  });

  it("returns whatever rows the view provides", async () => {
    const rows = [
      {
        id: "booking-1",
        reference_number: "BKG-0001",
        status: "submitted",
        venue_code: "VENUE-1",
        classification_code: "CLASS-1",
        event_type_code: "TYPE-1",
        event_title: "Community Meeting",
        event_date: "2026-02-01",
        start_time: "09:00:00",
        duration_hours: 3,
        estimated_headcount: 50,
        rate_tier: "standard",
        tier_verified: false,
        total_fee: 1500,
        is_resident: null,
        origin_barangay_code: null,
        origin_locality: null,
        lead_time_days: 28,
        submitted_at: "2026-01-01T00:00:00Z",
        quoted_at: null,
        confirmed_at: null,
        completed_at: null,
        cancellation_reason: null,
      },
    ];
    mockRange.mockResolvedValue({ data: rows, error: null });

    const result = await listBookings();

    expect(result).toEqual(rows);
  });

  it("throws a PortalError with kind: permission when the client returns { code: '42501' }", async () => {
    mockRange.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "read_bookings: caller is not an active Admin" },
    });

    await expect(listBookings()).rejects.toMatchObject({ kind: "permission" });
  });

  it("throws a PortalError, asking for no page, when the newest-row read fails", async () => {
    newestResponse = {
      data: null,
      error: { code: "42501", message: "caller is not an active Admin" },
    };

    await expect(listBookings()).rejects.toMatchObject({ kind: "permission" });
    expect(mockRange).not.toHaveBeenCalled();
  });
});

describe("readBookingPii", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("calls .rpc('read_booking_pii', { p_booking_id: id }) with exactly that parameter name", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          contact_number: "0900000000",
          contact_person: "Juan Dela Cruz",
          duration_hours: 3,
          email_address: "booker@example.com",
          estimated_headcount: 50,
          event_date: "2026-02-01",
          event_title: "Community Meeting",
          event_type_code: "TYPE-1",
          organization_name: "Barangay One Council",
          reference: "BKG-0001",
          special_requirements: "None",
          start_time: "09:00:00",
          status: "submitted",
          submitted_at: "2026-01-01T00:00:00Z",
          total_fee: 1500,
          venue_code: "VENUE-1",
          venue_label: "Venue One",
        },
      ],
      error: null,
    });

    await readBookingPii("booking-1");

    expect(mockRpc).toHaveBeenCalledWith("read_booking_pii", {
      p_booking_id: "booking-1",
    });
  });

  it("throws kind: not-found when the client returns { code: 'P0002' }", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "read_booking_pii: no booking abc" },
    });

    await expect(readBookingPii("abc")).rejects.toMatchObject({ kind: "not-found" });
  });
});
