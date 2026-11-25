import { describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { CalendarDay } from "./calendar-day";
import { buildMonthGrid, toBlocks, type DayHours } from "../lib/calendar";
import type { DayCell } from "../lib/calendar";
import type { CalendarBooking, MaintenancePeriod } from "../types";

function booking(over: Partial<CalendarBooking> = {}): CalendarBooking {
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
    confirmation_due_at: null,
    deadline_state: null,
    changeover_hours: 1,
    ...over,
  };
}

/** The stored settings: a 6–22 window, a 6-hour minimum, a 1-hour Changeover. */
const DAY_HOURS: DayHours = { openingHour: 6, closingHour: 22, minDurationHours: 6, changeoverHours: 1 };

const now = new Date("2026-08-14T12:00:00+08:00");

/** The real grid, so the cell under test is built the way production builds it. */
function dayFor(
  date: string,
  bookings: CalendarBooking[] = [],
  maintenancePeriods: MaintenancePeriod[] = [],
): DayCell {
  return buildMonthGrid(2026, 8, toBlocks(bookings), now, DAY_HOURS, maintenancePeriods)
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

  // SCRUM-261, ADR 0010: each Event is followed by its Changeover, drawn
  // from the length the Booking recorded.
  describe("the Changeover", () => {
    it("follows the Event with a shaded block of the Booking's recorded length", () => {
      renderDay(
        dayFor("2026-08-14", [
          booking({ start_time: "13:00:00", duration_hours: 4, changeover_hours: 2 }),
        ]),
      );
      const changeover = screen.getByText("Changeover").closest("[data-changeover]")!;
      expect(changeover).toBeInTheDocument();
      expect(within(changeover as HTMLElement).getByText(/17:00–19:00/)).toBeInTheDocument();
    });

    it("wraps a Changeover that runs past midnight onto the clock", () => {
      // An Event may end exactly at closing; its Changeover runs on past it.
      renderDay(
        dayFor("2026-08-14", [
          booking({ start_time: "16:00:00", duration_hours: 6, changeover_hours: 3 }),
        ]),
      );
      const changeover = screen.getByText("Changeover").closest("[data-changeover]")!;
      expect(within(changeover as HTMLElement).getByText(/22:00–01:00/)).toBeInTheDocument();
    });

    it("is not a second link to the Booking", () => {
      renderDay(dayFor("2026-08-14", [booking({ changeover_hours: 1 })]));
      expect(screen.getAllByRole("link")).toHaveLength(1);
    });

    it("is not drawn for a Booking recorded with a Changeover of 0", () => {
      renderDay(dayFor("2026-08-14", [booking({ changeover_hours: 0 })]));
      expect(screen.queryByText("Changeover")).not.toBeInTheDocument();
    });

    it("shows a Full Facility Event's Changeover in both lanes", () => {
      renderDay(
        dayFor("2026-08-14", [booking({ venue_code: "full_facility", changeover_hours: 1 })]),
      );
      expect(screen.getAllByText("Changeover")).toHaveLength(2);
      for (const label of ["Atrium", "Sports Arena"]) {
        const lane = screen.getByText(label).closest("div")!;
        expect(within(lane).getByText("Changeover")).toBeInTheDocument();
      }
    });
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

  // SCRUM-263, ADR 0012: Staff see the Space and the reason, so they can tell a
  // Citizen why a day is closed.
  describe("a maintenance day", () => {
    const atriumRepair: MaintenancePeriod = {
      id: "mp-1",
      space: "atrium",
      firstDay: "2026-08-13",
      lastDay: "2026-08-15",
      reason: "Aircon repair",
    };

    it("is marked with the Space, Under maintenance and the reason", () => {
      renderDay(dayFor("2026-08-14", [], [atriumRepair]));
      const marker = screen.getByText(/Under maintenance/).closest("[data-maintenance]")!;
      expect(marker).toHaveTextContent("Atrium · Under maintenance · Aircon repair");
    });

    it("names the Space as its lane does", () => {
      // The database labels the Arena "Arena"; inside the "Sports Arena" lane
      // that would read as a third room.
      renderDay(dayFor("2026-08-14", [], [{ ...atriumRepair, space: "arena", reason: "Floor refinishing" }]));
      const marker = screen.getByText(/Under maintenance/).closest("[data-maintenance]")!;
      expect(marker).toHaveTextContent("Sports Arena · Under maintenance · Floor refinishing");
    });

    it("tells a screen reader the lane is under maintenance, not fully booked", () => {
      renderDay(dayFor("2026-08-14", [], [atriumRepair]));
      expect(screen.getByText("Atrium: under maintenance.")).toBeInTheDocument();
      expect(screen.queryByText(/fully booked/)).not.toBeInTheDocument();
    });

    it("has no actions on the marker", () => {
      renderDay(dayFor("2026-08-14", [], [atriumRepair]));
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("still shows and links the other Space's Booking that day", () => {
      renderDay(
        dayFor(
          "2026-08-14",
          [booking({ venue_code: "sports_arena", venue_label: "Sports Arena" })],
          [atriumRepair],
        ),
      );
      const arenaLane = screen.getByText("Sports Arena").closest("div")!;
      expect(within(arenaLane).getByRole("link")).toHaveAttribute("href", "/staff/booking/bk-1");
      expect(within(arenaLane).queryByText(/Under maintenance/)).not.toBeInTheDocument();
      const atriumLane = screen.getByText("Atrium").closest("div")!;
      expect(within(atriumLane).getByText(/Under maintenance/)).toBeInTheDocument();
    });

    it("shows each reason when two periods overlap", () => {
      renderDay(
        dayFor("2026-08-14", [], [
          atriumRepair,
          { ...atriumRepair, id: "mp-2", reason: "Repainting" },
        ]),
      );
      expect(screen.getAllByText(/Under maintenance/)).toHaveLength(2);
      expect(screen.getByText(/Repainting/)).toBeInTheDocument();
    });
  });
});
