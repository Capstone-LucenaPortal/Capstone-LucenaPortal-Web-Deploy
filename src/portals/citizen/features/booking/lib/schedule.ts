import { MANILA_TIME_ZONE } from '@/shared/dates/manila';
import type { BookingFormData, DayStatus, FeeEstimate, PostSubmitStage } from '../types';

export const EMPTY_BOOKING_FORM: BookingFormData = {
  classificationCode: '',
  eventTitle: '',
  eventTypeCode: '',
  headcount: '',
  organizationName: '',
  contactPerson: '',
  contactNumber: '',
  emailAddress: '',
  venueCode: '',
  venueLabel: '',
  venueIsHourly: false,
  practiceRateType: '',
  specialRequirements: '',
  selectedDate: null,
  startTime: '',
  durationHours: 6,
  termsAccepted: false,
};

export const PRACTICE_RATE_TYPE_LABELS: Record<string, string> = {
  no_ac_day: 'No AC (Day)',
  no_ac_night: 'No AC (Night)',
  with_ac: 'With AC',
};

// Cosmetic only — no catalog column carries marketing copy. Falls back to ''
// in the UI for any venue code not listed here.
export const VENUE_DESCRIPTIONS: Record<string, string> = {
  atrium: 'Perfect for weddings, conventions, and medium-sized events.',
  sports_arena: 'Ideal for sporting events, concerts, and large-scale gatherings.',
  full_facility: 'The complete LCC complex, including both the Atrium and Sports Arena, for maximum impact events.',
  rehearsal_practice: 'Lower cost hourly access for rehearsals.',
};

export function formatPHP(amount: number): string {
  return `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatHour(h: number): string {
  const normalised = h % 24;
  const ampm = normalised < 12 ? 'AM' : 'PM';
  const display = normalised === 0 ? 12 : normalised > 12 ? normalised - 12 : normalised;
  return `${display}:00 ${ampm}`;
}

/** Pure: a Postgres `time` ("08:00:00") -> "8:00 AM", in formatHour's style. */
export function formatClockTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return time;
  return formatHour(Number(match[1])).replace(':00', `:${match[2]}`);
}

function toIsoTimestamp(raw: string): string {
  const isoish = raw.trim().replace(' ', 'T');
  return /[+-]\d{2}$/.test(isoish) ? `${isoish}:00` : isoish;
}

/**
 * Pure: parses a Postgres tstzrange literal as returned over PostgREST, e.g.
 * `["2026-12-01 08:00:00+00","2026-12-01 14:00:00+00")`. Bounds may or may
 * not be quoted. Returns null for anything that doesn't match rather than
 * throwing — malformed availability data should never crash the calendar.
 */
export function parseDuringRange(during: string): { start: Date; end: Date } | null {
  const match = /^[[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/.exec(during);
  if (!match) return null;
  const start = new Date(toIsoTimestamp(match[1]));
  const end = new Date(toIsoTimestamp(match[2]));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

function hourInManila(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: MANILA_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(date),
  );
}

/** Pure: a `during` range literal -> its start/end hour in Asia/Manila local time. */
export function occupiedHourRange(during: string): { startHour: number; endHour: number } | null {
  const parsed = parseDuringRange(during);
  if (!parsed) return null;
  return { startHour: hourInManila(parsed.start), endHour: hourInManila(parsed.end) };
}

/** Pure: a day's occupied hour ranges -> its calendar status against the venue's opening window. */
export function computeDayStatus(
  occupiedRanges: Array<{ startHour: number; endHour: number }>,
  openingHour: number,
  closingHour: number,
): DayStatus {
  if (occupiedRanges.length === 0) return 'available';
  const totalHours = occupiedRanges.reduce((sum, r) => sum + Math.max(0, r.endHour - r.startHour), 0);
  return totalHours >= closingHour - openingHour ? 'fully-booked' : 'partial';
}

/** Pure: does a proposed start/duration overlap any already-occupied range? */
export function hasTimeConflict(
  occupiedRanges: Array<{ startHour: number; endHour: number }>,
  startHour: number,
  durationHours: number,
): boolean {
  const endHour = startHour + durationHours;
  return occupiedRanges.some((r) => startHour < r.endHour && endHour > r.startHour);
}

/**
 * Pure: an ESTIMATE only, mirroring the server's booking_price() formula
 * (base_fee + extension_hourly * hours-over-6 for standard venues,
 * hourly_rate * duration for hourly venues). The authoritative fee comes
 * back from submit_booking's own return value — this is display-only.
 *
 * `rehearsalHourlyRate` exists because DB layer l55 moved rehearsal pricing
 * OUT of `public_booking_venue_rates`: `hourly_rate` is now null on both
 * `rehearsal_practice` rows, and the real figure lives in
 * `public_booking_rehearsal_rates`, keyed on the selected rehearsal rate type
 * and independent of `rate_tier`. Before this parameter existed, the null
 * `hourly_rate` fell through and every rehearsal booking displayed no estimate
 * at all while still asking the citizen to accept terms on the amount.
 *
 * It is checked before `rate.hourly_rate` so that if a future migration
 * restores a value to that column, the rehearsal-specific rate still wins.
 */
export function estimateVenueFee(
  rate:
    | { base_fee: number | null; extension_hourly: number | null; hourly_rate: number | null; requires_quote: boolean }
    | undefined,
  durationHours: number,
  rehearsalHourlyRate?: number | null,
): FeeEstimate {
  if (!rate) return { amount: null, requiresQuote: false };
  if (rate.requires_quote) return { amount: null, requiresQuote: true };
  if (rehearsalHourlyRate != null) {
    return { amount: rehearsalHourlyRate * durationHours, requiresQuote: false };
  }
  if (rate.hourly_rate != null) return { amount: rate.hourly_rate * durationHours, requiresQuote: false };
  if (rate.base_fee != null) {
    const ext = Math.max(0, durationHours - 6) * (rate.extension_hourly ?? 0);
    return { amount: rate.base_fee + ext, requiresQuote: false };
  }
  return { amount: null, requiresQuote: false };
}

/**
 * Pure: a fee estimate -> the downpayment it implies, as `booking_money()`
 * computes it: `round(total * pct / 100, 2)`. Display-only, like
 * `estimateVenueFee` — the authoritative figure is the one the server returns.
 */
export function estimateDownpayment(fee: FeeEstimate, downpaymentPct: number): FeeEstimate {
  if (fee.amount == null) return { amount: null, requiresQuote: fee.requiresQuote };
  return {
    amount: Math.round(fee.amount * downpaymentPct) / 100,
    requiresQuote: false,
  };
}

/**
 * Pure: the server's booking `status` -> the next wizard stage. Used after
 * `submit_booking`, and again after `give_up_tier_claim`.
 *
 * Status alone decides, because since DB l77b (SCRUM-198) it says whose turn
 * it is. `bk_on_submit()` parks every discounted booking — Full Facility
 * included — in `pending` until its organisation document is uploaded, so a
 * discounted booking can no longer reach a payment screen before its Tier
 * Claim is decided.
 */
export function nextStageAfterSubmit(status: string): PostSubmitStage {
  if (status === 'pending') return 'org-document';
  if (status === 'awaiting_tier_review') return 'tier-review';
  return status === 'awaiting_quote' ? 'quote' : 'payment';
}
