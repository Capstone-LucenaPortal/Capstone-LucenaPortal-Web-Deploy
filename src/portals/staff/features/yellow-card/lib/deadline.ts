import { MANILA_TIME_ZONE } from "@/shared/dates/manila";

/**
 * Where a running application stands against its Processing Deadline
 * (CONTEXT.md § Processing time: At Risk, Overdue).
 *
 * Nothing here computes it. The database does, in Working Time, as
 * `staff_yellow_card_queue.deadline_state` (DB layer l80): that needs Office
 * Hours, Holidays and the time banked before a pause, and a copy of those
 * rules here would drift the first time a Holiday is added. This is the
 * opposite of the incident queue, whose calendar-time state `deriveSlaState`
 * computes in the browser — on purpose; the l80 header has the reasoning.
 *
 * NULL means the clock is not running: the application is with the Citizen,
 * decided, or withdrawn. It is not a state, so it is not a key below.
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
 */
export function parseDeadlineState(value: string | null): DeadlineState | null {
  if (value === null) return null;
  if (Object.hasOwn(DEADLINE_STATE_LABELS, value)) return value as DeadlineState;
  throw new Error(`staff_yellow_card_queue returned an unknown deadline_state: ${value}`);
}

/**
 * The Processing Deadline as a Manila date and time. Pinned to Asia/Manila
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
