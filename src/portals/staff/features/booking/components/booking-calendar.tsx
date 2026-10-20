import Link from "next/link";
import { buildCalendarHref, shiftMonth } from "../lib/queue-params";
import { SPACE_LABELS, SPACE_ORDER } from "../lib/venue-spaces";
import { CalendarDay } from "./calendar-day";
import type { CalendarBlock, DayCell } from "../lib/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * A month of what is actually happening at the Convention Center.
 *
 * A server component: it renders what it is handed, and every action on it is
 * a link. The calendar reads and never writes — rescheduling would need an RPC
 * that does not exist, and bk_sync_occupancy returns early on any UPDATE that
 * is not a cancellation, so moving a booking today would leave its old
 * occupancy row in place and silently double-book the venue.
 *
 * ⚠️ `month` is 1-INDEXED throughout, matching monthBounds and buildMonthGrid.
 */
export function BookingCalendar({
  year,
  month,
  grid,
  unplaced,
  todayHref,
}: {
  year: number;
  month: number;
  grid: DayCell[][];
  /** Blocks whose venue this calendar does not recognise. Should be empty. */
  unplaced: CalendarBlock[];
  todayHref: string;
}) {
  const previous = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const hasAnyBooking = grid.flat().some((day) => day.blocks.length > 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <nav className="flex items-center gap-2">
          <Link
            href={buildCalendarHref(previous)}
            rel="prev"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← {MONTH_NAMES[previous.month - 1]}
          </Link>
          <Link
            href={todayHref}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Today
          </Link>
          <Link
            href={buildCalendarHref(next)}
            rel="next"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {MONTH_NAMES[next.month - 1]} →
          </Link>
        </nav>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">
            Convention Center bookings for {MONTH_NAMES[month - 1]} {year}, with
            one lane per physical space.
          </caption>
          <thead>
            <tr>
              {WEEKDAYS.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-500"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((week) => (
              <tr key={week[0].date}>
                {week.map((day) => (
                  <CalendarDay key={day.date} day={day} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!hasAnyBooking && (
        /* "Clear", not "no results" — nobody searched for anything. */
        <p className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Nothing is booked at the Convention Center in{" "}
          {MONTH_NAMES[month - 1]} {year}. Both spaces are clear all month.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
        <span className="font-medium uppercase tracking-wide text-gray-500">
          Lanes
        </span>
        {SPACE_ORDER.map((space) => (
          <span key={space}>{SPACE_LABELS[space]}</span>
        ))}
        <span className="font-medium uppercase tracking-wide text-gray-500">
          Lane status
        </span>
        <LegendDot className="bg-green-400" label="free" />
        <LegendDot className="bg-yellow-400" label="part-booked" />
        <LegendDot className="bg-red-400" label="fully booked" />
        <span>
          A booking marked “both spaces” is one Full Facility booking occupying
          both lanes, not two bookings.
        </span>
      </div>

      {/*
        This strip should always be empty. It exists so that the day it is not
        — because Super Staff added a fifth venue and booking_venue_space_map
        has no public view for venue-spaces.ts to follow — somebody sees the
        rows instead of losing them.
      */}
      {unplaced.length > 0 && (
        <section className="mt-6 rounded-md border border-yellow-300 bg-yellow-50 p-4">
          <h3 className="text-sm font-semibold text-yellow-900">
            Bookings at a venue this calendar does not recognise
          </h3>
          <ul className="mt-2 space-y-1">
            {unplaced.map((block) => (
              <li key={`${block.bookingId}-unplaced`} className="text-sm">
                <Link
                  href={`/staff/booking/${block.bookingId}`}
                  className="font-medium text-lucena-blue hover:underline"
                >
                  {block.reference}
                </Link>{" "}
                <span className="text-yellow-900">
                  {block.title} · {block.venueLabel} · {block.date}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${className}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
