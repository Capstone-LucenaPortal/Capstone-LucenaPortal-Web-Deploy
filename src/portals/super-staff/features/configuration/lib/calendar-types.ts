import type { Database } from "@/shared/supabase/types";

/** `regular` / `special_non_working` / `local` / `suspension` — the DB enum. */
export type HolidayKind = Database["public"]["Enums"]["holiday_kind"];

/**
 * A Holiday as `super_holidays` hands it over, narrowed. Retired rows are
 * included — the view is unfiltered on purpose (l70b §2): a retired holiday
 * that cannot be seen cannot be reactivated.
 */
export type Holiday = {
  id: string;
  /** `YYYY-MM-DD`, a whole Manila date. Not editable: a holiday on the wrong
   *  date is retired and the right date added (l70b header). */
  holidayDate: string;
  name: string;
  kind: HolidayKind;
  /** The proclamation or declaration that made it. Never optional. */
  source: string;
  isActive: boolean;
};

/** What the add form collects — a Holiday before it has an id. */
export type NewHoliday = {
  holidayDate: string;
  name: string;
  kind: HolidayKind;
  source: string;
};

/**
 * One weekday's Office Hours. `open` false is a closed day, which the RPC
 * takes as BOTH times null. The times are kept while closed so that
 * re-opening a day the operator just closed restores what it had.
 */
export type OfficeHours = {
  /** 1 = Monday … 7 = Sunday. */
  isoWeekday: number;
  dayName: string;
  open: boolean;
  /** `HH:MM`, Manila local time. `24:00` is a legal close (end of day). */
  openTime: string;
  closeTime: string;
};
