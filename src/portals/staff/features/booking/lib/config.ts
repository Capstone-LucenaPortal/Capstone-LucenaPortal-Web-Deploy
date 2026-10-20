import { cache } from "react";
import { createClient } from "@/shared/supabase/server";

/**
 * The stored configuration as of 2026-08-11: 50 / 72 / 6 / 6–22 / 7.
 *
 * These are the fallbacks used when `public_booking_config` is unreachable, not
 * a second source of truth. Nothing in the UI may hardcode them — the quote
 * screen reads the payment window from here so it does not tell an operator
 * "72 hours" after somebody has changed it to 48.
 */
export const DEFAULT_BOOKING_CONFIG = {
  downpayment_pct: 50,
  payment_window_hours: 72,
  min_duration_hours: 6,
  opening_hour: 6,
  closing_hour: 22,
  balance_due_days_before_event: 7,
} as const;

export interface BookingConfig {
  downpayment_pct: number;
  payment_window_hours: number;
  min_duration_hours: number;
  opening_hour: number;
  closing_hour: number;
  balance_due_days_before_event: number;
}

/**
 * Pure. The percentage is stored whole and consumed whole. Anything outside
 * 1–100 is treated as unreadable rather than obeyed: a zero would preview a
 * downpayment of nothing on the quote screen and make it look as though the
 * citizen owes the full amount in person, and a 500 is not a percentage.
 *
 * 100 IS legal and is deliberately allowed through — verify_payment branches on
 * `balance_amount = 0` and skips `confirmed` entirely, so a full-payment
 * configuration is a real one the RPCs already handle.
 */
export function toDownpaymentPct(pct: number | null | undefined): number {
  if (typeof pct !== "number" || pct <= 0 || pct > 100) {
    return DEFAULT_BOOKING_CONFIG.downpayment_pct;
  }
  return pct;
}

type ConfigRow = {
  downpayment_pct: number | null;
  payment_window_hours: number | null;
  min_duration_hours: number | null;
  opening_hour: number | null;
  closing_hour: number | null;
  balance_due_days_before_event: number | null;
};

function toNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Server-only glue. React's cache() dedupes across a single render pass, so a
 * detail page that needs the percentage for the pricing card and the payment
 * window for the quote form reads the one-row table once.
 *
 * A read failure returns the defaults rather than throwing: these decide a
 * preview figure and a sentence of copy, and failing the whole page because a
 * one-row config table was unreachable would not be a trade anyone wants.
 */
export const getBookingConfig = cache(async (): Promise<BookingConfig> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_booking_config")
    .select(
      "downpayment_pct, payment_window_hours, min_duration_hours, opening_hour, closing_hour, balance_due_days_before_event",
    )
    .maybeSingle();

  const row = data as ConfigRow | null;
  return {
    downpayment_pct: toDownpaymentPct(row?.downpayment_pct),
    payment_window_hours: toNumber(
      row?.payment_window_hours,
      DEFAULT_BOOKING_CONFIG.payment_window_hours,
    ),
    min_duration_hours: toNumber(
      row?.min_duration_hours,
      DEFAULT_BOOKING_CONFIG.min_duration_hours,
    ),
    opening_hour: toNumber(
      row?.opening_hour,
      DEFAULT_BOOKING_CONFIG.opening_hour,
    ),
    closing_hour: toNumber(
      row?.closing_hour,
      DEFAULT_BOOKING_CONFIG.closing_hour,
    ),
    balance_due_days_before_event: toNumber(
      row?.balance_due_days_before_event,
      DEFAULT_BOOKING_CONFIG.balance_due_days_before_event,
    ),
  };
});
