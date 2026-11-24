import type { BookingRow } from "@/portals/admin/features/booking/lib/bookings";

/**
 * TEST-ONLY. A shared `admin_booking_analytics` row builder for Admin tests,
 * so a new column on the view is one edit here rather than one per test file
 * (#176). Imported by *.test.ts(x) and by nothing that ships.
 *
 * The dates are fixed, so a pure-function test is the same on any run date.
 * A page test whose table filters against the real clock passes its own
 * `submitted_at`.
 */
export function buildBookingRow(overrides: Partial<BookingRow> = {}): BookingRow {
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
    event_date: "2026-07-15",
    start_time: "09:00:00",
    duration_hours: 4,
    total_fee: 1000,
    status: "confirmed",
    submitted_at: "2026-07-15T00:00:00Z",
    lead_time_days: 17,
    cancellation_reason: null,
    completed_at: null,
    confirmed_at: null,
    quoted_at: null,
    tier_verified: null,
    confirmation_due_at: null,
    deadline_state: null,
    sla_elapsed_seconds: null,
    sla_on_time: null,
    sla_scoreable: null,
    sla_stopped_at: null,
    sla_target_hours: null,
    ...overrides,
  };
}
