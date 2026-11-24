import type { DeadlineState } from "@/portals/staff/lib/deadline";
import type { Booking, BookingStatus } from "../types";

/**
 * Where a Booking stands against its Confirmation Deadline (SCRUM-131, S3-13),
 * as the detail page says it.
 *
 * Every fact is the database's (DB l121) — the deadline, the state and the
 * verdict all arrive on `staff_bookings`, and nothing here measures time. What
 * this decides is only which of five things the page says:
 *
 * - `running`: the city's turn. `confirmation_due_at` is non-null exactly
 *   while the clock runs, so it is the test, and `state` comes with it.
 * - `decided` / `unscored`: the clock stopped. `sla_scoreable` is set at the
 *   stop and never before; the verdict exists only on a scoreable one.
 * - `paused`: the organiser's turn. A paused Booking has NO Confirmation
 *   Deadline — the moment the organiser comes back is not known (ruled by the
 *   owner in l121's review, 2026-11-24) — so there is no date to show.
 * - `none`: no clock to speak of, e.g. a booking the backfill could not replay
 *   sitting in a city's-turn status. Nothing is claimed.
 *
 * ⚠️ The view does not expose the banked time or the target, so a paused
 * clock and a booking with no clock look the same in the organiser's-turn
 * statuses. The page's sentence for `paused` is therefore one that is true of
 * both: whose turn it is, and that there is no deadline — never that a clock
 * will run again, which a booking without one never does.
 */
export type ConfirmationClock =
  | { kind: "running"; state: DeadlineState | null; dueAt: string }
  | { kind: "paused" }
  | { kind: "decided"; onTime: boolean }
  | { kind: "unscored" }
  | { kind: "none" };

/**
 * The organiser's turns, where the clock pauses (l121 header §1). Every status
 * answers, as in ./status.ts, so a status added to the enum is a compile error
 * here rather than a booking that silently claims no pause.
 */
const ORGANISERS_TURN: Record<BookingStatus, boolean> = {
  /** The Organisation Document upload. */
  pending: true,
  awaiting_tier_review: false,
  /** A Resubmission after a Revision Request. */
  awaiting_resubmission: true,
  awaiting_quote: false,
  /** The Hold: the organiser owes the downpayment. */
  awaiting_payment: true,
  payment_verification: false,
  confirmed: false,
  fully_paid: false,
  completed: false,
  cancelled: false,
};

export function readConfirmationClock(
  booking: Pick<
    Booking,
    "status" | "confirmation_due_at" | "deadline_state" | "sla_scoreable" | "sla_on_time"
  >,
): ConfirmationClock {
  if (booking.confirmation_due_at) {
    return {
      kind: "running",
      state: booking.deadline_state,
      dueAt: booking.confirmation_due_at,
    };
  }
  if (booking.sla_scoreable === true && booking.sla_on_time !== null) {
    return { kind: "decided", onTime: booking.sla_on_time };
  }
  if (booking.sla_scoreable === false) return { kind: "unscored" };
  if (ORGANISERS_TURN[booking.status]) return { kind: "paused" };
  return { kind: "none" };
}
