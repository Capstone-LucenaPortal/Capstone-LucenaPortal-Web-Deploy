import { describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { CalendarDay } from "./calendar-day";
import { buildMonthGrid, toBlocks } from "../lib/calendar";
import type { DayCell } from "../lib/calendar";
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

const now = new Date("2026-08-14T12:00:00+08:00");

/** The real grid, so the cell under test is built the way production builds it. */
function dayFor(date: string, bookings: BookingQueueItem[] = []): DayCell {
  return buildMonthGrid(2026, 8, toBlocks(bookings), now)
    .flat()
    .find((d) => d.date === date)!;
}

function renderDay(day: DayCell) {
  cleanup();
  return render(
    <table>
      <tbody>
        <tr>
          <CalendarDay day={day} />
        </tr>
      </tbody>
    </table>,
  );
}

describe("CalendarDay", () => {
  it("shows the day number", () => {
    renderDay(dayFor("2026-08-14"));
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("names both lanes on every day", () => {
    renderDay(dayFor("2026-08-14"));
    expect(screen.getByText("Atrium")).toBeInTheDocument();
    expect(screen.getByText("Sports Arena")).toBeInTheDocument();
  });

  it("links a block to its booking", () => {
    renderDay(dayFor("2026-08-14", [booking()]));
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/staff/booking/bk-1");
    expect(within(link).getByText("BK-2026-000031")).toBeInTheDocument();
    expect(within(link).getByText("Foundation Day")).toBeInTheDocument();
  });

  it("shows the hours the booking occupies", () => {
    renderDay(
      dayFor("2026-08-14", [booking({ start_time: "13:00:00", duration_hours: 4 })]),
    );
    expect(screen.getByText(/13:00–17:00/)).toBeInTheDocument();
  });

  it("renders a Full Facility booking twice, both marked as spanning both spaces", () => {
    // Two identical-looking entries with no explanation read as a duplicate,
    // which is the confusion venue-grouping would have caused.
    renderDay(dayFor("2026-08-14", [booking({ venue_code: "full_facility" })]));
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/staff/booking/bk-1");
      expect(within(link).getByText(/both spaces/)).toBeInTheDocument();
    }
  });

  it("does not mark a single-space booking as spanning both", () => {
    renderDay(dayFor("2026-08-14", [booking({ venue_code: "atrium" })]));
    expect(screen.queryByText(/both spaces/)).not.toBeInTheDocument();
  });

  it("shows an Atrium and a Full Facility booking sharing the Atrium lane", () => {
    // A genuine, constraint-level conflict. Under venue-grouping these would
    // sit in two different rows and look independent.
    renderDay(
      dayFor("2026-08-14", [
        booking({ id: "bk-1", reference_number: "BK-A", venue_code: "atrium" }),
        booking({
          id: "bk-2",
          reference_number: "BK-FF",
          venue_code: "full_facility",
        }),
      ]),
    );
    const atriumLane = screen.getByText("Atrium").closest("div")!;
    expect(within(atriumLane).getByText("BK-A")).toBeInTheDocument();
    expect(within(atriumLane).getByText("BK-FF")).toBeInTheDocument();
  });

  it("marks today with a visible label", () => {
    renderDay(dayFor("2026-08-14"));
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("does not label an ordinary day as today", () => {
    renderDay(dayFor("2026-08-15"));
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });

  it("renders a day outside the month non-interactively", () => {
    // Context for the weeks that straddle the edges, not this month's work.
    renderDay(dayFor("2026-07-28", [booking({ event_date: "2026-07-28" })]));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("BK-2026-000031")).toBeInTheDocument();
  });

  it("describes each lane's status for a screen reader", () => {
    renderDay(dayFor("2026-08-14", [booking({ venue_code: "atrium" })]));
    expect(screen.getByText("Atrium: part-booked.")).toBeInTheDocument();
    expect(screen.getByText("Sports Arena: free.")).toBeInTheDocument();
  });
});
