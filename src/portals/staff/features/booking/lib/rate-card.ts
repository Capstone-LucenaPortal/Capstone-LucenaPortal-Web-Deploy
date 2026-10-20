import { cache } from "react";
import { createClient } from "@/shared/supabase/server";
import {
  referenceFee,
  type FeeReference,
  type RehearsalRateRow,
  type VenueRateRow,
} from "./fee-reference";
import type { Booking } from "../types";

/**
 * The three views that price a booking, read together and keyed together.
 *
 * They are one fact — what the city charges today — split across three tables
 * only because l55 moved the rehearsal price out of the venue rates and
 * `is_hourly` has always lived on the venue itself. Every consumer that wants
 * one of them wants all three, and there is exactly one consumer.
 *
 * ## Why this is a module where `slaClock()` was not
 *
 * ADR-0005 rejected `slaClock()` — a module bundling `now` and the at-risk
 * threshold — and rejected it outright rather than deferring it, so that the
 * argument would not be rebuilt from a review artifact six months later. This
 * module is the same *shape* of proposal and has to answer that record, or it
 * is the same mistake with a different noun. Three differences, and they are
 * the whole justification:
 *
 * 1. **These three facts are one fact.** `slaClock()` bundled a free, I/O-less
 *    `Date` with a `cache()`-wrapped database read, which is why ADR-0005 split
 *    them: bundling made every consumer of the *time* await a *read*. All three
 *    reads here are reads, of one rate card, over one round trip. There is no
 *    cheap half to make wait on an expensive one.
 * 2. **One consumer, one code path.** ADR-0005's deciding objection was that
 *    `slaClock()` could not reach `SlaIndicator`, which is rendered once per row
 *    and would go on taking both facts — leaving the thing outside the module
 *    for a caller to reach past. Nothing is left outside here. There is one
 *    consumer and it holds no map: the Booking detail *route* until #43, and
 *    `./booking-dossier.ts` since — which is where a cached reader's consumer
 *    has to be, since a `cache()`-wrapped read cannot sit inside the dossier
 *    module at all. See ADR-0006.
 * 3. **What leaves the route is a keying rule, not a parameter.** `slaClock()`
 *    would have shortened a parameter list. This moves three rules — a composite
 *    key, a default, and a lookup — out of a route where nothing could test
 *    them and into a pure function where the table below does.
 *
 * The third is the one that fails loudly if this work goes wrong: a version of
 * this module that delivers only a shorter argument list is `slaClock()`, and
 * ADR-0005 already settled it.
 */
export interface RateCard {
  /** The eight rows of public_booking_venue_rates, keyed by `venueRateKey`. */
  venueRates: Record<string, VenueRateRow>;
  /**
   * `is_hourly` per venue code — a MAP, not the boolean of the same name that
   * `referenceFee` takes. `commercialReference` turns the one into the other.
   */
  venueIsHourly: Record<string, boolean>;
  /** The three rows of public_booking_rehearsal_rates, keyed by `code`. */
  rehearsalRates: Record<string, RehearsalRateRow>;
}

/**
 * The composite key of `venueRates`, written once so the read that builds the
 * map and the rule that queries it cannot drift apart. `public_booking_venue_rates`
 * has no single-column identity — a venue is priced once per tier — and this is
 * the shape both ends agreed on by hand until it had a home.
 */
function venueRateKey(venueCode: string, tier: string): string {
  return `${venueCode}:${tier}`;
}

const readVenueRates = cache(
  async (): Promise<Record<string, VenueRateRow>> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("public_booking_venue_rates")
      .select("venue_code, tier, base_fee, extension_hourly, hourly_rate, requires_quote");

    const map: Record<string, VenueRateRow> = {};
    for (const row of (data as VenueRateRow[] | null) ?? []) {
      if (row.venue_code && row.tier) {
        map[venueRateKey(row.venue_code, row.tier)] = row;
      }
    }
    return map;
  },
);

/**
 * referenceFee takes this rather than inferring it, because booking_price()
 * switches on exactly this column and a venue row carrying both a base fee and
 * an hourly rate is reachable through a Super Staff edit.
 */
const readVenueIsHourly = cache(
  async (): Promise<Record<string, boolean>> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("public_booking_venues")
      .select("code, is_hourly");

    const map: Record<string, boolean> = {};
    for (const row of (data as { code: string | null; is_hourly: boolean | null }[] | null) ??
      []) {
      if (row.code) map[row.code] = row.is_hourly ?? false;
    }
    return map;
  },
);

/**
 * New in l55, and the one most likely to be forgotten: without it every
 * rehearsal booking shows a blank fee reference, because l55 emptied
 * `hourly_rate` on both rehearsal_practice venue-rate rows. The `label` it
 * carries is also the right thing to render on the detail page's Rate Type
 * field — better than a hand-written map, since Super Staff can rename or add
 * a rate type.
 */
const readRehearsalRates = cache(
  async (): Promise<Record<string, RehearsalRateRow>> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("public_booking_rehearsal_rates")
      .select("code, label, hourly_rate, sort_order");

    const map: Record<string, RehearsalRateRow> = {};
    for (const row of (data as RehearsalRateRow[] | null) ?? []) {
      if (row.code) map[row.code] = row;
    }
    return map;
  },
);

/**
 * Server-only glue, and the module's only impure export.
 *
 * The three reads above are private to this file: outside it there is no
 * reason to hold one map without the other two, and holding one was how the
 * keying rules ended up written out by hand in the route. Each is
 * `cache()`-wrapped individually, so this is free to be called more than once
 * in a render pass and is not itself cached — the dedupe is already underneath
 * it. Per ADR-0001 none of the three may take a `db` parameter while that
 * stays true.
 *
 * Untested by design, exactly as `getBookingConfig` is: a `cache()`-wrapped
 * reader has no seam, which is why the keying rules are a separate, pure
 * export beside it rather than folded in here.
 */
export async function getRateCard(): Promise<RateCard> {
  const [venueRates, venueIsHourly, rehearsalRates] = await Promise.all([
    readVenueRates(),
    readVenueIsHourly(),
    readRehearsalRates(),
  ]);

  return { venueRates, venueIsHourly, rehearsalRates };
}

/**
 * Pure. The same booking priced at the COMMERCIAL tier, for the quote screen
 * to anchor a discounted quote against.
 *
 * This holds the three rules that key the card, and they are the reason this
 * function exists rather than being four arguments spelled out at the call
 * site:
 *
 * - The composite key is `${venue_code}:commercial` — the commercial tier
 *   always, never `booking.rate_tier`. Anchoring a discounted quote to the
 *   discounted figure would anchor it to itself.
 * - A venue absent from `is_hourly` is treated as NOT hourly. The alternative
 *   sends it down the rehearsal branch, where it lands as a blank.
 * - The rehearsal rate is looked up only when the booking names a rate type,
 *   and is null otherwise. It is null for every venue that is not hourly, but
 *   it is passed rather than special-cased: a rehearsal booking sitting in
 *   awaiting_quote after a Super Staff rate edit would otherwise silently
 *   show a blank.
 *
 * `referenceFee` itself stays in ./fee-reference.ts, pure and public. It is
 * the display-only mirror of booking_price() and its header names its own
 * revisit conditions.
 */
export function commercialReference(
  booking: Pick<Booking, "venue_code" | "duration_hours" | "rehearsal_rate_type">,
  card: RateCard,
): FeeReference {
  const rehearsalRate = booking.rehearsal_rate_type
    ? card.rehearsalRates[booking.rehearsal_rate_type]
    : undefined;

  return referenceFee(
    card.venueRates[venueRateKey(booking.venue_code, "commercial")],
    booking.duration_hours,
    card.venueIsHourly[booking.venue_code] ?? false,
    rehearsalRate ?? null,
  );
}
