import { MANILA_TIME_ZONE } from "@/shared/dates/manila";

/**
 * Where a running clock stands against its deadline, in one vocabulary for
 * two deadlines (the database's `CONTEXT.md`, § Processing time: At Risk,
 * Overdue; and its Confirmation Deadline entry):
 *
 * - the Yellow Card's Processing Deadline,
 *   `staff_yellow_card_queue.deadline_state` (DB layer l80);
 * - a Booking's Confirmation Deadline, `staff_bookings.deadline_state`
 *   (DB layer l121, SCRUM-131).
 *
 * Both desks read urgency in the same words and colours, so it lives here
 * rather than in either feature.
 *
 * Nothing here computes the state. The database does, in Working Time: that
 * needs Office Hours, Holidays and the time banked before a pause, and a copy
 * of those rules here would drift the first time a Holiday is added. This is
 * the opposite of the incident queue, whose calendar-time state
 * `deriveSlaState` computes in the browser — on purpose; the l80 header has
 * the reasoning.
 *
 * NULL means the clock is not running: the application is with the Citizen,
 * decided, or withdrawn; the Booking is on the organiser's turn, decided
 * (a `confirmed` one waiting on its balance included), or has no clock at all
 * (booking/lib/confirmation-clock.ts). It is not a state, so it is not a key
 * below.
 */
export type DeadlineState = "on_track" | "at_risk" | "overdue";

export const DEADLINE_STATE_LABELS: Record<DeadlineState, string> = {
  on_track: "On track",
  at_risk: "At risk",
  overdue: "Overdue",
};

/** The incident SLA_STATE_VARIANT colours, so amber means one thing everywhere. */
export const DEADLINE_STATE_VARIANT: Record<DeadlineState, "info" | "warning" | "destructive"> = {
  on_track: "info",
  at_risk: "warning",
  overdue: "destructive",
};

/**
 * The view types the column as `string`. A value outside the vocabulary means
 * the view changed under the portal; throwing beats rendering "no state",
 * which would hide the very warning the column exists for.
 *
 * `view` names the read in the error, so it sends the reader to the right
 * migration. It is required: each caller names the view it read.
 */
export function parseDeadlineState(
  value: string | null,
  view: "staff_yellow_card_queue" | "staff_bookings",
): DeadlineState | null {
  if (value === null) return null;
  if (Object.hasOwn(DEADLINE_STATE_LABELS, value)) return value as DeadlineState;
  throw new Error(`${view} returned an unknown deadline_state: ${value}`);
}

/**
 * A deadline — the Processing Deadline, or a Booking's Confirmation Deadline —
 * as a Manila date and time. Pinned to Asia/Manila
 * rather than the browser's zone: the deadline is the city's, and a laptop
 * set to another zone must not move it.
 */
export function formatDeadline(dueAt: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dueAt));
}
