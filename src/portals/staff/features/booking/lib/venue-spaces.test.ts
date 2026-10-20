import { describe, expect, it } from "vitest";
import { spacesForVenue, SPACE_ORDER, VENUE_SPACES } from "./venue-spaces";

describe("spacesForVenue", () => {
  it("maps each single-space venue to its space", () => {
    expect(spacesForVenue("atrium")).toEqual(["atrium"]);
    expect(spacesForVenue("sports_arena")).toEqual(["arena"]);
  });

  it("maps rehearsal_practice to the arena", () => {
    // The rehearsal product IS the Sports Arena, hired differently. A
    // rehearsal and an arena event on the same evening are one collision, not
    // two bookings in two lanes.
    expect(spacesForVenue("rehearsal_practice")).toEqual(["arena"]);
  });

  it("maps full_facility to BOTH spaces", () => {
    // This is the whole reason the calendar is keyed on space. A Full Facility
    // booking blocks the Atrium and the Arena independently, and
    // bk_sync_occupancy writes two occupancy rows to say so.
    expect(spacesForVenue("full_facility")).toEqual(["atrium", "arena"]);
  });

  it("returns nothing for a venue it has never heard of", () => {
    // Super Staff can add a venue at runtime and this map cannot follow. An
    // empty array means the booking renders in the "unmapped" strip rather
    // than being silently filed under the wrong space.
    expect(spacesForVenue("rooftop_garden")).toEqual([]);
  });

  it("covers every venue the map knows, in lane order", () => {
    expect(SPACE_ORDER).toEqual(["atrium", "arena"]);
    expect(Object.keys(VENUE_SPACES).sort()).toEqual([
      "atrium",
      "full_facility",
      "rehearsal_practice",
      "sports_arena",
    ]);
  });
});
