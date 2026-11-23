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

/** The hours an Occupancy holds its Space on a day, counted from that day's midnight. */
export type HourRange = { startHour: number; endHour: number };

function hourInManila(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: MANILA_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(date),
  );
}

/**
 * Pure: an availability row -> the hours its Occupancy holds the Space, from
 * the Event's start to the end of its `blocked` range: the Event plus the
 * Changeover that Booking recorded (DB l117). The end is counted from the
 * start, so a Changeover running past midnight reads as 25, 26… rather than
 * wrapping to the small hours.
 *
 * A row without `blocked` falls back to the Event range, so the calendar
 * still shows every Booking if this Web build reaches a database l117 hasn't.
 */
export function occupancyHours(row: { during: string; blocked?: string | null }): HourRange | null {
  const parsed = parseDuringRange(row.blocked ?? row.during);
  if (!parsed) return null;
  const startHour = hourInManila(parsed.start);
  const hours = (parsed.end.getTime() - parsed.start.getTime()) / 3_600_000;
  return { startHour, endHour: startHour + hours };
}

/**
 * Pure: a day's Occupancies -> its calendar status for one Venue.
 *
 * Full means no start on the hour can fit the minimum duration once
 * Changeovers are counted (SCRUM-261): the Event must end by closing, and
 * neither it nor its own Changeover may clash. Its Changeover may run past
 * closing, as the database allows. Booked hours alone don't decide it: seven
 * held hours in the middle of the day can leave no room for a six-hour Event.
 */
export function computeDayStatus(
  occupiedRanges: HourRange[],
  dayHours: { openingHour: number; closingHour: number; minDurationHours: number; changeoverHours: number },
): DayStatus {
  if (occupiedRanges.length === 0) return 'available';
  const { openingHour, closingHour, minDurationHours, changeoverHours } = dayHours;
  for (let start = openingHour; start + minDurationHours <= closingHour; start++) {
    if (!hasTimeConflict(occupiedRanges, start, minDurationHours, changeoverHours)) return 'partial';
  }
  return 'fully-booked';
}

/**
 * Pure: does a proposed Booking clash with any Occupancy already on the day?
 *
 * Each Occupancy runs to its blocked end (`occupancyHours`). The proposed
 * Booking holds the Space for its Event plus `changeoverHours`, the setting in
 * force now, which is what it would record. So the rule works both ways, as
 * the database's EXCLUDE on `blocked` does (DB l117): a start inside another
 * Event's Changeover clashes, and so does a time whose own Changeover would
 * run into a later Event.
 */
export function hasTimeConflict(
  occupiedRanges: HourRange[],
  startHour: number,
  durationHours: number,
  changeoverHours = 0,
): boolean {
  const blockedEnd = startHour + durationHours + changeoverHours;
  return occupiedRanges.some((r) => startHour < r.endHour && blockedEnd > r.startHour);
}

/**
 * Pure: the warning for a time that clashes once Changeovers are counted.
 * The form and the translated `submit_booking` refusal say the same thing.
 */
export function changeoverClashMessage(changeoverHours: number): string {
  return `This time is too close to another event. The LCC needs ${changeoverHours} hour(s) between events to reset the venue.`;
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
