import { describe, expect, it } from "vitest";
import { dateRangeToBounds, defaultDateRange } from "./date-range";

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
  it("builds inclusive start-of-day and end-of-day ISO bounds", () => {
    expect(
      dateRangeToBounds({ fromDate: "2026-06-15", toDate: "2026-07-15" }),
    ).toEqual({
      fromIso: "2026-06-15T00:00:00+08:00",
      toIso: "2026-07-15T23:59:59+08:00",
    });
  });

  it("maps empty inputs to null (no bound)", () => {
    expect(dateRangeToBounds({ fromDate: "", toDate: "" })).toEqual({
      fromIso: null,
      toIso: null,
    });
  });
});
