import { Badge } from "@/portals/staff/components/ui/badge";
import { DeadlineBadge } from "@/portals/staff/components/deadline-badge";
import { formatDeadline } from "@/portals/staff/lib/deadline";
import type { ConfirmationClock } from "../lib/confirmation-clock";

/**
 * The detail page's account of the Confirmation Deadline. Which case applies
 * is `readConfirmationClock`'s call; this is only the copy for each.
 *
 * A running clock says On track too, where the queue's marker does not: this
 * is the page staff open to tell an organiser where the booking stands.
 */
export function ConfirmationDeadline({ clock }: { clock: ConfirmationClock }) {
  if (clock.kind === "none") return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Confirmation Deadline
      </p>
      <div className="mt-1 text-sm text-gray-700">
        {clock.kind === "running" &&
          (clock.state ? (
            <DeadlineBadge state={clock.state} dueAt={clock.dueAt} />
          ) : (
            // The state front answers NULL to a caller it does not serve
            // (l121); the deadline is still the booking's own.
            <p>Due {formatDeadline(clock.dueAt)}</p>
          ))}
        {clock.kind === "paused" && (
          // No word about the clock running again: a booking with no clock
          // reaches this case too, and its clock never starts.
          <p>None while it is the organiser&apos;s turn.</p>
        )}
        {clock.kind === "decided" &&
          (clock.onTime ? (
            <Badge variant="success">Decided on time</Badge>
          ) : (
            <Badge variant="destructive">Decided late</Badge>
          ))}
        {clock.kind === "unscored" && (
          <p>
            Not scored: the booking ended on the organiser&apos;s side, not by a
            decision of this desk.
          </p>
        )}
      </div>
    </div>
  );
}
