import { describe, expect, it } from "vitest";
import { commercialReference, type RateCard } from "./rate-card";
import type { Booking } from "../types";

/**
 * One card, shaped like the three views behind it.
 *
 * `atrium` carries BOTH tiers at different figures, so a case that reads the
 * commercial one proves the composite key rather than coinciding with it.
 * `covered_court` is deliberately absent from `venueIsHourly` — that is the only
 * thing that exercises the `?? false` default.
 */
const CARD: RateCard = {
  venueRates: {
    "atrium:commercial": {
      venue_code: "atrium",
      tier: "commercial",
      base_fee: 60000,
      extension_hourly: 9000,
      hourly_rate: null,
      requires_quote: false,
    },
    "atrium:discounted": {
      venue_code: "atrium",
      tier: "discounted",
      base_fee: 30000,
      extension_hourly: 4500,
      hourly_rate: null,
      requires_quote: false,
    },
    "covered_court:commercial": {
      venue_code: "covered_court",
      tier: "commercial",
      base_fee: 20000,
      extension_hourly: 3000,
      hourly_rate: null,
      requires_quote: false,
    },
    "full_facility:commercial": {
      venue_code: "full_facility",
      tier: "commercial",
      base_fee: null,
      extension_hourly: null,
      hourly_rate: null,
      requires_quote: true,
    },
    "rehearsal_practice:commercial": {
      venue_code: "rehearsal_practice",
      tier: "commercial",
      // ⚠️ All three null since l55 — the rehearsal price lives in its own view.
      base_fee: null,
      extension_hourly: null,
      hourly_rate: null,
      requires_quote: false,
    },
  },
  venueIsHourly: {
    atrium: false,
    full_facility: false,
    rehearsal_practice: true,
  },
  rehearsalRates: {
    with_ac: { code: "with_ac", label: "With Air Conditioning", hourly_rate: 15000 },
    no_ac: { code: "no_ac", label: "Without Air Conditioning", hourly_rate: 10000 },
  },
};

type Priced = Pick<Booking, "venue_code" | "duration_hours" | "rehearsal_rate_type">;

function priced(over: Partial<Priced> = {}): Priced {
  return {
    venue_code: "atrium",
    duration_hours: 8,
    rehearsal_rate_type: null,
    ...over,
  };
}

describe("commercialReference", () => {
  const cases: {
    name: string;
    booking: Partial<Priced>;
    expected: { amount: number | null; requiresQuote: boolean; unknown: boolean };
  }[] = [
    {
      // The whole point of the anchor: the commercial figure, whatever tier
      // the booking itself was filed at. `atrium:discounted` prices the same
      // eight hours at 39,000, so a wrong key would be visible here.
      name: "keys the venue at the commercial tier and not at any other",
      booking: { venue_code: "atrium", duration_hours: 8 },
      expected: { amount: 78000, requiresQuote: false, unknown: false },
    },
    {
      // Non-hourly, so the rehearsal rate is null on the way into referenceFee
      // and the base fee alone buys the first six hours.
      name: "prices a non-hourly venue off its base fee with no rehearsal rate",
      booking: { venue_code: "atrium", duration_hours: 6 },
      expected: { amount: 60000, requiresQuote: false, unknown: false },
    },
    {
      name: "resolves the rehearsal rate for an hourly venue",
      booking: {
        venue_code: "rehearsal_practice",
        duration_hours: 3,
        rehearsal_rate_type: "with_ac",
      },
      expected: { amount: 45000, requiresQuote: false, unknown: false },
    },
    {
      // booking_price raises 23503 when the rate type names no active rate.
      name: "reports unknown when an hourly venue names a rate type the card does not carry",
      booking: {
        venue_code: "rehearsal_practice",
        duration_hours: 3,
        rehearsal_rate_type: "no_ac_dawn",
      },
      expected: { amount: null, requiresQuote: false, unknown: true },
    },
    {
      // booking_price raises 22023 when the rate type is absent.
      name: "reports unknown when an hourly venue names no rate type at all",
      booking: { venue_code: "rehearsal_practice", duration_hours: 3 },
      expected: { amount: null, requiresQuote: false, unknown: true },
    },
    {
      // Never zero. A rate-card edit that drops a row must not read as free.
      name: "reports a venue the card has no row for as unknown rather than zero",
      booking: { venue_code: "gymnasium", duration_hours: 8 },
      expected: { amount: null, requiresQuote: false, unknown: true },
    },
    {
      name: "passes requires_quote through",
      booking: { venue_code: "full_facility", duration_hours: 8 },
      expected: { amount: null, requiresQuote: true, unknown: false },
    },
    {
      // `?? false`: a venue missing from public_booking_venues.is_hourly is
      // priced off its base fee, not sent down the rehearsal branch to land
      // as a blank.
      name: "defaults a venue absent from the hourly map to not-hourly",
      booking: { venue_code: "covered_court", duration_hours: 8 },
      expected: { amount: 26000, requiresQuote: false, unknown: false },
    },
  ];

  for (const { name, booking, expected } of cases) {
    it(name, () => {
      expect(commercialReference(priced(booking), CARD)).toEqual(expected);
    });
  }
});
