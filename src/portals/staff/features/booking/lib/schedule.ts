import { MANILA_TIME_ZONE } from "@/shared/dates/manila";

export function getEndTime(startTime: string, durationHours: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + durationHours * 60;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

export type HoldState =
  /** No hold on this booking — it is past the payment stage, or was never in it. */
  | { kind: "none" }
  /** The organiser still has time to pay. */
  | { kind: "running"; hoursLeft: number }
  /**
   * The window has closed and the booking is still awaiting payment. This is
   * not a guess: submit_downpayment raises 42501 — "the payment window for %
   * closed on %" — so the organiser genuinely cannot pay any more, and only
   * sweep_expired_holds (or a staff rejection) can move the booking on.
   */
  | { kind: "expired" };

/**
 * The statuses for which a hold still means something: the booking is alive and
 * has not yet been committed, so the slot is reserved and the clock is real.
 *
 * Past this set the countdown is noise at best and a lie at worst. `confirmed`
 * and later have their hold_expires_at nulled by verify_payment, but
 * reject_booking leaves it in place — so a booking cancelled BEFORE its hold
 * lapsed would otherwise keep counting down a window nobody can pay into.
 * Checking the status rather than trusting the column covers both.
 */
const HOLD_RELEVANT_STATUSES = new Set([
  "pending",
  // The Revision Request's deadline (l77b). awaiting_tier_review is NOT here:
  // it has no Hold — staff time never costs the organiser their date.
  "awaiting_resubmission",
  "awaiting_quote",
  "awaiting_payment",
  "payment_verification",
]);

/**
 * What the hold on a booking means right now.
 *
 * Pure, and takes `now` explicitly so the page passes `new Date()` and the test
 * passes a fixed instant. A countdown computed inside the component would be
 * untestable and would silently disagree with the server's clock.
 */
export function describeHold(
  holdExpiresAt: string | null,
  status: string,
  now: Date,
): HoldState {
  if (!holdExpiresAt) return { kind: "none" };
  if (!HOLD_RELEVANT_STATUSES.has(status)) return { kind: "none" };

  const expiry = new Date(holdExpiresAt);
  if (Number.isNaN(expiry.getTime())) return { kind: "none" };

  const msLeft = expiry.getTime() - now.getTime();
  if (msLeft > 0) {
    return { kind: "running", hoursLeft: Math.ceil(msLeft / 3_600_000) };
  }

  // A lapsed hold only means something while the booking is still waiting on
  // the organiser — the statuses sweep_expired_holds cancels. BK-2026-000021
  // carries one on an `awaiting_quote` row and the sweep deliberately spares
  // it — decision 8 makes slow quoting a staff problem, not a reason to drop
  // the citizen's reservation.
  return SWEPT_STATUSES.has(status) ? { kind: "expired" } : { kind: "none" };
}

/** What sweep_expired_holds cancels once the Hold lapses (l77b). */
const SWEPT_STATUSES = new Set([
  "pending",
  "awaiting_resubmission",
  "awaiting_payment",
]);

/**
 * How long something has been waiting, as the queue says it: whole days once
 * a day has passed, whole hours before that. Used for a Tier Claim's age in
 * Needs Action, measured from `tier_review_since`.
 *
 * Pure, and takes `now` explicitly, as describeHold does (ADR-0005).
 */
export function describeWait(since: string | null, now: Date): string | null {
  if (!since) return null;
  const start = new Date(since);
  if (Number.isNaN(start.getTime())) return null;

  const hours = Math.floor((now.getTime() - start.getTime()) / 3_600_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (hours >= 1) return hours === 1 ? "1 hour" : `${hours} hours`;
  return "under an hour";
}

/**
 * A `YYYY-MM-DD` event date with its weekday. Both the midnight and the
 * formatter are Manila's, so the day cannot shift with the host zone.
 * `+08:00` is MANILA_TIME_ZONE's offset, fixed because Manila has no DST.
 */
export function formatEventDay(date: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00+08:00`));
}
