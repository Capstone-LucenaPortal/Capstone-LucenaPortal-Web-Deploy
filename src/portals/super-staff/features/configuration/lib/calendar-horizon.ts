import { MANILA_TIME_ZONE } from "@/shared/dates/manila";

/**
 * How far ahead the Holiday calendar reaches (user story 15). Past
 * `calendar_ends_on` every weekday silently becomes a Working Day, so every
 * Processing Deadline computed across that line is too early — against the
 * city. The warning has to arrive while there is still time to seed next
 * year's holidays, which are usually proclaimed in the last quarter.
 */
export const HORIZON_WARNING_DAYS = 90;

export type CalendarHorizon =
  | { state: "ok" | "approaching" | "passed"; daysLeft: number }
  /** No active holiday exists at all — the view's calendar_ends_on is null. */
  | { state: "none"; daysLeft: null };

const DAY_MS = 86_400_000;

/** Whole days between two `YYYY-MM-DD` dates, read as calendar dates. */
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export function calendarHorizon(
  endsOn: string | null,
  today: string,
): CalendarHorizon {
  if (endsOn === null) return { state: "none", daysLeft: null };
  const daysLeft = daysBetween(today, endsOn);
  if (daysLeft < 0) return { state: "passed", daysLeft };
  if (daysLeft <= HORIZON_WARNING_DAYS) return { state: "approaching", daysLeft };
  return { state: "ok", daysLeft };
}

/** Today's date in Manila as `YYYY-MM-DD` — the calendar's own time zone. */
export function manilaToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
