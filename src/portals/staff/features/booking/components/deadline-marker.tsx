import { DeadlineBadge } from "@/portals/staff/components/deadline-badge";
import type { DeadlineState } from "@/portals/staff/lib/deadline";

/**
 * A Needs Action row's warning against its Confirmation Deadline
 * (SCRUM-131, S3-13): At risk or Overdue, with the deadline underneath.
 *
 * It is the shared DeadlineBadge the Yellow Card queue uses too, not a copy
 * of it, so the two desks read urgency in the same words and colours — and
 * stay that way.
 *
 * Nothing here decides whether the clock is running. `state` is
 * `staff_bookings.deadline_state`, which the database computes in Working
 * Time (DB l121); it is null for a booking off the clock — the organiser's
 * turn, a `confirmed` booking waiting on its balance, a decided one, or one
 * with no clock at all — and the marker takes its word.
 *
 * On track is left unsaid. Needs Action already lists every booking waiting on
 * the desk; the marker's job is to say which to clear first, and the detail
 * page shows the deadline itself.
 */
export function BookingDeadlineMarker({
  state,
  dueAt,
}: {
  state: DeadlineState | null;
  dueAt: string | null;
}) {
  if (state !== "at_risk" && state !== "overdue") return null;

  return <DeadlineBadge state={state} dueAt={dueAt} />;
}
