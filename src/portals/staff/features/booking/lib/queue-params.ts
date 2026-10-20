import { MANILA_TIME_ZONE } from "@/shared/dates/manila";
import { NEEDS_ACTION_STATUSES, STATUS_ORDER } from "./status";
import type { BookingStatus } from "../types";

/**
 * A sentinel, not a booking_status. Hyphenated so it can never collide with an
 * enum value, all of which use underscores.
 */
export const NEEDS_ACTION = "needs-action";

export type StatusFilter = BookingStatus | "all" | typeof NEEDS_ACTION;

/**
 * Search params are user input — someone can type anything into the address
 * bar. An unrecognised value falls back to "all" rather than reaching the
 * query, so the filter can never be a vector and never 500s the page.
 */
export function parseStatusFilter(raw: string | undefined): StatusFilter {
  if (raw === NEEDS_ACTION) return NEEDS_ACTION;
  return STATUS_ORDER.includes(raw as BookingStatus)
    ? (raw as BookingStatus)
    : "all";
}

/**
 * The statuses a filter resolves to, or null when it should not filter at all.
 *
 * Null rather than "every status": an .in() listing all eight is a predicate
 * Postgres evaluates for no benefit, and it would quietly start excluding rows
 * the day the enum gains a ninth value.
 */
export function statusesFor(
  filter: StatusFilter,
): readonly BookingStatus[] | null {
  if (filter === "all") return null;
  if (filter === NEEDS_ACTION) return NEEDS_ACTION_STATUSES;
  return [filter];
}

/**
 * Tab links must carry the current search term, or clicking a status throws
 * away what the user typed.
 *
 * ⚠️ It deliberately gains nothing for the calendar. Switching to the calendar
 * DROPS the status filter and the search term, because neither has a meaning
 * on a grid — a month is not a subset of "confirmed". Switching back lands on
 * an unfiltered list. That is intended, not a bug.
 */
export function buildQueueHref({
  status,
  search,
}: {
  status: StatusFilter;
  search?: string;
}): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (search?.trim()) params.set("q", search.trim());
  const query = params.toString();
  return query ? `/staff/booking?${query}` : "/staff/booking";
}

/**
 * The calendar is a VIEW of /booking, not a route of its own — the toggle
 * already sits there, and a separate path would fork the queue's filter state.
 */
export type BookingView = "list" | "calendar";

/** Anything but the literal "calendar" is the list. Search params are user input. */
export function parseView(raw: string | undefined): BookingView {
  return raw === "calendar" ? "calendar" : "list";
}

/** The furthest out a bookmarked month is worth rendering, either direction. */
const MONTH_RANGE_YEARS = 5;

/**
 * `?month=YYYY-MM`, 1-indexed, falling back to the current Manila month.
 *
 * The fallback covers more than a malformed string: "2026-13" and "0000-01"
 * parse as numbers but name no month, and a month two centuries out would
 * render a grid nobody asked for over a query that matches nothing. A bounded
 * range is the difference between a typo and an empty screen.
 */
export function parseMonth(
  raw: string | undefined,
  now: Date,
): { year: number; month: number } {
  const current = currentManilaMonth(now);
  if (!raw) return current;

  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return current;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return current;
  if (Math.abs(year - current.year) > MONTH_RANGE_YEARS) return current;

  return { year, month };
}

function currentManilaMonth(now: Date): { year: number; month: number } {
  // en-CA gives YYYY-MM-DD, so the month is legible without locale guessing.
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
  })
    .format(now)
    .split("-")
    .map(Number);
  return { year, month };
}

/**
 * Month arithmetic that does not go through Date, so December + 1 is January
 * of the next year rather than a month-13 that silently normalises somewhere
 * else. Four lines, and wrong in half the calendars ever written.
 */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(zeroBased / 12),
    month: (((zeroBased % 12) + 12) % 12) + 1,
  };
}

export function buildCalendarHref({
  year,
  month,
}: {
  year: number;
  month: number;
}): string {
  return `/staff/booking?view=calendar&month=${year}-${String(month).padStart(2, "0")}`;
}
