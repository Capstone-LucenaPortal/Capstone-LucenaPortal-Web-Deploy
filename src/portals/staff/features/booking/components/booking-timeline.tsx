import { formatDateTime } from "@/portals/staff/lib/utils";
import { labelForEvent } from "../lib/status";
import type { BookingEvent } from "../types";

/**
 * What has happened to this booking, oldest first.
 *
 * The events arrive in that order from the query — the order they happened in
 * and the order the timeline reads in — and nothing is re-sorted here.
 *
 * No cycle separators: bookings do not reopen, and `booking_events` has no
 * `cycle_number` at all. Copying the incidents timeline wholesale would not
 * compile, which is the useful kind of difference.
 *
 * Every label goes through `labelForEvent`, never a direct index into
 * EVENT_LABELS. `booking_events.event_type` is `text` with no check constraint
 * and no enum, so a value this repo has never seen is reachable without anyone
 * touching this file — and a blank cell in a history is worse than an
 * imperfect label.
 */
export function BookingTimeline({ events }: { events: BookingEvent[] }) {
  if (events.length === 0) {
    return (
      /* Not "broken" — most of the sandbox's bookings were direct-inserted
         rather than submitted through the real flow, so they genuinely have no
         history. Delete the second sentence when those fixtures go. */
      <p className="text-sm text-gray-500">
        No history recorded for this booking. Bookings created before the event
        log existed have none.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-lucena-blue" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {labelForEvent(event.event_type)}
              <span className="font-normal text-gray-500">
                {" "}
                · {event.actor_name} ({event.actor_role})
              </span>
            </p>
            {event.note && <p className="text-sm text-gray-600">{event.note}</p>}
            <p className="text-xs text-gray-500">
              {formatDateTime(event.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
