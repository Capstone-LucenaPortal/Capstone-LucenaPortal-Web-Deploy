import { createClient } from "@/shared/supabase/client";
import { requiredColumn } from "@/portals/super-staff/lib/supabase/rows";
import { rows } from "@/portals/super-staff/lib/supabase/select";
import type { Database } from "@/shared/supabase/types";
import type { Holiday, OfficeHours } from "./calendar-types";

type Views = Database["public"]["Views"];
type HolidayRow = Pick<
  Views["super_holidays"]["Row"],
  "id" | "holiday_date" | "name" | "kind" | "source" | "is_active" | "calendar_ends_on"
>;
type OfficeHoursRow = Pick<
  Views["super_office_hours"]["Row"],
  "iso_weekday" | "day_name" | "open_time" | "close_time"
>;

// No audit stamps: who changed the calendar is the audit log's question
// (area 'calendar'), and selecting a column nothing maps only invites mapping it.
const HOLIDAY_COLUMNS = "id, holiday_date, name, kind, source, is_active, calendar_ends_on";
const OFFICE_HOURS_COLUMNS = "iso_weekday, day_name, open_time, close_time";
const HOLIDAYS_VIEW = "super_holidays";

/**
 * Every holiday, RETIRED ONES INCLUDED, in date order. Never filter on
 * is_active: a retired holiday that cannot be seen cannot be reactivated.
 *
 * A row with no id, date or kind can neither be rendered nor written back, so
 * it is dropped rather than defaulted.
 */
export function toHolidays(data: HolidayRow[]): Holiday[] {
  return data
    .map((r) =>
      r.id === null || r.holiday_date === null || r.kind === null
        ? null
        : {
            id: r.id,
            holidayDate: r.holiday_date,
            name: r.name ?? "",
            kind: r.kind,
            source: r.source ?? "",
            isActive: requiredColumn(r.is_active, "is_active", HOLIDAYS_VIEW),
          },
    )
    .filter((h): h is Holiday => h !== null);
}

/**
 * 31 December of the latest ACTIVE holiday's year — past it, every weekday
 * silently becomes a Working Day. The view projects it on every row (a window
 * function); it is null when no active holiday exists at all.
 */
export function toCalendarEndsOn(
  data: Pick<HolidayRow, "calendar_ends_on">[],
): string | null {
  return data.find((r) => r.calendar_ends_on !== null)?.calendar_ends_on ?? null;
}

/** `08:00:00` → `08:00`. Postgres prints the legal end-of-day close as `24:00:00`. */
const hhmm = (t: string | null) => (t === null ? "" : t.slice(0, 5));

export function toOfficeHours(data: OfficeHoursRow[]): OfficeHours[] {
  return data
    .map((r) =>
      r.iso_weekday === null
        ? null
        : {
            isoWeekday: r.iso_weekday,
            dayName: r.day_name ?? "",
            open: r.open_time !== null,
            openTime: hhmm(r.open_time),
            closeTime: hhmm(r.close_time),
          },
    )
    .filter((d): d is OfficeHours => d !== null);
}

export async function listHolidays(): Promise<Holiday[]> {
  return toHolidays(
    await rows(
      createClient()
        .from("super_holidays")
        .select(HOLIDAY_COLUMNS)
        .order("holiday_date", { ascending: true }),
    ),
  );
}

/**
 * Its own read, not a by-product of `listHolidays`: the row editor reloads
 * the list after every save, and adding, retiring or reactivating a holiday
 * can move the horizon, so the screen reloads this beside it.
 */
export async function getCalendarEndsOn(): Promise<string | null> {
  return toCalendarEndsOn(
    await rows(
      createClient()
        .from("super_holidays")
        .select("calendar_ends_on")
        .not("calendar_ends_on", "is", null)
        .limit(1),
    ),
  );
}

/**
 * One row per ISO weekday, Monday first. All seven are seeded, so an empty
 * list means the gate refused — a definer view answers a wrong caller with
 * zero rows, not an error.
 */
export async function listOfficeHours(): Promise<OfficeHours[]> {
  const data = await rows(
    createClient()
      .from("super_office_hours")
      .select(OFFICE_HOURS_COLUMNS)
      .order("iso_weekday", { ascending: true }),
  );
  return toOfficeHours(data);
}
