import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { BookingQueue } from "./booking-queue";
import { STATUS_ORDER } from "../lib/status";
import { countNeedsAction } from "../lib/actions";
import type { BookingQueueItem, BookingStatus } from "../types";

// The tab row now carries QueueActivityBar, a client component that calls
// useRouter(). These tests render outside the app router, so stub it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

/**
 * The poll the bar is handed. Stubbed rather than left real because the real
 * one is a `"use server"` export that would build a Supabase client; what these
 * tests are about is the figure and the wording, not the read behind them.
 */
vi.mock("../lib/actions", () => ({ countNeedsAction: vi.fn() }));

/**
 * What the queue hands the badge is props, not anything on the screen: the real
 * bar shows a label only once its poll outruns the baseline it was rendered
 * with. So wrap the bar to record the props rather than standing in for it —
 * every test in this file still mounts the component it always did.
 */
const { barProps } = vi.hoisted(() => ({ barProps: vi.fn() }));

vi.mock("@/portals/staff/components/queue/queue-activity-bar", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/portals/staff/components/queue/queue-activity-bar")>();

  return {
    QueueActivityBar: (props: React.ComponentProps<typeof actual.QueueActivityBar>) => {
      barProps({ count: props.count, noun: props.noun });
      return <actual.QueueActivityBar {...props} />;
    },
  };
});

beforeEach(() => {
  barProps.mockClear();
  vi.mocked(countNeedsAction).mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

function item(over: Partial<BookingQueueItem> = {}): BookingQueueItem {
  return {
    id: "bk-1",
    reference_number: "BK-2026-000031",
    status: "awaiting_payment",
    cancellation_reason: null,
    event_title: "Foundation Day",
    event_type_label: "Conference",
    venue_code: "atrium",
    venue_label: "Atrium",
    rate_tier: "commercial",
    tier_verified: false,
    organization_name: "Lucena Chamber",
    contact_person: "Ana Reyes",
    estimated_headcount: 400,
    event_date: "2026-09-14",
    start_time: "09:00:00",
    duration_hours: 8,
    total_fee: 40800,
    balance_amount: 20400,
    hold_expires_at: null,
    submitted_at: "2026-08-11T10:00:00+08:00",
    unverified_payment_count: 0,
    tier_review_since: null,
    ...over,
  };
}

const zeroCounts = Object.fromEntries(
  STATUS_ORDER.map((s) => [s, 0]),
) as Record<BookingStatus, number>;

/** The queue's one moment, handed down from the route (ADR-0005). */
const NOW = new Date("2026-08-11T12:00:00+08:00");

/** cleanup() first: several cases render twice to compare two states. */
function renderQueue(over: Partial<Parameters<typeof BookingQueue>[0]> = {}) {
  cleanup();
  return render(
    <BookingQueue
      bookings={[item()]}
      counts={{ ...zeroCounts, awaiting_payment: 2, confirmed: 3, fully_paid: 3 }}
      needsActionCount={8}
      balanceOutstanding={69750}
      filter="all"
      search=""
      total={21}
      now={NOW}
      {...over}
    />,
  );
}

describe("BookingQueue", () => {
  it("renders a booking row with its venue, not its event type", () => {
    // Venue replaces the mock's Type column — which venue is booked is the
    // fact a scheduler needs, and the calendar plan turns on the same idea.
    renderQueue();
    const row = screen.getByText("BK-2026-000031").closest("tr")!;
    expect(within(row).getByText("Atrium")).toBeInTheDocument();
    expect(within(row).queryByText("Conference")).not.toBeInTheDocument();
  });

  it("names the organiser, falling back to the contact person", () => {
    renderQueue();
    expect(screen.getByText("Lucena Chamber")).toBeInTheDocument();

    renderQueue({ bookings: [item({ organization_name: null })] });
    expect(screen.getByText("Ana Reyes")).toBeInTheDocument();
  });

  it("renders an unpriced booking as an em dash, never as free", () => {
    renderQueue({
      bookings: [item({ status: "awaiting_quote", total_fee: null })],
    });
    const row = screen.getByText("BK-2026-000031").closest("tr")!;
    expect(within(row).getByText("—")).toBeInTheDocument();
    expect(within(row).queryByText("₱0.00")).not.toBeInTheDocument();
  });

  it("labels the action by what the operator is there to do", () => {
    renderQueue({ bookings: [item({ status: "awaiting_quote" })] });
    expect(screen.getByRole("link", { name: "Quote" })).toBeInTheDocument();

    renderQueue({ bookings: [item({ status: "payment_verification" })] });
    expect(screen.getByRole("link", { name: "Review payment" })).toBeInTheDocument();

    renderQueue({ bookings: [item({ status: "confirmed" })] });
    expect(screen.getByRole("link", { name: "Record balance" })).toBeInTheDocument();

    renderQueue({ bookings: [item({ status: "awaiting_tier_review" })] });
    expect(screen.getByRole("link", { name: "Review Tier Claim" })).toBeInTheDocument();

    renderQueue({ bookings: [item({ status: "completed" })] });
    expect(screen.getByRole("link", { name: "View" })).toBeInTheDocument();
  });

  it("says how long a Tier Claim has waited on this desk", () => {
    // SCRUM-198: an undecided claim holds its slot with no Hold, so the age is
    // the only pressure on the desk.
    renderQueue({
      bookings: [
        item({
          status: "awaiting_tier_review",
          rate_tier: "discounted",
          hold_expires_at: null,
          tier_review_since: "2026-08-09T09:00:00+08:00",
        }),
      ],
    });
    const row = screen.getByText("BK-2026-000031").closest("tr")!;
    expect(within(row).getByText("Waiting 2 days")).toBeInTheDocument();
  });

  it("marks a Resubmission as the organiser's turn, not this desk's", () => {
    renderQueue({
      bookings: [
        item({
          status: "awaiting_resubmission",
          rate_tier: "discounted",
          tier_review_since: "2026-08-09T09:00:00+08:00",
        }),
      ],
    });
    const row = screen.getByText("BK-2026-000031").closest("tr")!;
    expect(within(row).getByText("Waiting on organiser")).toBeInTheDocument();
    // tier_review_since is a stamp, not a state: no age outside Tier Review.
    expect(within(row).queryByText(/^Waiting \d/)).toBeNull();
  });

  it("leads the tabs with Needs action, then All, then all ten statuses", () => {
    renderQueue();
    const tabs = screen.getAllByRole("link").filter((l) => /\(\d+\)$/.test(l.textContent ?? ""));
    // Position still matters here — "leads" is the claim — but the tab is
    // found by name first and then asserted to be the one in front. The tab row
    // carries a refresh button and a badge now, so indexing alone would assert
    // only "whatever counted link comes first", whichever tab that turned out
    // to be.
    expect(screen.getByRole("link", { name: "Needs action (8)" })).toBe(tabs[0]);
    expect(screen.getByRole("link", { name: "All (21)" })).toBe(tabs[1]);
    expect(tabs).toHaveLength(2 + STATUS_ORDER.length);
  });

  it("renders the balance outstanding as pesos, labelled as pesos", () => {
    // The dashboard card of the same name is a COUNT. Mixing the two scopes
    // in one row of cards is the bug this label exists to prevent.
    renderQueue();
    expect(screen.getByText("₱69,750.00")).toBeInTheDocument();
    expect(screen.getByText(/Balance outstanding/)).toBeInTheDocument();
  });

  it("counts confirmed events as confirmed plus fully_paid", () => {
    renderQueue();
    const card = screen.getByText("Confirmed events").closest("div")!;
    expect(within(card).getByText("6")).toBeInTheDocument();
  });

  it("carries the search term into every tab href", () => {
    renderQueue({ search: "chamber", filter: "confirmed" });
    const tab = screen.getByRole("link", { name: /^All / });
    expect(tab).toHaveAttribute("href", "/staff/booking?q=chamber");
  });

  // SCRUM-155: the search box has no visible label, so it carries its own name.
  it("names the search box for assistive technology", () => {
    renderQueue({ search: "chamber" });
    expect(screen.getByLabelText("Search bookings")).toHaveValue("chamber");
  });

  it("says nothing matched rather than rendering a broken table", () => {
    renderQueue({ bookings: [] });
    expect(screen.getByText("No bookings match this filter.")).toBeInTheDocument();
  });

  /**
   * "more waiting" rather than the "new" the other two queues pass. Needs
   * Action is a backlog: a booking joins it when a colleague across the room
   * verifies a payment, which is new work but not a new booking. And the badge
   * mounts in the same tab row as the "Needs action" tab's whole-view level for
   * the same set, so "3 new" beside "Needs action (8)" would read as a second,
   * contradictory total rather than as a delta on the first.
   */
  it("hands the activity badge the needs-action figure, called more waiting", () => {
    renderQueue({ needsActionCount: 8 });

    expect(barProps).toHaveBeenCalledWith({ count: 8, noun: "more waiting" });
  });

  /**
   * The count is whole-view. Sitting on Completed must not hide the fact that
   * the backlog has grown — the tab decides which rows are listed, never what
   * the badge is counting.
   */
  it("counts the whole view rather than the active tab", () => {
    renderQueue({ filter: "completed", needsActionCount: 8 });

    expect(barProps).toHaveBeenCalledWith({ count: 8, noun: "more waiting" });
  });

  /**
   * The same wording as the case above, but on screen and beside the figure it
   * must not be mistaken for: a level and a delta, in one tab row.
   */
  it("says how much MORE is waiting, distinctly from the level on the tab", async () => {
    vi.useFakeTimers();
    vi.mocked(countNeedsAction).mockResolvedValue(11);

    renderQueue({ needsActionCount: 8 });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText("3 more waiting")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Needs action (8)" })).toBeInTheDocument();
    expect(screen.queryByText("3 new")).not.toBeInTheDocument();
  });

  it("shows the unverified discount claim distinctly", () => {
    renderQueue({
      bookings: [item({ rate_tier: "discounted", tier_verified: false })],
    });
    expect(screen.getByText("Discounted · unverified")).toBeInTheDocument();
  });
});
