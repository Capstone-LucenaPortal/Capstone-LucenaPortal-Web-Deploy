import { formatDateTime } from "@/portals/staff/lib/utils";
import { EVENT_LABELS } from "../lib/status";
import type { IncidentEvent } from "../types";

/**
 * The events are already oldest-first from the query — that is the order they
 * happened in and the order the timeline reads in. Nothing is re-sorted here.
 *
 * A cycle separator only appears when there is more than one cycle. Twenty-four
 * of the sandbox's twenty-five incidents have exactly one, and a "cycle 1"
 * heading on all of them would be a label that never distinguishes anything.
 */
export function IncidentTimeline({ events }: { events: IncidentEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-500">No activity yet.</p>;
  }

  const multiCycle = new Set(events.map((e) => e.cycle_number)).size > 1;

  return (
    <ol className="space-y-4">
      {events.map((event, index) => {
        const startsCycle =
          multiCycle &&
          (index === 0 || events[index - 1].cycle_number !== event.cycle_number);

        return (
          <li key={event.id}>
            {startsCycle && event.cycle_number > 1 && (
              <p className="mb-3 border-t border-gray-200 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Reopened — cycle {event.cycle_number}
              </p>
            )}
            <div className="flex gap-3">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-lucena-blue" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {EVENT_LABELS[event.event_type]}
                  <span className="font-normal text-gray-500">
                    {" "}
                    · {event.actor_name} ({event.actor_role})
                  </span>
                </p>
                {event.note && (
                  <p className="text-sm text-gray-600">{event.note}</p>
                )}
                <p className="text-xs text-gray-500">
                  {formatDateTime(event.created_at)}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
