// Domain types for the convention-centre booking slice.

export type ConventionDateBasis = "booking" | "event";

// Only bookings/bookingsDelta: utilization needs a venue capacity NUMBER
// (booking_venues.capacity_label is free text) and resident/outside share
// needs is_resident, which submit_booking never writes. The page renders
// "Not tracked" for those three tiles rather than a fabricated figure, so
// this shape carried six fields that were hardcoded to 0/"Not tracked" in
// aggregate.ts and read by nobody. They are gone; if the underlying data
// ever lands, they come back as real derivations.
export interface ConventionRangeStats {
  bookings: number;
  bookingsDelta: string;
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
  avgFillPct: number | null;
  bookings: number;
  barClass: string;
}
