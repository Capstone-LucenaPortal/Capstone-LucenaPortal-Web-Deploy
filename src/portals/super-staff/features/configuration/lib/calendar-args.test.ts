import { describe, expect, it } from "vitest";
import {
  toAddHolidayArgs,
  toOfficeHoursArgs,
  toUpdateHolidayArgs,
} from "./calendar-args";

// The three calendar RPCs have NO argument defaults: an omitted name is a
// PGRST202 404, by design. Each builder must therefore produce exactly the
// declared argument set — asserted with toEqual, which fails on a missing key.

describe("toAddHolidayArgs", () => {
  it("builds exactly what add_holiday declares", () => {
    expect(
      toAddHolidayArgs({
        holidayDate: "2026-11-02",
        name: "All Souls' Day",
        kind: "special_non_working",
        source: "Proclamation No. 727",
      }),
    ).toEqual({
      p_holiday_date: "2026-11-02",
      p_name: "All Souls' Day",
      p_kind: "special_non_working",
      p_source: "Proclamation No. 727",
    });
  });
});

describe("toUpdateHolidayArgs", () => {
  const holiday = {
    id: "11111111-1111-1111-1111-111111111111",
    holidayDate: "2026-12-25",
    name: "Christmas Day",
    kind: "regular" as const,
    source: "RA 9492",
    isActive: false,
  };

  it("builds exactly what update_holiday declares", () => {
    expect(toUpdateHolidayArgs(holiday)).toEqual({
      p_id: "11111111-1111-1111-1111-111111111111",
      p_name: "Christmas Day",
      p_kind: "regular",
      p_source: "RA 9492",
      p_is_active: false,
    });
  });

  it("never sends the date — a wrong date is retired and re-added", () => {
    expect(toUpdateHolidayArgs(holiday)).not.toHaveProperty("p_holiday_date");
  });
});

describe("toOfficeHoursArgs", () => {
  it("sends both times for an open day", () => {
    expect(
      toOfficeHoursArgs({
        isoWeekday: 1,
        dayName: "Monday",
        open: true,
        openTime: "08:00",
        closeTime: "17:00",
      }),
    ).toEqual({ p_iso_weekday: 1, p_open_time: "08:00", p_close_time: "17:00" });
  });

  it("sends both times as explicit nulls for a closed day, not omitted", () => {
    const args = toOfficeHoursArgs({
      isoWeekday: 6,
      dayName: "Saturday",
      open: false,
      openTime: "08:00",
      closeTime: "12:00",
    });
    expect(args).toEqual({
      p_iso_weekday: 6,
      p_open_time: null,
      p_close_time: null,
    });
    expect(Object.keys(args)).toHaveLength(3);
  });
});
