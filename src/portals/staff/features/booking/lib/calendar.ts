import { MANILA_TIME_ZONE } from "@/shared/dates/manila";
import { SPACE_ORDER, spacesForVenue, type SpaceCode } from "./venue-spaces";
import type { BookingQueueItem, BookingStatus } from "../types";

/**
 * The calendar maths. Every function here is pure and takes its month or its
 * `now` explicitly — that is the whole reason the calendar is testable, and it
 * is why no Date is ever constructed from a hardcoded string outside a test.
 *
 * `computeDayStatus` and `hasTimeConflict` are ported from
 * Capstone-LucenaPortal-EndUser/lccData.ts, where they are already tested.
 * Their comments came with them. Re-testing them here is not duplication: this
 * repo's copy can drift and these tests are what notices.
 *
 * `parseDuringRange` and `occupiedHourRange` are deliberately NOT ported. They
 * exist to decode a `tstzrange` literal from public_venue_availability, and
 * this calendar never reads one — it reads staff_bookings, where `event_date`
 * is a `date` and `start_time` a `time`, neither carrying a timezone. Nothing
 * converts them, so nothing can shift them.
 */

/**
 * The statuses that hold an occupancy row.
 *
 * bk_sync_occupancy deletes occupancy on exactly ONE transition: status ->
 * 'cancelled'. Everything else holds the slot, `completed` included. A calendar
 * that hid completed bookings would show a free evening that the EXCLUDE
 * constraint will refuse.
 *
 * This list is for reference and for the test that pins it. The filter below
 * is `!== "cancelled"`, not membership of this array — an allow-list goes stale
 * the day the enum grows another value, and the one status that releases a hold
 * is the thing actually worth naming.
 */
export const HOLDING_STATUSES: BookingStatus[] = [
  "pending",
  // An undecided Tier Claim keeps its slot however long the desk takes, and
  // a Revision Request keeps it until its Hold runs out (l77b, ADR 0002).
  "awaiting_tier_review",
  "awaiting_resubmission",
  "awaiting_quote",
  "awaiting_payment",
  "payment_verification",
  "confirmed",
  "fully_paid",
  "completed",
];

export interface CalendarBlock {
  bookingId: string;
  reference: string;
  title: string;
  venueLabel: string;
  status: BookingStatus;
  /** null when the venue is not in VENUE_SPACES. Rendered as unplaced. */
  space: SpaceCode | null;
  /** YYYY-MM-DD, Manila-local, straight off event_date. */
  date: string;
  startHour: number;
  endHour: number;
  /** True for a venue that consumes both spaces, so a block can say so. */
  spansBothSpaces: boolean;
}

export type DayStatus = "available" | "partial" | "fully-booked";

export interface DayCell {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  blocks: CalendarBlock[];
  statusBySpace: Record<SpaceCode, DayStatus>;
}

/** The stored opening window: 6–22 as of 2026-08-11. */
const DEFAULT_WINDOW = { openingHour: 6, closingHour: 22 };

/**
 * One block per (booking, space) pair — exactly the shape of
 * `booking_occupancies`, which is what makes "every occupancy row has exactly
 * one block on screen" a checkable claim rather than a hope.
 *
 * The status filter is `!== "cancelled"` rather than an allow-list over the
 * other seven, matching bk_sync_occupancy: one transition releases a hold and
 * everything else holds it.
 */
export function toBlocks(bookings: BookingQueueItem[]): CalendarBlock[] {
  const blocks: CalendarBlock[] = [];

  for (const booking of bookings) {
    if (booking.status === "cancelled") continue;

    const spaces = spacesForVenue(booking.venue_code);
    const startHour = Number.parseInt(booking.start_time.slice(0, 2), 10) || 0;

    const base = {
      bookingId: booking.id,
      reference: booking.reference_number,
      title: booking.event_title,
      venueLabel: booking.venue_label,
      status: booking.status,
      // No conversion. event_date is a `date` with no timezone, so it is
      // already Manila-local and stays that way.
      date: booking.event_date,
      startHour,
      // ⚠️ A booking that spans midnight would need a second block on the
      // following day. It cannot currently happen: start_time is bounded by
      // booking_config.closing_hour (22:00) and submit_booking refuses a
      // booking that would run past closing. If the closing hour is ever
      // removed, this is the line that has to change.
      endHour: startHour + booking.duration_hours,
      spansBothSpaces: spaces.length > 1,
    };

    if (spaces.length === 0) {
      // Unmapped venue. Kept and flagged rather than dropped or guessed at.
      blocks.push({ ...base, space: null });
      continue;
    }

    for (const space of spaces) {
      blocks.push({ ...base, space });
    }
  }

  return blocks;
}

/** Pure: a day's occupied hour ranges -> its status against the opening window. */
export function computeDayStatus(
  occupiedRanges: Array<{ startHour: number; endHour: number }>,
  openingHour: number,
  closingHour: number,
): DayStatus {
  if (occupiedRanges.length === 0) return "available";
  const totalHours = occupiedRanges.reduce(
    (sum, r) => sum + Math.max(0, r.endHour - r.startHour),
    0,
  );
  return totalHours >= closingHour - openingHour ? "fully-booked" : "partial";
}

/**
 * Pure: does a proposed start/duration overlap any already-occupied range?
 *
 * Half-open intervals — a booking ending at 14:00 and one starting at 14:00 do
 * NOT conflict, matching the '[)' bound bk_sync_occupancy builds its tstzrange
 * with.
 */
export function hasTimeConflict(
  occupiedRanges: Array<{ startHour: number; endHour: number }>,
  startHour: number,
  durationHours: number,
): boolean {
  const endHour = startHour + durationHours;
  return occupiedRanges.some((r) => startHour < r.endHour && endHour > r.startHour);
}

/**
 * The first and last date of a month, as the query wants them.
 *
 * ⚠️ 1-INDEXED month. buildMonthGrid uses the same convention. JavaScript's
 * Date is 0-indexed and mixing the two is the single most likely bug in this
 * file, which is why both are pinned by name in the tests.
 */
export function monthBounds(
  year: number,
  month: number,
): { from: string; to: string } {
  // Day 0 of the NEXT month is the last day of this one; passing month
  // unchanged into a 0-indexed constructor already means "next month".
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * The first and last date the month grid DRAWS, padding included.
 *
 * ⚠️ 1-INDEXED month, like monthBounds and buildMonthGrid.
 *
 * This is the range a read feeding the grid has to cover, and the reason it is
 * wider than monthBounds: the grid is built as whole weeks and keeps the blocks
 * that land on its padded days, because a booking on the 28th of the previous
 * month is real occupancy. A read bounded by the month itself would draw a free
 * evening on a booked padded day, which the occupancy constraint then refuses
 * at submit time — the exact failure the calendar exists to prevent.
 *
 * It is computed from the same padding convention buildMonthGrid draws with,
 * and the tests pin the two against each other. That is the point of the
 * function: one judgement about how far past a month the grid reaches, held in
 * the module that pads the grid, so a caller cannot keep a stale copy of it.
 */
export function monthGridBounds(
  year: number,
  month: number,
): { from: string; to: string } {
  const { start, end } = gridRange(year, month);
  return { from: isoDate(start), to: isoDate(end) };
}

/**
 * Whole weeks, Sunday-first: back up to the Sunday on or before the 1st,
 * forward to the Saturday on or after the last day.
 *
 * All arithmetic runs in UTC on date-only values, which have no timezone to
 * shift. Change the padding convention here and both the grid and the range
 * that feeds it follow.
 */
function gridRange(year: number, month: number): { start: Date; end: Date } {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  // Day 0 of the NEXT month is the last day of this one; passing a 1-indexed
  // month unchanged into a 0-indexed constructor already means "next month".
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month - 1, lastDay));
  const end = new Date(last);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  return { start, end };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's calendar date in Manila, regardless of where the server thinks it is. */
function todayInManila(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TIME_ZONE }).format(now);
}

/**
 * Whole weeks, Sunday-first, padded from the adjacent months.
 *
 * ⚠️ `month` is 1-INDEXED, like monthBounds and monthGridBounds.
 *
 * Blocks landing on a padded day are kept: a booking on the 28th of the
 * previous month is real occupancy, and hiding it would draw a free day that
 * is not free. How far the padding reaches is gridRange's judgement, shared
 * with monthGridBounds so a read can cover exactly these days. All date
 * arithmetic runs in UTC on date-only values, which have no timezone to shift;
 * only `isToday` consults Manila, because only "today" depends on where the
 * reader is.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  blocks: CalendarBlock[],
  now: Date,
  window: { openingHour: number; closingHour: number } = DEFAULT_WINDOW,
): DayCell[][] {
  const today = todayInManila(now);

  const byDate = new Map<string, CalendarBlock[]>();
  for (const block of blocks) {
    const list = byDate.get(block.date);
    if (list) list.push(block);
    else byDate.set(block.date, [block]);
  }

  // The same bounds monthGridBounds hands a caller, so the days drawn here and
  // the days read for them cannot drift apart.
  const { start: gridStart, end: gridEnd } = gridRange(year, month);

  const weeks: DayCell[][] = [];
  let week: DayCell[] = [];

  for (
    const cursor = new Date(gridStart);
    cursor <= gridEnd;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const date = isoDate(cursor);
    const dayBlocks = byDate.get(date) ?? [];

    const statusBySpace = Object.fromEntries(
      SPACE_ORDER.map((space) => [
        space,
        computeDayStatus(
          // An unplaced block cannot occupy a lane it is not in.
          dayBlocks.filter((b) => b.space === space),
          window.openingHour,
          window.closingHour,
        ),
      ]),
    ) as Record<SpaceCode, DayStatus>;

    week.push({
      date,
      inMonth: cursor.getUTCMonth() === month - 1,
      isToday: date === today,
      blocks: dayBlocks,
      statusBySpace,
    });

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  return weeks;
}
