import Link from "next/link";
import { LinkTabs } from "@/portals/staff/components/ui/link-tabs";
import { QueueActivityBar } from "@/portals/staff/components/queue/queue-activity-bar";
import { countNeedsAction } from "../lib/actions";
import { STATUS_LABELS, STATUS_ORDER } from "../lib/status";
import {
  buildQueueHref,
  NEEDS_ACTION,
  type StatusFilter,
} from "../lib/queue-params";
import { formatCurrency } from "../lib/money";
import { getOrganizer } from "../lib/get-organizer";
import { describeWait, getEndTime } from "../lib/schedule";
import { BookingStatusBadge } from "./booking-status-badge";
import { RateTierBadge } from "./rate-tier-badge";
import type { BookingQueueItem, BookingStatus } from "../types";

interface BookingQueueProps {
  bookings: BookingQueueItem[];
  counts: Record<BookingStatus, number>;
  needsActionCount: number;
  /** Pesos still owed across every `confirmed` booking, whole-view. */
  balanceOutstanding: number;
  filter: StatusFilter;
  search: string;
  total: number;
  /** The route's one moment (ADR-0005) — a Tier Claim's age is measured to it. */
  now: Date;
}

/**
 * The queue, as a server component.
 *
 * It used to hold its filter in useState and sort client-side, which meant it
 * could only order and count rows it had already been handed. The filter now
 * lives in the URL, the query runs in SQL, and the four summary figures are
 * whole-view numbers that do not change when somebody clicks a tab.
 */
export function BookingQueue({
  bookings,
  counts,
  needsActionCount,
  balanceOutstanding,
  filter,
  search,
  total,
  now,
}: BookingQueueProps) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard value={needsActionCount} label="Needs action" />
        <SummaryCard value={counts.awaiting_payment} label="Awaiting payment" />
        <SummaryCard
          value={counts.confirmed + counts.fully_paid}
          label="Confirmed events"
        />
        {/* The only one of the four that is pesos rather than a count, so the
            label says so — nobody should read ₱69,750.00 as a row count. */}
        <SummaryCard
          value={formatCurrency(balanceOutstanding)}
          label="Balance outstanding (₱)"
        />
      </div>

      {/* A GET form, so the search term lands in the URL where the server read
          can see it. The status is carried as a hidden field or the current tab
          is lost on submit. */}
      <form method="get" action="/staff/booking" className="mt-6 flex max-w-md gap-2">
        {filter !== "all" && <input type="hidden" name="status" value={filter} />}
        <input
          type="text"
          name="q"
          aria-label="Search bookings"
          defaultValue={search}
          placeholder="Search by reference, event, organiser, or contact..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-lucena-blue px-4 text-sm font-medium text-white hover:bg-lucena-blue-dark"
        >
          Search
        </button>
      </form>

      {/* "Needs action" leads, because its three statuses are not adjacent in
          the pipeline and no ordering of plain tabs surfaces them together. */}
      <LinkTabs
        activeValue={filter}
        trailing={
          /*
            The baseline is folded from the status counts this page already
            fetched — the very figure the sentinel tab shows — and the poll is a
            separate head-only query. Both key off NEEDS_ACTION_STATUSES, which
            is what keeps the two figures from drifting. Whole-view, like every
            other figure on this screen.

            "more waiting", where the other two queues say "new". Needs Action
            is a BACKLOG: a booking joins it when a colleague verifies a payment
            across the room, which is new work but not a new booking, so "new"
            would tell the clerk a citizen submitted something. And this badge
            sits in the same row as that tab's whole-view level for the same
            set — "Needs action (12) … 3 more waiting" is a level and a delta,
            and "more" is the word that makes the second legible as a delta on
            the first rather than as a rival total.
          */
          <QueueActivityBar
            count={needsActionCount}
            countAction={countNeedsAction}
            noun="more waiting"
          />
        }
        options={[
          {
            value: NEEDS_ACTION,
            label: "Needs action",
            count: needsActionCount,
            href: buildQueueHref({ status: NEEDS_ACTION, search }),
          },
          {
            value: "all",
            label: "All",
            count: total,
            href: buildQueueHref({ status: "all", search }),
          },
          ...STATUS_ORDER.map((status) => ({
            value: status,
            label: STATUS_LABELS[status],
            count: counts[status],
            href: buildQueueHref({ status, search }),
          })),
        ]}
      />

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Reference</th>
              <th className="px-4 py-3 font-medium text-gray-500">Organiser</th>
              <th className="px-4 py-3 font-medium text-gray-500">Event</th>
              <th className="px-4 py-3 font-medium text-gray-500">Venue</th>
              <th className="px-4 py-3 font-medium text-gray-500">Date &amp; Time</th>
              <th className="px-4 py-3 font-medium text-gray-500">Fee</th>
              <th className="px-4 py-3 font-medium text-gray-500">Tier</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr
                key={booking.id}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {booking.reference_number}
                </td>
                <td className="px-4 py-3 text-gray-700">{getOrganizer(booking)}</td>
                <td className="px-4 py-3 text-gray-700">{booking.event_title}</td>
                {/* Venue replaces the mock's Type column: which venue is booked
                    is the fact a scheduler needs, and the event type is a
                    detail of the detail page. */}
                <td className="px-4 py-3 text-gray-700">{booking.venue_label}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                  {booking.event_date}
                  <span className="block text-xs text-gray-500">
                    {booking.start_time.slice(0, 5)}–
                    {getEndTime(booking.start_time, booking.duration_hours)}
                  </span>
                </td>
                {/* An unpriced booking shows an em dash, never ₱0.00. */}
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                  {formatCurrency(booking.total_fee)}
                </td>
                <td className="px-4 py-3">
                  <RateTierBadge
                    tier={booking.rate_tier}
                    verified={booking.tier_verified}
                  />
                </td>
                <td className="px-4 py-3">
                  <BookingStatusBadge
                    status={booking.status}
                    cancellationReason={booking.cancellation_reason}
                  />
                  <WhoseTurn booking={booking} now={now} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/staff/booking/${booking.id}`}
                    className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md bg-lucena-blue px-3 text-sm font-medium text-white hover:bg-lucena-blue-dark"
                  >
                    {actionLabel(booking.status)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bookings.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            No bookings match this filter.
          </p>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-500">
        Showing {bookings.length} of {total} bookings
      </p>
    </div>
  );
}

/**
 * The link's label names what the operator is here to do. It follows the same
 * three statuses NEEDS_ACTION_STATUSES names, for the same reason.
 */
function actionLabel(status: BookingStatus): string {
  if (status === "awaiting_tier_review") return "Review Tier Claim";
  if (status === "awaiting_quote") return "Quote";
  if (status === "payment_verification") return "Review payment";
  if (status === "confirmed") return "Record balance";
  return "View";
}

/**
 * The line under a Tier Review status (SCRUM-198). A claim in Tier Review has
 * no Hold — it keeps its slot however long the desk takes — so its age is the
 * only pressure on the desk, and it is shown. A Revision Request waits on the
 * organiser, which the badge alone does not say.
 *
 * `tier_review_since` is a stamp, not a state (l77b): it is not cleared on
 * leaving Tier Review, so it is read only beside that status.
 */
function WhoseTurn({ booking, now }: { booking: BookingQueueItem; now: Date }) {
  if (booking.status === "awaiting_tier_review") {
    const wait = describeWait(booking.tier_review_since, now);
    if (!wait) return null;
    return <span className="mt-1 block text-xs text-gray-500">Waiting {wait}</span>;
  }
  if (booking.status === "awaiting_resubmission") {
    return (
      <span className="mt-1 block text-xs text-gray-500">Waiting on organiser</span>
    );
  }
  return null;
}

function SummaryCard({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}
