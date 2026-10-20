import type { RateTier } from "../types";

/** One row of `public_booking_venue_rates`, granted to anon and authenticated. */
export interface VenueRateRow {
  venue_code: string;
  tier: RateTier;
  base_fee: number | null;
  extension_hourly: number | null;
  /**
   * ⚠️ Null on BOTH rehearsal_practice rows since l55, along with base_fee and
   * extension_hourly. The rehearsal price moved to booking_rehearsal_rates
   * because the LGU sheet prices it identically at both tiers. The rows still
   * exist only so booking_price can read requires_quote off them; a missing row
   * raises 23503 by design.
   */
  hourly_rate: number | null;
  requires_quote: boolean;
}

/** One row of `public_booking_rehearsal_rates` — new in l55, granted to both roles. */
export interface RehearsalRateRow {
  code: string;
  label: string;
  hourly_rate: number;
}

export interface FeeReference {
  amount: number | null;
  /** The rate card says a human must price this combination. */
  requiresQuote: boolean;
  /** No usable rate row. Never priced as zero — see the comment below. */
  unknown: boolean;
}

/**
 * The base fee buys the FIRST SIX HOURS. This 6 is deliberately NOT
 * booking_config.min_duration_hours: they both equal 6 today and mean different
 * things — this is the span the base fee buys, that is the shortest booking the
 * city accepts. booking_price() hardcodes the same literal for the same reason.
 */
export const BASE_FEE_HOURS = 6;

/**
 * Pure mirror of booking_price(p_venue_code, p_tier, p_duration_hours,
 * p_rehearsal_rate_type) — the four-argument form l55 introduced.
 *
 * DISPLAY ONLY. The authoritative fee is computed server-side at submission by
 * booking_price() itself and stored on the row; every screen reads it from
 * there. This exists for one job: showing the operator what the same booking
 * would cost at the commercial tier, beside the free-text quote box, so a
 * Full Facility discounted quote is anchored to something.
 *
 * Why a mirror at all: booking_price is SECURITY DEFINER and is NOT executable
 * by `authenticated` — verified with has_function_privilege, before and after
 * l55. EndUser hit the same wall and mirrors it in estimateVenueFee(); this is
 * that function, written against the same views. Parent decision 2 said never to
 * do this, and decision 1 of the booking record supersedes it. Revisit if the
 * formula ever grows past one branch, or if EXECUTE is granted.
 *
 * `isHourly` comes from `public_booking_venues.is_hourly` and is passed in
 * rather than inferred, because that is what the server switches on. A venue row
 * carrying both a base_fee and an hourly_rate is possible after a Super Staff
 * edit, and guessing would put this function and the server on different
 * answers for the same booking.
 *
 * `rehearsalRate` is the matching row of public_booking_rehearsal_rates, or null
 * for any venue that is not hourly. It is a SEPARATE argument rather than a
 * lookup inside the venue row because l55 put the rehearsal price in a separate
 * table — the sheet prices the three rate types identically across both tiers,
 * so the tier plays no part and a third key on booking_venue_rates would have
 * meant two drifting copies of the same three figures.
 */
export function referenceFee(
  rate: VenueRateRow | undefined,
  durationHours: number,
  isHourly: boolean,
  rehearsalRate: RehearsalRateRow | null | undefined,
): FeeReference {
  // booking_price raises 23503 rather than returning zero, precisely so a
  // rate-card edit that drops a row cannot start issuing free bookings
  // silently. The display equivalent is to show nothing.
  if (!rate) return { amount: null, requiresQuote: false, unknown: true };

  if (rate.requires_quote) {
    return { amount: null, requiresQuote: true, unknown: false };
  }

  if (isHourly) {
    // NOT rate.hourly_rate. Since l55 that column is null on both
    // rehearsal_practice rows, and reading it here is how this function
    // silently reports "unknown" for every rehearsal booking in the system.
    // booking_price raises 22023 when the rate type is absent and 23503 when
    // it names no active rate; both land here as `unknown`.
    if (!rehearsalRate) {
      return { amount: null, requiresQuote: false, unknown: true };
    }
    return {
      amount: rehearsalRate.hourly_rate * durationHours,
      requiresQuote: false,
      unknown: false,
    };
  }

  if (rate.base_fee === null) {
    return { amount: null, requiresQuote: false, unknown: true };
  }
  const extension =
    Math.max(0, durationHours - BASE_FEE_HOURS) * (rate.extension_hourly ?? 0);
  return {
    amount: rate.base_fee + extension,
    requiresQuote: false,
    unknown: false,
  };
}
