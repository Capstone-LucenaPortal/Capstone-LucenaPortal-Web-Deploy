import { describe, expect, it } from "vitest";
import { toCalendarEndsOn, toHolidays, toOfficeHours } from "./calendar-queries";

const row = (over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  holiday_date: "2026-12-25",
  name: "Christmas Day",
  kind: "regular" as const,
  source: "RA 9492",
  is_active: true,
  calendar_ends_on: "2027-12-31",
  ...over,
});

describe("toHolidays", () => {
  it("keeps retired holidays — the view is unfiltered on purpose", () => {
    const holidays = toHolidays([
      row(),
      row({ id: "22222222-2222-2222-2222-222222222222", holiday_date: "2026-08-19", name: "Quezon Day", kind: "local", is_active: false }),
    ]);
    expect(holidays).toEqual([
      { id: "11111111-1111-1111-1111-111111111111", holidayDate: "2026-12-25", name: "Christmas Day", kind: "regular", source: "RA 9492", isActive: true },
      { id: "22222222-2222-2222-2222-222222222222", holidayDate: "2026-08-19", name: "Quezon Day", kind: "local", source: "RA 9492", isActive: false },
    ]);
  });

  it("drops a row that cannot be identified or written back", () => {
    expect(toHolidays([row({ id: null }), row({ holiday_date: null }), row({ kind: null })])).toEqual([]);
  });

  it("refuses to render a null is_active as a value", () => {
    expect(() => toHolidays([row({ is_active: null })])).toThrow(/is_active/);
  });
});

describe("toCalendarEndsOn", () => {
  it("reads calendar_ends_on off the rows — it is the same on every row", () => {
    expect(toCalendarEndsOn([row(), row()])).toBe("2027-12-31");
  });

  it("is null when there is no active holiday at all", () => {
    expect(toCalendarEndsOn([row({ calendar_ends_on: null, is_active: false })])).toBeNull();
    expect(toCalendarEndsOn([])).toBeNull();
  });
});

describe("toOfficeHours", () => {
  it("trims the database's HH:MM:SS to HH:MM and marks a null pair closed", () => {
    expect(
      toOfficeHours([
        { iso_weekday: 1, day_name: "Monday", open_time: "08:00:00", close_time: "17:00:00" },
        { iso_weekday: 7, day_name: "Sunday", open_time: null, close_time: null },
      ]),
    ).toEqual([
      { isoWeekday: 1, dayName: "Monday", open: true, openTime: "08:00", closeTime: "17:00" },
      { isoWeekday: 7, dayName: "Sunday", open: false, openTime: "", closeTime: "" },
    ]);
  });

  it("keeps 24:00 — a legal close meaning end of day", () => {
    expect(
      toOfficeHours([{ iso_weekday: 2, day_name: "Tuesday", open_time: "00:00:00", close_time: "24:00:00" }])[0],
    ).toMatchObject({ openTime: "00:00", closeTime: "24:00" });
  });

  it("drops a row with no weekday", () => {
    expect(
      toOfficeHours([{ iso_weekday: null, day_name: null, open_time: null, close_time: null }]),
    ).toEqual([]);
  });
});
