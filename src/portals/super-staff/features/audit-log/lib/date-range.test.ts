import { describe, expect, it } from "vitest";
import {
  dateRangeToBounds,
  defaultDateRange,
  isReversedRange,
} from "./date-range";

describe("defaultDateRange", () => {
  it("spans the 30 days ending on the anchor's PH date", () => {
    const anchor = new Date("2026-07-15T09:14:00+08:00");
    expect(defaultDateRange(anchor)).toEqual({
      fromDate: "2026-06-15",
      toDate: "2026-07-15",
    });
  });

  it("reads the PH calendar date across the UTC day boundary", () => {
    // 2026-07-15T01:00+08:00 is still 2026-07-14 in UTC; PH date must be the 15th.
    const anchor = new Date("2026-07-15T01:00:00+08:00");
    expect(defaultDateRange(anchor).toDate).toBe("2026-07-15");
  });
});

describe("dateRangeToBounds", () => {
  it("starts at the From day and ends before the day after To, in PH time", () => {
    expect(
      dateRangeToBounds({ fromDate: "2026-06-15", toDate: "2026-07-15" }),
    ).toEqual({
      fromIso: "2026-06-15T00:00:00+08:00",
      beforeIso: "2026-07-16T00:00:00+08:00",
    });
  });

  it("rolls the end bound over a year end", () => {
    expect(
      dateRangeToBounds({ fromDate: "", toDate: "2026-12-31" }).beforeIso,
    ).toBe("2027-01-01T00:00:00+08:00");
  });

  it("rolls the end bound over a leap day", () => {
    expect(
      dateRangeToBounds({ fromDate: "", toDate: "2028-02-29" }).beforeIso,
    ).toBe("2028-03-01T00:00:00+08:00");
    expect(
      dateRangeToBounds({ fromDate: "", toDate: "2026-02-28" }).beforeIso,
    ).toBe("2026-03-01T00:00:00+08:00");
  });

  it("maps empty inputs to null (no bound)", () => {
    expect(dateRangeToBounds({ fromDate: "", toDate: "" })).toEqual({
      fromIso: null,
      beforeIso: null,
    });
  });
});

describe("isReversedRange", () => {
  it("is true when From is after To", () => {
    expect(
      isReversedRange({ fromDate: "2026-10-30", toDate: "2026-10-25" }),
    ).toBe(true);
  });

  it("is false for a one-day range (From equals To)", () => {
    expect(
      isReversedRange({ fromDate: "2026-10-25", toDate: "2026-10-25" }),
    ).toBe(false);
  });

  it("is false when From is before To", () => {
    expect(
      isReversedRange({ fromDate: "2026-10-01", toDate: "2026-10-25" }),
    ).toBe(false);
  });

  it("is false when either or both dates are empty", () => {
    expect(isReversedRange({ fromDate: "2026-10-30", toDate: "" })).toBe(false);
    expect(isReversedRange({ fromDate: "", toDate: "2026-10-25" })).toBe(false);
    expect(isReversedRange({ fromDate: "", toDate: "" })).toBe(false);
  });
});
