import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  computeDayStatus,
  hasTimeConflict,
  HOLDING_STATUSES,
  monthBounds,
  monthGridBounds,
  toBlocks,
} from "./calendar";
import type { BookingQueueItem } from "../types";

function booking(over: Partial<BookingQueueItem> = {}): BookingQueueItem {
  return {
    id: "bk-1",
    reference_number: "BK-2026-000031",
    status: "confirmed",
    cancellation_reason: null,
    event_title: "Foundation Day",
    event_type_label: "Conference",
    venue_code: "atrium",
    venue_label: "Atrium",
    rate_tier: "commercial",
    tier_verified: false,
    organization_name: null,
    contact_person: "Ana Reyes",
    estimated_headcount: 400,
    event_date: "2026-08-14",
    start_time: "09:00:00",
    duration_hours: 6,
    total_fee: 60000,
    balance_amount: 30000,
    hold_expires_at: null,
    submitted_at: "2026-08-01T10:00:00+08:00",
    unverified_payment_count: 0,
    tier_review_since: null,
    ...over,
  };
}

describe("HOLDING_STATUSES", () => {
  it("is exactly the statuses that hold an occupancy row", () => {
    // bk_sync_occupancy deletes occupancy on ONE transition: status ->
    // 'cancelled'. Everything else holds the slot, including completed. A
    // calendar that hid completed bookings would show a free evening that
    // the EXCLUDE constraint will refuse.
    expect(HOLDING_STATUSES).toEqual([
      "pending",
      "awaiting_tier_review",
      "awaiting_resubmission",
      "awaiting_quote",
      "awaiting_payment",
      "payment_verification",
      "confirmed",
      "fully_paid",
      "completed",
    ]);
    expect(HOLDING_STATUSES).not.toContain("cancelled");
  });
});

describe("toBlocks", () => {
  it("emits one block per space a venue consumes", () => {
    // A Full Facility booking is ONE booking and TWO blocks, exactly as it is
    // one row in `bookings` and two in `booking_occupancies`.
    const blocks = toBlocks([booking({ venue_code: "full_facility" })]);
    expect(blocks.map((b) => b.space)).toEqual(["atrium", "arena"]);
    expect(new Set(blocks.map((b) => b.bookingId)).size).toBe(1);
  });

  it("drops cancelled bookings", () => {
    expect(toBlocks([booking({ status: "cancelled" })])).toEqual([]);
  });

  it("keeps a completed booking", () => {
    expect(toBlocks([booking({ status: "completed" })])).toHaveLength(1);
  });

  it("computes end hour from start_time and duration, in Manila-local terms", () => {
    // start_time is a `time` and event_date a `date`. Neither carries a
    // timezone, so no conversion happens anywhere — which is precisely how
    // this avoids bk_sync_occupancy's 8-hour trap.
    const [block] = toBlocks([
      booking({ start_time: "13:00:00", duration_hours: 4 }),
    ]);
    expect(block.startHour).toBe(13);
    expect(block.endHour).toBe(17);
  });

  it("carries the date straight off event_date, unconverted", () => {
    const [block] = toBlocks([booking({ event_date: "2026-08-14" })]);
    expect(block.date).toBe("2026-08-14");
  });

  it("keeps a booking whose venue is unmapped, flagged", () => {
    // Super Staff can add a venue this repo has never heard of. Filing it
    // under the wrong lane would be worse than showing it as unplaced.
    const [block] = toBlocks([booking({ venue_code: "rooftop_garden" })]);
    expect(block.space).toBeNull();
  });

  it("carries the identity every block needs to be clickable", () => {
    const [block] = toBlocks([booking()]);
    expect(block.bookingId).toBe("bk-1");
    expect(block.reference).toBe("BK-2026-000031");
    expect(block.title).toBe("Foundation Day");
    expect(block.venueLabel).toBe("Atrium");
    expect(block.status).toBe("confirmed");
  });
});

describe("computeDayStatus", () => {
  // Ported from EndUser's lccData.ts, where it is already tested. Same
  // semantics, per space instead of per venue.
  it("is available with nothing booked", () => {
    expect(computeDayStatus([], 6, 22)).toBe("available");
  });

  it("is partial with some of the day taken", () => {
    expect(computeDayStatus([{ startHour: 9, endHour: 15 }], 6, 22)).toBe("partial");
  });

  it("is fully-booked when the occupied hours cover the opening window", () => {
    expect(computeDayStatus([{ startHour: 6, endHour: 22 }], 6, 22)).toBe(
      "fully-booked",
    );
  });

  it("adds separate ranges up to reach fully-booked", () => {
    expect(
      computeDayStatus(
        [
          { startHour: 6, endHour: 14 },
          { startHour: 14, endHour: 22 },
        ],
        6,
        22,
      ),
    ).toBe("fully-booked");
  });
});

describe("hasTimeConflict", () => {
  // Ported verbatim. Half-open intervals: a booking ending at 14:00 and one
  // starting at 14:00 do NOT conflict, matching the '[)' bound
  // bk_sync_occupancy builds its tstzrange with.
  it("treats touching ranges as non-conflicting", () => {
    expect(hasTimeConflict([{ startHour: 10, endHour: 14 }], 14, 2)).toBe(false);
  });

  it("detects an overlap", () => {
    expect(hasTimeConflict([{ startHour: 10, endHour: 14 }], 13, 2)).toBe(true);
  });

  it("finds no conflict in an empty day", () => {
    expect(hasTimeConflict([], 9, 6)).toBe(false);
  });
});

describe("monthBounds", () => {
  it("returns the first and last date of the month as YYYY-MM-DD", () => {
    // ⚠️ 1-indexed month. buildMonthGrid uses the same convention, and mixing
    // it with JavaScript's 0-indexed Date is the single most likely bug here.
    expect(monthBounds(2026, 8)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("handles February in a leap year", () => {
    expect(monthBounds(2028, 2)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("handles February in a common year", () => {
    expect(monthBounds(2026, 2)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("handles a 30-day month and December", () => {
    expect(monthBounds(2026, 4)).toEqual({ from: "2026-04-01", to: "2026-04-30" });
    expect(monthBounds(2026, 12)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("monthGridBounds", () => {
  const now = new Date("2026-08-15T12:00:00+08:00");

  /**
   * A spread of padding shapes: August 2026 pads at both ends, March 2026 at
   * neither start, February 2026 at neither end, November 2025 the widest a
   * month can pad, September 2026 an ordinary five-week month.
   */
  const MONTHS = [
    [2026, 8],
    [2026, 3],
    [2026, 2],
    [2025, 11],
    [2026, 9],
  ] as const;

  /** The grid's own first and last day, read off the grid rather than restated. */
  function gridEdges(year: number, month: number) {
    const grid = buildMonthGrid(year, month, [], now);
    return {
      from: grid[0][0].date,
      to: grid[grid.length - 1][6].date,
    };
  }

  it("returns the padded range the grid draws, not the month", () => {
    // ⚠️ 1-indexed month, like monthBounds and buildMonthGrid. August 2026
    // starts on a Saturday and ends on a Monday, so the grid reaches back to
    // 26 July and forward to 5 September.
    expect(monthGridBounds(2026, 8)).toEqual({
      from: "2026-07-26",
      to: "2026-09-05",
    });
  });

  it("agrees with the grid the builder produces, on both edges", () => {
    // The two are one rule. If the padding convention ever changes — a
    // Monday-first grid, a six-week fixed height — this is the test that
    // refuses to let the range and the grid part company.
    for (const [year, month] of MONTHS) {
      expect(monthGridBounds(year, month)).toEqual(gridEdges(year, month));
    }
  });

  /**
   * A day is only worth covering because the grid draws it and a booking can
   * land there. Asserting a bare date against the range would pass on any
   * range wide enough, including a superset that guessed — so each of these
   * puts a real booking on the day, proves the grid drew it as padding, and
   * only then asks whether the range covers it.
   */
  function expectPaddedDayCovered(year: number, month: number, date: string) {
    const grid = buildMonthGrid(year, month, toBlocks([booking({ event_date: date })]), now);
    const day = grid.flat().find((d) => d.date === date);

    expect(day).toBeDefined();
    expect(day!.inMonth).toBe(false);
    expect(day!.blocks).toHaveLength(1);

    const { from, to } = monthGridBounds(year, month);
    expect(from <= date && date <= to).toBe(true);
  }

  it("covers a booking on a padded day from the previous month", () => {
    // The 28th of the previous month is real occupancy on a day the August
    // grid draws. A read bounded by the month itself would miss it and draw a
    // free evening the EXCLUDE constraint then refuses at submit time.
    expectPaddedDayCovered(2026, 8, "2026-07-28");
  });

  it("covers a booking on a padded day from the following month", () => {
    expectPaddedDayCovered(2026, 8, "2026-09-02");
  });

  it("covers every day the grid draws, not merely the padded ones named above", () => {
    // The general form of the two tests above: nothing the grid draws falls
    // outside the range that feeds it. This is the assertion that a narrower
    // range would break, wherever the padding happens to land.
    for (const [year, month] of MONTHS) {
      const { from, to } = monthGridBounds(year, month);
      for (const day of buildMonthGrid(year, month, [], now).flat()) {
        expect(from <= day.date && day.date <= to).toBe(true);
      }
    }
  });

  it("pads nothing at the start of a month that begins on a Sunday", () => {
    // March 2026 begins on a Sunday, so the grid starts on the 1st itself and
    // only the far end is padded.
    expect(monthGridBounds(2026, 3)).toEqual({
      from: "2026-03-01",
      to: "2026-04-04",
    });
  });

  it("pads nothing at either end of a month that fills whole weeks", () => {
    // February 2026 begins on a Sunday and ends on a Saturday: 28 days, four
    // whole weeks, no padded day anywhere.
    expect(monthGridBounds(2026, 2)).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("handles the widest padding a month can produce", () => {
    // The worst case is a 30-day month beginning on a Saturday: six padded
    // days before and six after, a full 42-day grid. November 2025 is one.
    expect(monthGridBounds(2025, 11)).toEqual({
      from: "2025-10-26",
      to: "2025-12-06",
    });
  });

  it("crosses a year boundary at each end", () => {
    expect(monthGridBounds(2026, 1).from < "2026-01-01").toBe(true);
    expect(monthGridBounds(2026, 12).to > "2026-12-31").toBe(true);
  });
});

describe("buildMonthGrid", () => {
  const now = new Date("2026-08-15T12:00:00+08:00");

  it("returns whole weeks, Sunday-first, padded from adjacent months", () => {
    // ⚠️ 1-indexed month: 8 is August. August 2026 starts on a Saturday.
    const grid = buildMonthGrid(2026, 8, [], now);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid[0][0].date).toBe("2026-07-26");
    expect(grid[0][6].date).toBe("2026-08-01");
    expect(grid[0][6].inMonth).toBe(true);
    expect(grid[0][0].inMonth).toBe(false);
  });

  it("ends on a padded Saturday", () => {
    const grid = buildMonthGrid(2026, 8, [], now);
    const last = grid[grid.length - 1][6];
    expect(last.inMonth).toBe(false);
    expect(last.date).toBe("2026-09-05");
  });

  it("marks today, in Manila", () => {
    // A staff member in Lucena at 08:00 on the 12th must not see the 11th
    // highlighted because the server is on UTC.
    const grid = buildMonthGrid(2026, 8, [], new Date("2026-08-12T00:30:00+08:00"));
    expect(grid.flat().find((d) => d.isToday)?.date).toBe("2026-08-12");
  });

  it("marks no day as today when the month is not the current one", () => {
    const grid = buildMonthGrid(2027, 3, [], now);
    expect(grid.flat().some((d) => d.isToday)).toBe(false);
  });

  it("places a block on its own day only", () => {
    const grid = buildMonthGrid(
      2026,
      8,
      toBlocks([booking({ event_date: "2026-08-14" })]),
      now,
    );
    const days = grid.flat().filter((d) => d.blocks.length > 0);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-08-14");
  });

  it("puts a Full Facility booking in both lanes on the same day", () => {
    const grid = buildMonthGrid(
      2026,
      8,
      toBlocks([booking({ venue_code: "full_facility", event_date: "2026-08-14" })]),
      now,
    );
    const day = grid.flat().find((d) => d.date === "2026-08-14")!;
    expect(day.blocks).toHaveLength(2);
    expect(day.blocks.map((b) => b.space)).toEqual(["atrium", "arena"]);
  });

  it("computes a per-space status, not a per-day one", () => {
    // An Atrium booking says nothing about whether the Arena is free.
    const grid = buildMonthGrid(
      2026,
      8,
      toBlocks([
        booking({ event_date: "2026-08-14", venue_code: "atrium", start_time: "09:00:00", duration_hours: 6 }),
      ]),
      now,
      { openingHour: 6, closingHour: 22 },
    );
    const day = grid.flat().find((d) => d.date === "2026-08-14")!;
    expect(day.statusBySpace.atrium).toBe("partial");
    expect(day.statusBySpace.arena).toBe("available");
  });

  it("ignores an unplaced block when computing space status", () => {
    // A block with no space cannot occupy a lane it is not in.
    const grid = buildMonthGrid(
      2026,
      8,
      toBlocks([booking({ event_date: "2026-08-14", venue_code: "rooftop_garden" })]),
      now,
    );
    const day = grid.flat().find((d) => d.date === "2026-08-14")!;
    expect(day.statusBySpace.atrium).toBe("available");
    expect(day.statusBySpace.arena).toBe("available");
    expect(day.blocks).toHaveLength(1);
  });

  it("shows a block that falls on a padded day from an adjacent month", () => {
    // The grid draws 2026-07-26 onward; a booking there is real occupancy and
    // dropping it would show a free day that is not.
    const grid = buildMonthGrid(
      2026,
      8,
      toBlocks([booking({ event_date: "2026-07-28" })]),
      now,
    );
    const day = grid.flat().find((d) => d.date === "2026-07-28")!;
    expect(day.inMonth).toBe(false);
    expect(day.blocks).toHaveLength(1);
  });
});
