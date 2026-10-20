import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import BookingQueuePage from "./page";
import * as queries from "@/portals/staff/features/booking/lib/queries";
import * as config from "@/portals/staff/features/booking/lib/config";
import { DEFAULT_BOOKING_CONFIG } from "@/portals/staff/features/booking/lib/config";
import { STATUS_ORDER } from "@/portals/staff/features/booking/lib/status";
import type { BookingQueueItem, BookingStatus } from "@/portals/staff/features/booking/types";

// The queue's tab row renders QueueActivityBar, which calls useRouter().
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const booking: BookingQueueItem = {
  id: "bk-1",
  reference_number: "BK-2026-000031",
  status: "awaiting_payment",
  cancellation_reason: null,
  event_title: "Dela Cruz Family 50th Wedding Anniversary",
  event_type_label: "Wedding",
  venue_code: "atrium",
  venue_label: "Atrium",
  rate_tier: "commercial",
  tier_verified: false,
  organization_name: null,
  contact_person: "Juan Dela Cruz",
  estimated_headcount: 350,
  event_date: "2026-09-14",
  start_time: "09:00:00",
  duration_hours: 8,
  total_fee: 40800,
  balance_amount: 20400,
  hold_expires_at: null,
  submitted_at: "2026-08-09T07:55:20+00:00",
  unverified_payment_count: 0,
  tier_review_since: null,
};

const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
  BookingStatus,
  number
>;

function stubQueries() {
  vi.spyOn(queries, "getBookingQueue").mockResolvedValue([booking]);
  vi.spyOn(queries, "getBookingStatusCounts").mockResolvedValue({
    ...counts,
    awaiting_quote: 3,
    awaiting_payment: 2,
    payment_verification: 4,
    confirmed: 1,
  });
  vi.spyOn(queries, "getBalanceOutstanding").mockResolvedValue(69750);
  vi.spyOn(queries, "getBookingCalendar").mockResolvedValue([booking]);
  vi.spyOn(config, "getBookingConfig").mockResolvedValue({
    ...DEFAULT_BOOKING_CONFIG,
  });
}

/** Renders the page and returns nothing; each case asserts on `screen`. */
async function renderPage(
  params: { status?: string; q?: string; view?: string; month?: string } = {},
) {
  cleanup();
  stubQueries();
  render(await BookingQueuePage({ searchParams: Promise.resolve(params) }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BookingQueuePage — list view", () => {
  it("renders the heading, the toggle, and the bookings it read", async () => {
    await renderPage();

    expect(screen.getByText("Convention Center Bookings")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "List" })).toBeInTheDocument();
    expect(screen.getByText("BK-2026-000031")).toBeInTheDocument();
    expect(
      screen.getByText("Dela Cruz Family 50th Wedding Anniversary"),
    ).toBeInTheDocument();
  });

  it("passes the parsed status filter through to the query", async () => {
    await renderPage({ status: "needs-action" });

    expect(queries.getBookingQueue).toHaveBeenCalledWith({
      status: "needs-action",
      search: "",
    });
  });

  it("falls back to all for a status nobody defined", async () => {
    // Search params are user input. This must not reach the query.
    await renderPage({ status: "'; drop table bookings; --" });

    expect(queries.getBookingQueue).toHaveBeenCalledWith({
      status: "all",
      search: "",
    });
  });

  it("carries the search term through", async () => {
    await renderPage({ q: "chamber" });

    expect(queries.getBookingQueue).toHaveBeenCalledWith({
      status: "all",
      search: "chamber",
    });
  });

  it("folds the sentinel tab's figure out of the counts it already read", async () => {
    // 3 awaiting_quote + 4 payment_verification + 1 confirmed. The 2 bookings
    // awaiting_payment are waiting on the citizen and must not be in it.
    await renderPage();

    // By name rather than by position: the tab row also carries the activity
    // bar now, and "the first counted link" would be an assertion about
    // whatever happens to render first.
    expect(
      screen.getByRole("link", { name: "Needs action (8)" }),
    ).toBeInTheDocument();
  });

  it("shows the same Needs action figure on the stat card and the tab at first paint", async () => {
    // SCRUM-188 saw the card at 9 and the tab at (0) on a first load. Both read
    // one prop folded from one read in one server render, and nothing on the
    // route streams or shows a loading state, so there is no first paint where
    // they could differ. This pins that.
    await renderPage();

    const card = screen.getByText("Needs action", { selector: "p" });
    expect(card.previousElementSibling).toHaveTextContent("8");
    expect(
      screen.getByRole("link", { name: "Needs action (8)" }),
    ).toBeInTheDocument();
  });

  it("does not touch the calendar query", async () => {
    // The two answer different questions; running both would double the work
    // for whichever one nobody is looking at.
    await renderPage();
    expect(queries.getBookingCalendar).not.toHaveBeenCalled();
  });
});

describe("BookingQueuePage — the view toggle", () => {
  it("is a working link now, not a disabled button", async () => {
    await renderPage();
    const calendar = screen.getByRole("link", { name: "Calendar" });
    expect(calendar).toBeInTheDocument();
    expect(calendar.getAttribute("href")).toMatch(/view=calendar&month=\d{4}-\d{2}/);
  });

  it("drops the status filter and the search term on the way to the calendar", async () => {
    // Neither has a meaning on a grid. Say so, or a reviewer reads it as a bug.
    await renderPage({ status: "confirmed", q: "chamber" });
    const calendar = screen.getByRole("link", { name: "Calendar" });
    expect(calendar.getAttribute("href")).not.toContain("status");
    expect(calendar.getAttribute("href")).not.toContain("q=");
  });

  it("returns to an unfiltered list", async () => {
    await renderPage({ view: "calendar" });
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute(
      "href",
      "/staff/booking",
    );
  });

  it("marks the active view", async () => {
    await renderPage({ view: "calendar" });
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "List" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("BookingQueuePage — calendar view", () => {
  it("renders the month grid instead of the queue", async () => {
    await renderPage({ view: "calendar", month: "2026-08" });

    expect(
      screen.getByRole("heading", { name: "August 2026" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Needs action")).not.toBeInTheDocument();
  });

  it("does not touch any queue query", async () => {
    await renderPage({ view: "calendar" });
    expect(queries.getBookingQueue).not.toHaveBeenCalled();
    expect(queries.getBookingStatusCounts).not.toHaveBeenCalled();
    expect(queries.getBalanceOutstanding).not.toHaveBeenCalled();
  });

  it("reads exactly the range the grid draws, padding included", async () => {
    // A booking on a visible padded day is real occupancy; missing it would
    // draw a free evening that is not free. These are the grid's own bounds,
    // handed over by the calendar module — the route does no date arithmetic
    // and holds no opinion about how far the padding reaches.
    await renderPage({ view: "calendar", month: "2026-08" });

    expect(queries.getBookingCalendar).toHaveBeenCalledWith(
      "2026-07-26",
      "2026-09-05",
    );
  });

  it("falls back to the current month for a month that names none", async () => {
    await renderPage({ view: "calendar", month: "2026-13" });
    // Whatever today's month is, it renders a grid rather than an empty one.
    expect(screen.getByRole("link", { name: "Today" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
  });

  it("falls back for a month that is not a month at all", async () => {
    await renderPage({ view: "calendar", month: "banana" });
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
  });
});
