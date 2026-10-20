import { describe, expect, it } from "vitest";
import {
  buildCalendarHref,
  buildQueueHref,
  NEEDS_ACTION,
  parseMonth,
  parseStatusFilter,
  parseView,
  shiftMonth,
  statusesFor,
} from "./queue-params";

describe("parseStatusFilter", () => {
  it("accepts a real status", () => {
    expect(parseStatusFilter("payment_verification")).toBe("payment_verification");
    expect(parseStatusFilter("pending")).toBe("pending");
  });

  it("accepts the needs-action sentinel", () => {
    expect(parseStatusFilter(NEEDS_ACTION)).toBe(NEEDS_ACTION);
  });

  it("falls back to all for anything else", () => {
    // Search params are user input — someone can type anything into the bar.
    expect(parseStatusFilter("needsaction")).toBe("all");
    expect(parseStatusFilter("preliminary_approved")).toBe("all");
    expect(parseStatusFilter(undefined)).toBe("all");
    expect(parseStatusFilter("'; drop table bookings; --")).toBe("all");
  });
});

describe("statusesFor", () => {
  it("expands the sentinel into the four non-adjacent statuses", () => {
    expect(statusesFor(NEEDS_ACTION)).toEqual([
      "awaiting_tier_review",
      "awaiting_quote",
      "payment_verification",
      "confirmed",
    ]);
  });

  it("returns a single status for a real one", () => {
    expect(statusesFor("cancelled")).toEqual(["cancelled"]);
  });

  it("returns null for all, so the caller omits the filter entirely", () => {
    // Not an array of all eight: an .in() over the whole enum is a filter
    // Postgres has to evaluate for nothing.
    expect(statusesFor("all")).toBeNull();
  });
});

describe("buildQueueHref", () => {
  it("omits the status param for all", () => {
    expect(buildQueueHref({ status: "all" })).toBe("/staff/booking");
  });

  it("carries the sentinel", () => {
    expect(buildQueueHref({ status: NEEDS_ACTION })).toBe(
      "/staff/booking?status=needs-action",
    );
  });

  it("carries the search term across a tab change", () => {
    expect(buildQueueHref({ status: "confirmed", search: "chamber" })).toBe(
      "/staff/booking?status=confirmed&q=chamber",
    );
  });

  it("drops a whitespace-only search", () => {
    expect(buildQueueHref({ status: "confirmed", search: "  " })).toBe(
      "/staff/booking?status=confirmed",
    );
  });
});

describe("parseView", () => {
  it("reads the calendar only from the exact literal", () => {
    expect(parseView("calendar")).toBe("calendar");
  });

  it("treats anything else as the list", () => {
    // Search params are user input.
    expect(parseView("list")).toBe("list");
    expect(parseView("Calendar")).toBe("list");
    expect(parseView("grid")).toBe("list");
    expect(parseView(undefined)).toBe("list");
    expect(parseView("'; drop table bookings; --")).toBe("list");
  });
});

describe("parseMonth", () => {
  // 12:00 Manila on 2026-08-11.
  const now = new Date("2026-08-11T12:00:00+08:00");

  it("parses a well-formed month, 1-indexed", () => {
    expect(parseMonth("2026-09", now)).toEqual({ year: 2026, month: 9 });
    expect(parseMonth("2026-01", now)).toEqual({ year: 2026, month: 1 });
    expect(parseMonth("2026-12", now)).toEqual({ year: 2026, month: 12 });
  });

  it("falls back to the current Manila month when absent", () => {
    expect(parseMonth(undefined, now)).toEqual({ year: 2026, month: 8 });
  });

  it("reads the current month in Manila, not UTC", () => {
    // 2026-08-31 16:00 UTC is already 2026-09-01 in Manila. A staff member in
    // Lucena must land on September.
    expect(parseMonth(undefined, new Date("2026-08-31T16:00:00Z"))).toEqual({
      year: 2026,
      month: 9,
    });
  });

  it("refuses a month number that names no month", () => {
    expect(parseMonth("2026-13", now)).toEqual({ year: 2026, month: 8 });
    expect(parseMonth("2026-00", now)).toEqual({ year: 2026, month: 8 });
  });

  it("refuses a year far outside anything anyone bookmarked", () => {
    // A grid 200 years out renders nothing over a query that matches nothing.
    expect(parseMonth("0000-01", now)).toEqual({ year: 2026, month: 8 });
    expect(parseMonth("2226-01", now)).toEqual({ year: 2026, month: 8 });
  });

  it("refuses anything that is not YYYY-MM at all", () => {
    expect(parseMonth("banana", now)).toEqual({ year: 2026, month: 8 });
    expect(parseMonth("2026-9", now)).toEqual({ year: 2026, month: 8 });
    expect(parseMonth("2026", now)).toEqual({ year: 2026, month: 8 });
    expect(parseMonth("", now)).toEqual({ year: 2026, month: 8 });
  });
});

describe("shiftMonth", () => {
  it("moves within a year", () => {
    expect(shiftMonth(2026, 8, 1)).toEqual({ year: 2026, month: 9 });
    expect(shiftMonth(2026, 8, -1)).toEqual({ year: 2026, month: 7 });
  });

  it("crosses both year boundaries", () => {
    // Four lines of arithmetic, and wrong in half the calendars ever written.
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("survives a shift larger than a year", () => {
    expect(shiftMonth(2026, 8, 12)).toEqual({ year: 2027, month: 8 });
    expect(shiftMonth(2026, 8, -12)).toEqual({ year: 2025, month: 8 });
    expect(shiftMonth(2026, 1, -13)).toEqual({ year: 2024, month: 12 });
  });

  it("returns the same month for a zero shift", () => {
    expect(shiftMonth(2026, 8, 0)).toEqual({ year: 2026, month: 8 });
  });
});

describe("buildCalendarHref", () => {
  it("zero-pads the month so the URL round-trips through parseMonth", () => {
    expect(buildCalendarHref({ year: 2026, month: 9 })).toBe(
      "/staff/booking?view=calendar&month=2026-09",
    );
    expect(buildCalendarHref({ year: 2026, month: 12 })).toBe(
      "/staff/booking?view=calendar&month=2026-12",
    );
  });

  it("round-trips: what it builds, parseMonth reads back", () => {
    const now = new Date("2026-08-11T12:00:00+08:00");
    for (const month of [1, 6, 12]) {
      const href = buildCalendarHref({ year: 2026, month });
      const raw = href.split("month=")[1];
      expect(parseMonth(raw, now)).toEqual({ year: 2026, month });
    }
  });

  it("carries no status or search, deliberately", () => {
    // Neither has a meaning on a grid: a month is not a subset of "confirmed".
    // Switching back to the list lands unfiltered, and that is intended.
    expect(buildCalendarHref({ year: 2026, month: 8 })).not.toContain("status");
    expect(buildCalendarHref({ year: 2026, month: 8 })).not.toContain("q=");
  });
});
