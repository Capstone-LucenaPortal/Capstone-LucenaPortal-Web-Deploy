import { describe, expect, it } from "vitest";
import { calendarHorizon, manilaToday } from "./calendar-horizon";

describe("calendarHorizon", () => {
  it("is fine while the calendar reaches well past today", () => {
    expect(calendarHorizon("2027-12-31", "2026-09-30")).toEqual({
      state: "ok",
      daysLeft: 457,
    });
  });

  it("warns once the end is 90 days away or closer", () => {
    expect(calendarHorizon("2027-12-31", "2027-10-02")).toEqual({
      state: "approaching",
      daysLeft: 90,
    });
    expect(calendarHorizon("2027-12-31", "2027-10-01").state).toBe("ok");
  });

  it("still warns on the last covered day", () => {
    expect(calendarHorizon("2027-12-31", "2027-12-31")).toEqual({
      state: "approaching",
      daysLeft: 0,
    });
  });

  it("says passed once today is beyond the end", () => {
    expect(calendarHorizon("2027-12-31", "2028-01-01")).toEqual({
      state: "passed",
      daysLeft: -1,
    });
  });

  it("says none when there is no active holiday at all", () => {
    expect(calendarHorizon(null, "2026-09-30")).toEqual({
      state: "none",
      daysLeft: null,
    });
  });
});

describe("manilaToday", () => {
  it("is the Manila date, not the UTC one", () => {
    // 16:30 UTC on 30 Sept is 00:30 on 1 Oct in Manila (+08:00).
    expect(manilaToday(new Date("2026-09-30T16:30:00Z"))).toBe("2026-10-01");
    expect(manilaToday(new Date("2026-09-30T15:59:00Z"))).toBe("2026-09-30");
  });
});
