// Domain types for the convention-centre booking slice.

import type { Delta, EventDays } from "@/portals/admin/lib/aggregate";

export type ConventionDateBasis = "booking" | "event";

// No resident/outside share: it needs is_resident, which submit_booking
// never writes, so the page shows no such figure (#118). If the underlying
// data ever lands, it comes back as a real derivation.
export interface ConventionRangeStats {
  // Booking requests in range, whatever became of them (metrics sheet C1).
  bookings: number;
  // Of those, confirmed, fully paid or completed.
  confirmed: number;
  bookingsDelta: Delta;
  // The same figure as the Dashboard's "Days with an event" (#117).
  eventDays: EventDays;
}

export interface EventTypeSlice {
  type: string;
  count: number;
}

export interface VenueBookingChip {
  label: string;
  chipClass: string;
}

export interface VenueBooking {
  venue: string;
  chip?: VenueBookingChip;
  capacityLabel: string;
  bookings: number;
  barClass: string;
}
