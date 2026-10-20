import { describe, expect, it } from "vitest";
import {
  columnsOf,
  createFailingFetch,
  createRecordingFetch,
  createTestClient,
  orClausesOf,
  parseQueryParams,
} from "@/portals/staff/lib/supabase/testing";
import {
  getBalanceOutstanding,
  getBookingCalendar,
  getBookingQueue,
  getBookingStatusCounts,
  readNeedsActionCount,
} from "./queries";
import { NEEDS_ACTION } from "./queue-params";
import type { StaffBookingQueueRow } from "./row-mapper";
import type { BookingStatus } from "../types";

/**
 * The reads in this module on ADR-0001's recording-fetch seam. What is
 * asserted is the request that would have reached the database — which view,
 * which columns, which orderings, which filters — and the rule applied to the
 * answer.
 *
 * Every read in this module is on it, so no query in the file is left without
 * one. The shell in ./actions.ts is deliberately not tested — see the note
 * above `readNeedsActionCount`.
 */

// ---------------------------------------------------------------------------
// Queue read
// ---------------------------------------------------------------------------

const CANNED_QUEUE_ROW: StaffBookingQueueRow = {
  id: "11111111-1111-4111-8111-111111111111",
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
  start_time: "08:00:00",
  duration_hours: 8,
  total_fee: 40800,
  balance_amount: 20400,
  hold_expires_at: "2026-08-14T10:00:00+08:00",
  submitted_at: "2026-08-11T10:00:00+08:00",
  unverified_payment_count: 0,
  tier_review_since: null,
};

describe("getBookingQueue", () => {
  it("queries the staff_bookings view", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({}, db);

    expect(requests).toHaveLength(1);
    expect(parseQueryParams(requests[0].url).table).toBe("staff_bookings");
  });

  /**
   * Every column was verified by live query against the sandbox, and the list
   * carries a standing instruction not to add one without doing the same.
   * Asserting the list exactly is the cheapest enforcement that instruction
   * has: a column added without the live check breaks this test.
   */
  it("selects the exact column list", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({}, db);

    expect(columnsOf(parseQueryParams(requests[0].url))).toEqual([
      "id",
      "reference_number",
      "status",
      "cancellation_reason",
      "event_title",
      "event_type_label",
      "venue_code",
      "venue_label",
      "rate_tier",
      "tier_verified",
      "organization_name",
      "contact_person",
      "estimated_headcount",
      "event_date",
      "start_time",
      "duration_hours",
      "total_fee",
      "balance_amount",
      "hold_expires_at",
      "submitted_at",
      "unverified_payment_count",
      "tier_review_since",
    ]);
  });

  /**
   * The needs-action tab is a backlog, not a schedule: the point of it is how
   * long somebody has been waiting on this office, so the longest wait is at
   * the top. Decision 8 makes slow quoting visible as a staff problem rather
   * than resolving it by dropping the reservation, and this ordering is where
   * that decision is visible on screen.
   *
   * Asserted whole rather than as a containment — an event-date ordering
   * appearing beside this one would put the schedule back in front of a clerk
   * who asked what is overdue.
   */
  it("orders the needs-action tab by submission time, oldest first", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({ status: NEEDS_ACTION }, db);

    expect(parseQueryParams(requests[0].url).order!.split(",")).toEqual([
      "submitted_at.asc",
    ]);
  });

  /**
   * The other side of the branch: every tab that is not the backlog reads as a
   * schedule, so it is ordered by the day of the event and then by the time it
   * starts, in that sequence. Start time alone would interleave four days'
   * mornings; event date alone would leave an evening ahead of the afternoon
   * before it.
   */
  it("orders every other tab by event date, then start time", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({}, db);

    expect(parseQueryParams(requests[0].url).order!.split(",")).toEqual([
      "event_date.asc",
      "start_time.asc",
    ]);
  });

  /**
   * "Every other tab" means every one — a status tab is a schedule too. Swap
   * the two branches and this is the assertion that fails alongside the
   * needs-action one, rather than the two quietly trading places.
   */
  it("orders a status tab as a schedule, not as a backlog", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({ status: "confirmed" }, db);

    expect(parseQueryParams(requests[0].url).order!.split(",")).toEqual([
      "event_date.asc",
      "start_time.asc",
    ]);
  });

  /**
   * One screenful. Unlike the Incidents queue this one is not ordered by
   * urgency, so what the limit drops is the far end of a schedule rather than
   * the least urgent work — which is why the figure is pinned as the
   * deliberate one it is. Raise it when someone asks for paging, not before.
   */
  it("limits the queue to one screenful", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({}, db);

    expect(parseQueryParams(requests[0].url).limit).toBe("100");
  });

  /**
   * A clerk looks a booking up by whichever detail they happen to hold — the
   * reference on the slip, the name of the event, who booked it, or who they
   * spoke to. #28 replaced a hand-assembled `or=` string here with the shared
   * filter builder and shipped on the strength of the Yellow Card queue's wire
   * test; nothing has ever asserted which columns *this* queue searches. A
   * search that quietly stops covering one is invisible until somebody cannot
   * find a booking they know exists.
   */
  it("searches reference number, event title, organisation and contact person", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({ search: "chamber" }, db);

    const clauses = orClausesOf(parseQueryParams(requests[0].url));

    expect(clauses).toEqual([
      'reference_number.ilike."%chamber%"',
      'event_title.ilike."%chamber%"',
      'organization_name.ilike."%chamber%"',
      'contact_person.ilike."%chamber%"',
    ]);
  });

  it("omits the search filter when there is nothing to search for", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({ search: "   " }, db);

    expect(parseQueryParams(requests[0].url).filters["or"]).toBeUndefined();
  });

  /**
   * A status tab narrows to the set the filter names — one status for a status
   * tab, three for the sentinel — and `.in()` rather than `.eq()` is what lets
   * one branch serve both.
   */
  it("narrows the queue when a status tab is selected", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({ status: "confirmed" }, db);

    expect(parseQueryParams(requests[0].url).filters["status"]).toEqual([
      "in.(confirmed)",
    ]);
  });

  it("narrows the needs-action tab to the statuses waiting on this office", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({ status: NEEDS_ACTION }, db);

    expect(parseQueryParams(requests[0].url).filters["status"]).toEqual([
      "in.(awaiting_tier_review,awaiting_quote,payment_verification,confirmed)",
    ]);
  });

  /**
   * No filter at all rather than an `.in()` over all eight statuses — see
   * `statusesFor`. The absent filter is the assertion.
   */
  it("does not narrow the queue when no status tab is selected", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({ status: "all" }, db);

    expect(parseQueryParams(requests[0].url).filters["status"]).toBeUndefined();
  });

  /**
   * The read returns mapped items, not the rows the view handed back — so the
   * canned row here carries the two nulls the mapper collapses rather than a
   * complete row, which would let an identity function pass.
   *
   * `tier_verified` is the load-bearing one: an unreadable verification state
   * collapses to false, because a discount must never be presented as
   * substantiated on the strength of a column nobody could read.
   */
  it("maps the rows through the row mapper", async () => {
    const { fetch } = createRecordingFetch([
      { ...CANNED_QUEUE_ROW, tier_verified: null, reference_number: null },
    ]);
    const db = createTestClient(fetch);

    expect(await getBookingQueue({}, db)).toEqual([
      { ...CANNED_QUEUE_ROW, tier_verified: false, reference_number: "—" },
    ]);
  });

  /**
   * A failed read must raise. Swallowing it and returning [] renders on screen
   * as a day with no bookings — the clerk sees an empty queue and stops
   * looking.
   */
  it("raises when the read fails rather than returning an empty queue", async () => {
    const { fetch } = createFailingFetch({
      status: 500,
      message: "permission denied for view staff_bookings",
    });
    const db = createTestClient(fetch);

    await expect(getBookingQueue({}, db)).rejects.toThrow(
      /staff_bookings read failed: permission denied/,
    );
  });
});

// ---------------------------------------------------------------------------
// Needs-action count
// ---------------------------------------------------------------------------

describe("readNeedsActionCount", () => {
  it("counts the needs-action statuses without shipping any rows", async () => {
    const { fetch, requests } = createRecordingFetch([], { rowCount: 12 });

    const count = await readNeedsActionCount(createTestClient(fetch));

    const params = parseQueryParams(requests[0].url);
    expect(requests[0].method).toBe("HEAD");
    expect(params.table).toBe("staff_bookings");
    expect(params.select).toBe("id");
    expect(count).toBe(12);
  });

  /**
   * The whole filter, asserted as an equality rather than as a containment.
   *
   * These are the four statuses waiting on a person in this building, and
   * `awaiting_payment` is deliberately not among them — that booking is waiting
   * on the organiser, and counting it would announce work nobody here can do.
   * A second filter appearing beside this one (a submitted-at window, say)
   * would quietly turn the backlog into an arrival set, so what this pins is
   * the absence of one as much as the presence of the status filter.
   */
  it("counts the four statuses waiting on this office, and nothing else", async () => {
    const { fetch, requests } = createRecordingFetch([], { rowCount: 12 });

    await readNeedsActionCount(createTestClient(fetch));

    expect(parseQueryParams(requests[0].url).filters).toEqual({
      status: ["in.(awaiting_tier_review,awaiting_quote,payment_verification,confirmed)"],
    });
  });

  /**
   * This runs on a timer behind a booking clerk's queue. A blip must not
   * surface as an error while they are reading a row; the caller keeps its last
   * figure and tries again on the next tick.
   */
  it("returns nothing rather than raising when the read fails", async () => {
    const { fetch } = createFailingFetch({ message: "network is unreachable" });

    await expect(
      readNeedsActionCount(createTestClient(fetch)),
    ).resolves.toBeNull();
  });

  /** No count header at all is an empty backlog, not an unknown figure. */
  it("reports zero rather than nothing when the count comes back absent", async () => {
    const { fetch } = createRecordingFetch([]);

    expect(await readNeedsActionCount(createTestClient(fetch))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Status counts
// ---------------------------------------------------------------------------

/** Ten zeroes, for a test that names only the statuses it cares about. */
const NO_BOOKINGS: Record<BookingStatus, number> = {
  pending: 0,
  awaiting_tier_review: 0,
  awaiting_resubmission: 0,
  awaiting_quote: 0,
  awaiting_payment: 0,
  payment_verification: 0,
  confirmed: 0,
  fully_paid: 0,
  completed: 0,
  cancelled: 0,
};

describe("getBookingStatusCounts", () => {
  it("queries the staff_bookings view for the status column alone", async () => {
    const { fetch, requests } = createRecordingFetch([{ status: "confirmed" }]);

    await getBookingStatusCounts(createTestClient(fetch));

    const params = parseQueryParams(requests[0].url);
    expect(params.table).toBe("staff_bookings");
    expect(params.select).toBe("status");
  });

  /**
   * The counts are whole-view, and that is what makes them a workload summary
   * rather than a restatement of the table below them. Every figure a queue
   * shows is whole-view — see CONTEXT.md, "Queue".
   *
   * Asserted as an equality over the whole filter set, and over the absence of
   * a limit, so a search term or a status tab reaching this read fails here
   * rather than showing a clerk a summary that only ever agrees with the tab
   * they already clicked.
   */
  it("counts the whole view — no search term and no status tab narrows it", async () => {
    const { fetch, requests } = createRecordingFetch([{ status: "confirmed" }]);

    await getBookingStatusCounts(createTestClient(fetch));

    const params = parseQueryParams(requests[0].url);
    expect(params.filters).toEqual({});
    expect(params.limit).toBeNull();
  });

  /**
   * Every status gets a tab, so a status nothing is in has to come back as a
   * zero. Left out of the record it renders as a blank tab rather than as
   * "nothing here" — and `pending` is permanently in that position, since
   * bk_on_submit() never lands on it.
   */
  it("reports a zero for a status no row is in rather than leaving it out", async () => {
    const { fetch } = createRecordingFetch([
      { status: "confirmed" },
      { status: "confirmed" },
    ]);

    expect(await getBookingStatusCounts(createTestClient(fetch))).toEqual({
      ...NO_BOOKINGS,
      confirmed: 2,
    });
  });

  /**
   * `status` is nullable on the view, so a row can arrive without one. It is
   * counted nowhere, and it does not take the queue page down with it.
   */
  it("ignores a row with no status rather than throwing", async () => {
    const { fetch } = createRecordingFetch([
      { status: "awaiting_quote" },
      { status: null },
    ]);

    const counts = await getBookingStatusCounts(createTestClient(fetch));

    expect(counts.awaiting_quote).toBe(1);
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(1);
  });

  /**
   * Eight zeroes across the tabs is the wrong-looking success here: it reads as
   * an office with nothing in front of it rather than as a failed read.
   */
  it("raises when the count read fails rather than reporting eight zeroes", async () => {
    const { fetch } = createFailingFetch({
      status: 500,
      message: "permission denied for view staff_bookings",
    });

    await expect(
      getBookingStatusCounts(createTestClient(fetch)),
    ).rejects.toThrow(/staff_bookings count read failed: permission denied/);
  });
});

// ---------------------------------------------------------------------------
// Outstanding balance
// ---------------------------------------------------------------------------

describe("getBalanceOutstanding", () => {
  it("queries the staff_bookings view for the balance column alone", async () => {
    const { fetch, requests } = createRecordingFetch([{ balance_amount: 1 }]);

    await getBalanceOutstanding(createTestClient(fetch));

    const params = parseQueryParams(requests[0].url);
    expect(params.table).toBe("staff_bookings");
    expect(params.select).toBe("balance_amount");
  });

  /**
   * The whole filter, asserted as an equality rather than as a containment.
   *
   * This figure is whole-view like the counts beside it, but unlike them it is
   * narrowed — to `confirmed`, the status at which money is owed and the event
   * is going to happen. What the equality pins is the absence of a second
   * filter as much as the presence of this one: the current tab is the
   * tempting one, and a figure that silently changed scope on each tab click
   * next to three counts that do not would be the bug.
   */
  it("sums confirmed bookings, and nothing else narrows it", async () => {
    const { fetch, requests } = createRecordingFetch([{ balance_amount: 1 }]);

    await getBalanceOutstanding(createTestClient(fetch));

    const params = parseQueryParams(requests[0].url);
    expect(params.filters).toEqual({ status: ["eq.confirmed"] });
    expect(params.limit).toBeNull();
  });

  it("sums the balances the view hands back", async () => {
    const { fetch } = createRecordingFetch([
      { balance_amount: 20400 },
      { balance_amount: 5000 },
    ]);

    expect(await getBalanceOutstanding(createTestClient(fetch))).toBe(25400);
  });

  /**
   * A `confirmed` booking with a null balance is a data problem, and the read
   * steps over it rather than folding it in.
   *
   * What this test can prove is the narrower half: the null contributes
   * nothing and does not poison the total — a `parseFloat`-style tidy-up would
   * make the whole figure NaN here, and a dropped guard that reached for
   * `row.balance_amount!` would too if the column ever arrived as anything but
   * null. Skipping and adding zero are numerically indistinguishable, so no
   * test can separate them; that half is held by the docblock, which says why
   * the hole is deliberate rather than an oversight to be tidied away.
   */
  it("steps over a null balance rather than poisoning the total", async () => {
    const { fetch } = createRecordingFetch([
      { balance_amount: 20400 },
      { balance_amount: null },
      { balance_amount: 5000 },
    ]);

    expect(await getBalanceOutstanding(createTestClient(fetch))).toBe(25400);
  });

  /**
   * Zero pesos outstanding is the wrong-looking success here: it reads as an
   * office that has collected everything it is owed.
   */
  it("raises when the balance read fails rather than reporting nothing owed", async () => {
    const { fetch } = createFailingFetch({
      status: 500,
      message: "permission denied for view staff_bookings",
    });

    await expect(
      getBalanceOutstanding(createTestClient(fetch)),
    ).rejects.toThrow(/staff_bookings balance read failed: permission denied/);
  });
});

// ---------------------------------------------------------------------------
// Calendar read
// ---------------------------------------------------------------------------

const SEPTEMBER = { from: "2026-09-01", to: "2026-09-30" } as const;

describe("getBookingCalendar", () => {
  it("queries the staff_bookings view", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);

    await getBookingCalendar(
      SEPTEMBER.from,
      SEPTEMBER.to,
      createTestClient(fetch),
    );

    expect(requests).toHaveLength(1);
    expect(parseQueryParams(requests[0].url).table).toBe("staff_bookings");
  });

  /**
   * The calendar reuses the queue's column list rather than carrying a second
   * one, so a column verified once against the live view stays verified for
   * both reads.
   *
   * Asserted as the two requests agreeing rather than against a written-out
   * list, because that is the property: a copy made of the list today would
   * pass a list assertion and fail this one the day the two drift.
   */
  it("selects the same column list the queue read does", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getBookingQueue({}, db);
    await getBookingCalendar(SEPTEMBER.from, SEPTEMBER.to, db);

    expect(requests).toHaveLength(2);
    const [queue, calendar] = requests.map((request) =>
      columnsOf(parseQueryParams(request.url)),
    );
    expect(calendar).toEqual(queue);
  });

  /**
   * The whole filter set, asserted as one equality.
   *
   * Both bounds of the window, because a window open at one end reads on
   * screen as a month drawn from every booking the office has ever taken; and
   * nothing beside them, because a filter on a third column — `venue_code` is
   * the tempting one, on a page that already knows which venue a clerk is
   * looking at — would narrow the month the caller asked for without saying
   * so. The exclusion is here too, and is asserted on its own below as well,
   * so that the rule it defends fails under its own name.
   */
  it("bounds the read to the window it was given, and narrows on nothing else", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);

    await getBookingCalendar(
      SEPTEMBER.from,
      SEPTEMBER.to,
      createTestClient(fetch),
    );

    expect(parseQueryParams(requests[0].url).filters).toEqual({
      event_date: ["gte.2026-09-01", "lte.2026-09-30"],
      status: ["neq.cancelled"],
    });
  });

  /**
   * The most valuable assertion in this file.
   *
   * The exclusion is a not-equals over the one status that releases a hold —
   * NOT an allow-list over the other seven. The enum can gain a ninth value,
   * and a not-equals keeps this query correct on the day it does; it is also
   * exactly what bk_sync_occupancy does, where one transition releases and
   * everything else holds. An allow-list would be silently wrong from that day
   * on, and what it produces is a calendar drawing a free evening that is not
   * free.
   *
   * So the equality is over the serialised operator, not over the set of rows
   * it happens to select today: an `.in()` over the remaining seven selects
   * the same bookings this month and fails here, which is the whole point.
   */
  it("excludes cancelled bookings with a not-equals, not an allow-list", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);

    await getBookingCalendar(
      SEPTEMBER.from,
      SEPTEMBER.to,
      createTestClient(fetch),
    );

    expect(parseQueryParams(requests[0].url).filters["status"]).toEqual([
      "neq.cancelled",
    ]);
  });

  /**
   * A calendar is a schedule, so it is ordered by the day of the event and
   * then by the time it starts — the same sequence the queue's non-backlog
   * tabs use, and for the same reason: start time alone would interleave four
   * days' mornings.
   */
  it("orders the calendar by event date, then start time", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);

    await getBookingCalendar(
      SEPTEMBER.from,
      SEPTEMBER.to,
      createTestClient(fetch),
    );

    expect(parseQueryParams(requests[0].url).order!.split(",")).toEqual([
      "event_date.asc",
      "start_time.asc",
    ]);
  });

  /**
   * No limit, deliberately, where the queue read has one. A month of bookings
   * at one venue cannot approach a screenful, and the failure a truncated
   * calendar produces is not a short list — it is a free evening drawn over a
   * booking that is sitting there.
   */
  it("takes no limit", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);

    await getBookingCalendar(
      SEPTEMBER.from,
      SEPTEMBER.to,
      createTestClient(fetch),
    );

    expect(parseQueryParams(requests[0].url).limit).toBeNull();
  });

  /**
   * The same wrong-looking success as a truncated calendar, at full scale: a
   * month with nothing in it reads as a venue free every evening.
   */
  it("raises when the calendar read fails rather than drawing an empty month", async () => {
    const { fetch } = createFailingFetch({
      status: 500,
      message: "permission denied for view staff_bookings",
    });

    await expect(
      getBookingCalendar(SEPTEMBER.from, SEPTEMBER.to, createTestClient(fetch)),
    ).rejects.toThrow(/staff_bookings calendar read failed: permission denied/);
  });
});
