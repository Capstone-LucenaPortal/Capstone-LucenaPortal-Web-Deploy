/**
 * The two physical spaces the Convention Center has, and which venue product
 * consumes which.
 *
 * ⚠️ THIS IS A COPY OF A DATABASE TABLE. `booking_venue_space_map` holds the
 * authoritative mapping, and it is a base table with no public view — verified
 * 2026-08-11, after l55, when the granted booking views are
 * public_booking_venues, public_booking_venue_rates,
 * public_booking_rehearsal_rates, public_booking_classifications,
 * public_booking_event_types, public_booking_config and
 * public_venue_availability, and none of them projects the mapping.
 *
 * If a fifth venue is ever added, this file must be updated by hand and nothing
 * will fail loudly if it is not: an unmapped venue renders in the "unmapped"
 * strip instead of a lane. That is the honest failure mode, and the real fix is
 * a public_booking_venue_spaces view in whatever layer next touches booking.
 *
 * Why space rather than venue: bk_sync_occupancy writes one occupancy row PER
 * SPACE, and the EXCLUDE constraint is on (space_code, during). Grouping by
 * venue would double-render a Full Facility booking — it joins back to every
 * venue mapped to each of its two spaces, surfacing five rows for one booking —
 * and would show an Atrium booking and a Full Facility booking on the same
 * afternoon as independent when the database considers them a collision.
 */
export type SpaceCode = "atrium" | "arena";

/** Lane order, top to bottom. Atrium first, matching the venue list's sort_order. */
export const SPACE_ORDER: SpaceCode[] = ["atrium", "arena"];

export const SPACE_LABELS: Record<SpaceCode, string> = {
  atrium: "Atrium",
  arena: "Sports Arena",
};

export const VENUE_SPACES: Record<string, SpaceCode[]> = {
  atrium: ["atrium"],
  sports_arena: ["arena"],
  // The rehearsal product is the Sports Arena hired by the hour, not a fourth
  // room. booking_venue_space_map says so, and the EXCLUDE constraint enforces
  // it: a rehearsal and an arena event cannot share an evening.
  rehearsal_practice: ["arena"],
  // Writes two occupancy rows and blocks each space independently. "Locks both
  // Atrium + Arena" — BK-2.
  full_facility: ["atrium", "arena"],
};

export function spacesForVenue(venueCode: string): SpaceCode[] {
  return VENUE_SPACES[venueCode] ?? [];
}
