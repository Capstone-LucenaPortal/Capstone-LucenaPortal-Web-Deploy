import Link from "next/link";
import { cn } from "@/portals/staff/lib/utils";
import { BookingQueue } from "@/portals/staff/features/booking/components/booking-queue";
import { BookingCalendar } from "@/portals/staff/features/booking/components/booking-calendar";
import {
  getBalanceOutstanding,
  getBookingCalendar,
  getBookingQueue,
  getBookingStatusCounts,
} from "@/portals/staff/features/booking/lib/queries";
import { getBookingConfig } from "@/portals/staff/features/booking/lib/config";
import {
  buildCalendarHref,
  buildQueueHref,
  parseMonth,
  parseStatusFilter,
  parseView,
} from "@/portals/staff/features/booking/lib/queue-params";
import {
  buildMonthGrid,
  monthGridBounds,
  toBlocks,
} from "@/portals/staff/features/booking/lib/calendar";
import {
  needsActionCount,
  STATUS_ORDER,
} from "@/portals/staff/features/booking/lib/status";

export default async function BookingQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    view?: string;
    month?: string;
  }>;
}) {
  const params = await searchParams;
  const view = parseView(params.view);
  // The only `new Date()` on this screen. Every calendar function below takes
  // it explicitly, which is what makes them testable.
  const now = new Date();
  const { year, month } = parseMonth(params.month, now);

  /*
    Exactly one of these runs. The calendar month and the queue filter answer
    different questions, and running both would double the work for whichever
    one nobody is looking at.

    Both are awaited HERE rather than inside a nested async component: an async
    child is a server-only construct that never resolves under the test
    renderer, so the whole screen would be untestable.
  */
  const body =
    view === "calendar"
      ? await renderCalendar(year, month, now)
      : await renderList(params.status, params.q ?? "", now);

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-lucena-blue">
            Convention Center Bookings
          </h1>
          <p className="mt-2 text-gray-500">Manage event bookings and schedules</p>
        </div>
        {/*
          Both halves are links now, not buttons. Switching to the calendar
          deliberately DROPS the status filter and the search term — neither has
          a meaning on a grid — and switching back lands on an unfiltered list.
        */}
        <nav className="flex overflow-hidden rounded-md border border-gray-300">
          <ViewLink href={buildQueueHref({ status: "all" })} active={view === "list"}>
            List
          </ViewLink>
          <ViewLink
            href={buildCalendarHref({ year, month })}
            active={view === "calendar"}
            className="border-l border-gray-300"
          >
            Calendar
          </ViewLink>
        </nav>
      </div>

      <div className="mt-6">{body}</div>
    </div>
  );
}

async function renderList(
  status: string | undefined,
  search: string,
  now: Date,
) {
  const filter = parseStatusFilter(status);

  const [bookings, counts, balanceOutstanding] = await Promise.all([
    getBookingQueue({ status: filter, search }),
    getBookingStatusCounts(),
    getBalanceOutstanding(),
  ]);

  const total = STATUS_ORDER.reduce((sum, s) => sum + counts[s], 0);

  return (
    <BookingQueue
      bookings={bookings}
      counts={counts}
      // Folded from the counts above rather than read again. Two reads of one
      // set can disagree; a fold of the set the tabs already show cannot.
      needsActionCount={needsActionCount(counts)}
      balanceOutstanding={balanceOutstanding}
      filter={filter}
      search={search}
      total={total}
      now={now}
    />
  );
}

async function renderCalendar(year: number, month: number, now: Date) {
  // The read covers every day the grid draws, padded days included. How far the
  // padding reaches is the calendar module's to know — it is the module that
  // pads — and asking rather than restating is what keeps this route from
  // holding a second, stale copy of that rule. The reason it matters is written
  // once, above monthGridBounds.
  const { from, to } = monthGridBounds(year, month);

  const [bookings, config] = await Promise.all([
    getBookingCalendar(from, to),
    getBookingConfig(),
  ]);

  const blocks = toBlocks(bookings);
  const grid = buildMonthGrid(year, month, blocks, now, {
    openingHour: config.opening_hour,
    closingHour: config.closing_hour,
  });

  const current = parseMonth(undefined, now);

  return (
    <BookingCalendar
      year={year}
      month={month}
      grid={grid}
      unplaced={blocks.filter((b) => b.space === null)}
      todayHref={buildCalendarHref(current)}
    />
  );
}

function ViewLink({
  href,
  active,
  className,
  children,
}: {
  href: string;
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "px-3 py-2 text-sm font-medium",
        active
          ? "bg-lucena-blue text-white"
          : "bg-white text-gray-700 hover:bg-gray-50",
        className,
      )}
    >
      {children}
    </Link>
  );
}
