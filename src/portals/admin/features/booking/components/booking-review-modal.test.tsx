// src/portals/admin/features/booking/components/booking-review-modal.test.tsx
import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { BookingReviewModal } from "@/portals/admin/features/booking/components/booking-review-modal";
import type { BookingPii } from "@/portals/admin/features/booking/lib/bookings";
import { vi } from "vitest";

// vi.mock's first argument is a plain string, not an import specifier, so it
// is not rewritten by the SWC path-alias transform the way `@/...` imports
// elsewhere in this file are. A relative path is required for the mock to be
// registered against the same resolved module that
// src/portals/admin/features/booking/components/booking-review-modal.tsx imports.
const mockReadBookingPii = vi.fn();

vi.mock("../lib/bookings", () => ({
  readBookingPii: (id: string) => mockReadBookingPii(id),
}));

function buildPii(overrides: Partial<BookingPii> = {}): BookingPii {
  return {
    reference: "CC-2026-000001",
    event_title: "Annual Business Summit 2026",
    event_type_code: "conference",
    venue_code: "ATRIUM",
    venue_label: "Atrium",
    event_date: "2026-08-20",
    start_time: "09:00:00",
    duration_hours: 4,
    estimated_headcount: 300,
    total_fee: 15000,
    status: "confirmed",
    submitted_at: "2026-05-01T00:00:00Z",
    special_requirements: "None",
    contact_person: "Maria Santos",
    contact_number: "0917-123-4567",
    email_address: "maria.santos@example.com",
    organization_name: "Lucena Chamber of Commerce",
    ...overrides,
  };
}

describe("BookingReviewModal", () => {
  beforeEach(() => {
    mockReadBookingPii.mockReset();
  });

  it("does not call readBookingPii when closed", () => {
    render(<BookingReviewModal bookingId={null} onClose={() => {}} />);
    expect(mockReadBookingPii).not.toHaveBeenCalled();
  });

  it("calls readBookingPii exactly once with the booking id when opened", async () => {
    mockReadBookingPii.mockResolvedValue(buildPii());

    render(<BookingReviewModal bookingId="booking-1" onClose={() => {}} />);

    await screen.findByText("maria.santos@example.com");
    expect(mockReadBookingPii).toHaveBeenCalledTimes(1);
    expect(mockReadBookingPii).toHaveBeenCalledWith("booking-1");
  });

  it("does not re-fire the fetch on re-render with the same booking id", async () => {
    mockReadBookingPii.mockResolvedValue(buildPii());

    const { rerender } = render(
      <BookingReviewModal bookingId="booking-1" onClose={() => {}} />
    );
    await screen.findByText("maria.santos@example.com");

    // A parent re-render (e.g. an unrelated state change) must not re-fire
    // the audited fetch — every call writes a pii_access audit row.
    rerender(<BookingReviewModal bookingId="booking-1" onClose={() => {}} />);
    rerender(<BookingReviewModal bookingId="booking-1" onClose={() => {}} />);

    expect(mockReadBookingPii).toHaveBeenCalledTimes(1);
  });

  // Regression guard for the Strict Mode double-invoke trap: if the modal is
  // ever mounted already-open (bookingId non-null on the very first render —
  // a common alternative to the current "mount once, toggle a null/id prop"
  // pattern), dev-only Strict Mode fires the effect, its cleanup, then the
  // effect again, all before the first fetch's promise settles. Marking
  // "fetched" at fetch-start (before the promise resolves) makes the second
  // invocation skip starting its own fetch while the first invocation's
  // result gets discarded by its own cleanup — nothing ever resolves. Erasing
  // the mark on an unsettled teardown instead fixes the hang but, on its own,
  // makes the second invocation start a genuinely new network call — two real
  // calls, two pii_access audit rows, for one open. Both invocations must
  // resolve, but exactly one real call may happen: the second invocation has
  // to *reuse* the first's in-flight promise, not start (or skip) its own.
  it("resolves after a fresh already-open mount under Strict Mode, with exactly one real call", async () => {
    mockReadBookingPii.mockResolvedValue(buildPii());

    render(
      <StrictMode>
        <BookingReviewModal bookingId="booking-1" onClose={() => {}} />
      </StrictMode>
    );

    expect(await screen.findByText("maria.santos@example.com")).toBeInTheDocument();
    expect(mockReadBookingPii).toHaveBeenCalledTimes(1);
  });

  it("switching bookingId fetches the new record, and a late-resolving stale fetch does not overwrite it", async () => {
    let resolveStale!: (value: BookingPii) => void;
    let resolveFresh!: (value: BookingPii) => void;
    const stalePromise = new Promise<BookingPii>((resolve) => {
      resolveStale = resolve;
    });
    const freshPromise = new Promise<BookingPii>((resolve) => {
      resolveFresh = resolve;
    });

    mockReadBookingPii.mockImplementation((id: string) =>
      id === "booking-1" ? stalePromise : freshPromise
    );

    const { rerender } = render(
      <BookingReviewModal bookingId="booking-1" onClose={() => {}} />
    );
    // Switch to a different booking before booking-1's fetch has settled.
    rerender(<BookingReviewModal bookingId="booking-2" onClose={() => {}} />);

    expect(mockReadBookingPii).toHaveBeenCalledWith("booking-1");
    expect(mockReadBookingPii).toHaveBeenCalledWith("booking-2");

    // Resolve the abandoned booking-1 fetch AFTER the switch — this is the
    // ordering that would clobber the new record if the guard were keyed on
    // "settled" alone rather than on each attempt's own active flag.
    await act(async () => {
      resolveStale(buildPii({ email_address: "stale@example.com" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      resolveFresh(buildPii({ email_address: "fresh@example.com" }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByText("fresh@example.com")).toBeInTheDocument();
    expect(screen.queryByText("stale@example.com")).not.toBeInTheDocument();
  });

  it("renders a loading state while the fetch is pending", () => {
    mockReadBookingPii.mockReturnValue(new Promise(() => {}));

    render(<BookingReviewModal bookingId="booking-1" onClose={() => {}} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders contact person, contact number, email and organization once resolved", async () => {
    mockReadBookingPii.mockResolvedValue(buildPii());

    render(<BookingReviewModal bookingId="booking-1" onClose={() => {}} />);

    expect(await screen.findByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("0917-123-4567")).toBeInTheDocument();
    expect(screen.getByText("maria.santos@example.com")).toBeInTheDocument();
    expect(screen.getByText("Lucena Chamber of Commerce")).toBeInTheDocument();
  });

  it("renders a permission message on kind: permission", async () => {
    mockReadBookingPii.mockRejectedValue({
      kind: "permission",
      message: "caller is not an active Admin",
    });

    render(<BookingReviewModal bookingId="booking-1" onClose={() => {}} />);

    expect(
      await screen.findByText("You do not have permission to view this booking's details.")
    ).toBeInTheDocument();
  });

  it("renders a not-found message on kind: not-found", async () => {
    mockReadBookingPii.mockRejectedValue({
      kind: "not-found",
      message: "Booking not found.",
    });

    render(<BookingReviewModal bookingId="booking-1" onClose={() => {}} />);

    expect(
      await screen.findByText("This booking could not be found.")
    ).toBeInTheDocument();
  });

  it("shows a note that viewing these details is recorded", async () => {
    mockReadBookingPii.mockResolvedValue(buildPii());

    render(<BookingReviewModal bookingId="booking-1" onClose={() => {}} />);

    expect(screen.getByText(/recorded/i)).toBeInTheDocument();
    // Let the pending fetch settle within this test's act() boundary rather
    // than leaking a state update into a later test.
    await screen.findByText("maria.santos@example.com");
  });

  // Admin Portal Fix Plan, final review, Fix 2: this modal used to render
  // data.status RAW, so it disagreed with the friendly label the table's own
  // Status column already shows for this same row (Task 5.1). BookingPii
  // types status as plain `string`, so this must go through the fallback
  // lookup in src/portals/admin/lib/status-labels.ts (bookingStatusLabel), not a direct
  // enum-keyed Record index.
  it("renders the friendly status label, not the raw enum code", async () => {
    mockReadBookingPii.mockResolvedValue(buildPii({ status: "awaiting_quote" }));

    render(<BookingReviewModal bookingId="booking-1" onClose={() => {}} />);

    expect(await screen.findByText("Awaiting quote")).toBeInTheDocument();
    expect(screen.queryByText("awaiting_quote")).not.toBeInTheDocument();
  });

  // A code the label map doesn't recognise must still render — as itself —
  // rather than crash the modal (the fallback ?? code in bookingStatusLabel).
  it("falls back to the raw code for a status the label map doesn't recognise", async () => {
    mockReadBookingPii.mockResolvedValue(buildPii({ status: "made_up_status" }));

    render(<BookingReviewModal bookingId="booking-1" onClose={() => {}} />);

    expect(await screen.findByText("made_up_status")).toBeInTheDocument();
  });
});
