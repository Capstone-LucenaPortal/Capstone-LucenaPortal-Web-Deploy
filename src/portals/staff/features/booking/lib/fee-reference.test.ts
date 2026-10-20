import { describe, expect, it } from "vitest";
import {
  referenceFee,
  type RehearsalRateRow,
  type VenueRateRow,
} from "./fee-reference";

function rate(over: Partial<VenueRateRow> = {}): VenueRateRow {
  return {
    venue_code: "atrium",
    tier: "commercial",
    base_fee: 60000,
    extension_hourly: 9000,
    hourly_rate: null,
    requires_quote: false,
    ...over,
  };
}

/** The two rehearsal_practice rows carry nothing at all after l55. */
const emptyRehearsalRate = rate({
  venue_code: "rehearsal_practice",
  base_fee: null,
  extension_hourly: null,
  hourly_rate: null,
});

const withAc: RehearsalRateRow = {
  code: "with_ac",
  label: "With Air Conditioning",
  hourly_rate: 15000,
};

describe("referenceFee — standard venues", () => {
  it("charges the full base for anything up to six hours", () => {
    // "1st Six Hours" on the rate sheet: a 3-hour Atrium booking still pays
    // the whole base fee.
    expect(referenceFee(rate(), 3, false, null)).toEqual({
      amount: 60000,
      requiresQuote: false,
      unknown: false,
    });
    expect(referenceFee(rate(), 6, false, null).amount).toBe(60000);
  });

  it("adds the hourly extension past six", () => {
    expect(referenceFee(rate(), 8, false, null).amount).toBe(60000 + 2 * 9000);
  });

  it("reports a quote requirement instead of a number", () => {
    // full_facility / discounted. The one row l09 got right, and the reason
    // the Quote screen exists at all.
    expect(
      referenceFee(
        rate({
          venue_code: "full_facility",
          tier: "discounted",
          requires_quote: true,
          base_fee: null,
          extension_hourly: null,
        }),
        6,
        false,
        null,
      ),
    ).toEqual({ amount: null, requiresQuote: true, unknown: false });
  });

  it("reports an unknown rate rather than pricing at zero", () => {
    // booking_price() raises 23503 here on purpose: a rate-card edit that
    // drops a row must never start issuing free bookings silently. The UI
    // equivalent is showing nothing, not showing ₱0.00.
    expect(referenceFee(undefined, 6, false, null)).toEqual({
      amount: null,
      requiresQuote: false,
      unknown: true,
    });
    expect(
      referenceFee(rate({ base_fee: null, extension_hourly: null }), 6, false, null)
        .unknown,
    ).toBe(true);
  });
});

describe("referenceFee — rehearsal, after l55", () => {
  it("prices from the rehearsal rate, not from the venue row", () => {
    // The venue row is EMPTY for rehearsal_practice since l55 — all four
    // figures null. Reading hourly_rate off it is how this silently returns
    // `unknown` for every rehearsal booking.
    expect(referenceFee(emptyRehearsalRate, 5, true, withAc).amount).toBe(75000);
  });

  it("prices the same at both tiers", () => {
    // The sheet prices practice mode identically for commercial and
    // discounted. That is WHY the rate lives in its own table rather than as
    // a third key on booking_venue_rates, and this test is the assertion that
    // the tier plays no part.
    const commercial = referenceFee(emptyRehearsalRate, 5, true, withAc).amount;
    const discounted = referenceFee(
      { ...emptyRehearsalRate, tier: "discounted" },
      5,
      true,
      withAc,
    ).amount;
    expect(commercial).toBe(discounted);
    expect(commercial).toBe(75000);
  });

  it("carries the three rates apart", () => {
    // Before l55 all three billed a flat ₱1,500/hr. A 4-hour booking:
    const at = (hourly: number) =>
      referenceFee(emptyRehearsalRate, 4, true, {
        code: "x",
        label: "x",
        hourly_rate: hourly,
      }).amount;
    expect(at(1200)).toBe(4800); // No AC (Day)
    expect(at(1800)).toBe(7200); // No AC (Night)
    expect(at(15000)).toBe(60000); // With AC
  });

  it("reports unknown when the rate type is missing", () => {
    // booking_price raises 22023 for a null rate type on an hourly venue.
    // Showing nothing is the display equivalent; showing ₱0 is not.
    expect(referenceFee(emptyRehearsalRate, 4, true, null).unknown).toBe(true);
    expect(referenceFee(emptyRehearsalRate, 4, true, undefined).unknown).toBe(true);
  });

  it("decides hourly from the venue, not from which column is populated", () => {
    // booking_price() switches on booking_venues.is_hourly. A venue row
    // carrying BOTH a base fee and an hourly rate — which a Super Staff edit
    // can produce — must resolve the way the server resolves it.
    const both = rate({ hourly_rate: 900 });
    expect(referenceFee(both, 8, false, null).amount).toBe(60000 + 2 * 9000);
    expect(referenceFee(both, 8, true, withAc).amount).toBe(120000);
  });
});
