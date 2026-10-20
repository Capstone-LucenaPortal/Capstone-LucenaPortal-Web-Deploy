import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BookingCalendar } from "./booking-calendar";
import { buildMonthGrid, toBlocks } from "../lib/calendar";
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

function renderCalendar(bookings: BookingQueueItem[] = [], year = 2026, month = 8) {
  cleanup();
  const blocks = toBlocks(bookings);
  return render(
    <BookingCalendar
      year={year}
      month={month}
      grid={buildMonthGrid(year, month, blocks, now)}
      unplaced={blocks.filter((b) => b.space === null)}
      todayHref="/staff/booking?view=calendar&month=2026-08"
    />,
  );
}

describe("BookingCalendar", () => {
  it("heads the month by name and year", () => {
    renderCalendar();
    expect(
      screen.getByRole("heading", { name: "August 2026" }),
    ).toBeInTheDocument();
  });

  it("renders a Sunday-first weekday header", () => {
    renderCalendar();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  it("links to the previous and next month, crossing the year correctly", () => {
    renderCalendar([], 2026, 12);
    expect(screen.getByRole("link", { name: /November/ })).toHaveAttribute(
      "href",
      "/staff/booking?view=calendar&month=2026-11",
    );
    expect(screen.getByRole("link", { name: /January/ })).toHaveAttribute(
      "href",
      "/staff/booking?view=calendar&month=2027-01",
    );
  });

  it("offers a Today link", () => {
    renderCalendar();
    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute(
      "href",
      "/staff/booking?view=calendar&month=2026-08",
    );
  });

  it("says the month is clear, not that there are no results", () => {
    // Nobody searched for anything, so "no results" would be the wrong idea.
    renderCalendar();
    expect(screen.getByText(/Both spaces are clear all month/)).toBeInTheDocument();
  });

  it("does not say the month is clear when something is booked", () => {
    renderCalendar([booking()]);
    expect(
      screen.queryByText(/Both spaces are clear all month/),
    ).not.toBeInTheDocument();
  });

  it("explains the both-spaces marker in the legend", () => {
    renderCalendar([booking({ venue_code: "full_facility" })]);
    expect(
      screen.getByText(/one Full Facility booking occupying both lanes/),
    ).toBeInTheDocument();
  });

  it("renders no unplaced strip when every venue is recognised", () => {
    // It should always be empty. This is the normal case.
    renderCalendar([booking()]);
    expect(
      screen.queryByText(/venue this calendar does not recognise/i),
    ).not.toBeInTheDocument();
  });

  it("surfaces a booking at an unrecognised venue rather than losing it", () => {
    // The day Super Staff adds a fifth venue, somebody has to see the rows.
    renderCalendar([
      booking({
        venue_code: "rooftop_garden",
        venue_label: "Rooftop Garden",
        reference_number: "BK-2026-000099",
      }),
    ]);
    expect(
      screen.getByText(/Bookings at a venue this calendar does not recognise/i),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "BK-2026-000099" });
    expect(link).toHaveAttribute("href", "/staff/booking/bk-1");
    expect(screen.getByText(/Rooftop Garden/)).toBeInTheDocument();
  });

  it("draws whole weeks", () => {
    renderCalendar();
    const bodyRows = screen.getAllByRole("row").slice(1);
    for (const row of bodyRows) {
      expect(row.querySelectorAll("td")).toHaveLength(7);
    }
  });
});
