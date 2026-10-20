import type { FnArgs } from "@/portals/super-staff/lib/supabase/rpc";
import type { Holiday, NewHoliday, OfficeHours } from "./calendar-types";

// The calendar RPCs have NO argument defaults (l70b §3): PostgREST resolves an
// RPC by argument NAMES, so an omitted field matches no signature and is a
// loud PGRST202 404 rather than a silent partial save. Every builder below
// therefore names every argument, every time.

export const toAddHolidayArgs = (h: NewHoliday): FnArgs<"add_holiday"> => ({
  p_holiday_date: h.holidayDate,
  p_name: h.name,
  p_kind: h.kind,
  p_source: h.source,
});

/** The date is NOT a parameter. A holiday entered on the wrong date is retired
 *  and the right date added, so the audit trail says what happened instead of
 *  a date rewritten under clocks already computed against it. */
export const toUpdateHolidayArgs = (h: Holiday): FnArgs<"update_holiday"> => ({
  p_id: h.id,
  p_name: h.name,
  p_kind: h.kind,
  p_source: h.source,
  p_is_active: h.isActive,
});

/** A closed day is BOTH times null — sent explicitly, never omitted. */
export const toOfficeHoursArgs = (d: OfficeHours): FnArgs<"set_office_hours"> => ({
  p_iso_weekday: d.isoWeekday,
  p_open_time: d.open ? d.openTime : null,
  p_close_time: d.open ? d.closeTime : null,
});
