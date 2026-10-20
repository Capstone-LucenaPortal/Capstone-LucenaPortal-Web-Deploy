import { describe, expect, it } from "vitest";
import {
  createFailingFetch,
  createRecordingFetch,
  createTestClient,
  orClausesOf,
  parseQueryParams,
} from "@/portals/staff/lib/supabase/testing";
import { getYellowCardQueue, getYellowCardStatusCounts } from "./queries";
import type { StaffYellowCardQueueRow } from "./row-mapper";

// ---------------------------------------------------------------------------
// Queue read
// ---------------------------------------------------------------------------

const CANNED_QUEUE_ROW: StaffYellowCardQueueRow = {
  id: "app-1",
  reference_number: "YC-2026-000123",
  first_name: "Maria",
  middle_name: "Santos",
  last_name: "Dela Cruz",
  suffix: null,
  barangay_name: "Barangay Ibabang Dupay",
  status: "pending",
  submitted_at: "2026-08-01T02:11:09.114000+00:00",
  due_at: "2026-08-04T02:11:09.114000+00:00",
  document_count: 3,
  deadline_state: "overdue",
};

describe("getYellowCardQueue", () => {
  it("queries the staff_yellow_card_queue table", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getYellowCardQueue({}, db);

    expect(requests).toHaveLength(1);
    const params = parseQueryParams(requests[0].url);
    expect(params.table).toBe("staff_yellow_card_queue");
  });

  it("selects the exact column list", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getYellowCardQueue({}, db);

    const params = parseQueryParams(requests[0].url);
    const columns = params.select!.split(",").map((c) => c.trim());

    expect(columns).toEqual([
      "id",
      "reference_number",
      "first_name",
      "middle_name",
      "last_name",
      "suffix",
      "barangay_name",
      "status",
      "submitted_at",
      "due_at",
      "document_count",
      "deadline_state",
    ]);
  });

  /**
   * Soonest deadline first is the whole point of the queue: the applications
   * closest to breaching their service level are the ones in front of the
   * reviewer. The tie-break is most recently submitted.
   */
  it("orders by soonest deadline first, then most recently submitted", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getYellowCardQueue({}, db);

    const params = parseQueryParams(requests[0].url);
    const [first, second] = params.order!.split(",");

    expect(first).toMatch(/^due_at\.asc/);
    expect(second).toBe("submitted_at.desc");
  });

  /**
   * due_at is NULL while the clock is paused — the ball is with the citizen.
   * Those rows sort last rather than crowding out work that is genuinely the
   * reviewer's to move, which is what nullslast buys.
   */
  it("sorts applications with a paused clock last", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getYellowCardQueue({}, db);

    const params = parseQueryParams(requests[0].url);
    expect(params.order!.split(",")[0]).toBe("due_at.asc.nullslast");
  });

  it("limits the queue to one screenful", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getYellowCardQueue({}, db);

    const params = parseQueryParams(requests[0].url);
    expect(params.limit).toBe("100");
  });

  /**
   * A reviewer looks an application up by whichever detail they happen to have.
   * A search that quietly stops covering one of these columns is invisible
   * until someone cannot find something they know exists.
   */
  it("searches reference number, first name, last name and barangay", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getYellowCardQueue({ search: "maria" }, db);

    const clauses = orClausesOf(parseQueryParams(requests[0].url));

    expect(clauses).toEqual([
      'reference_number.ilike."%maria%"',
      'first_name.ilike."%maria%"',
      'last_name.ilike."%maria%"',
      'barangay_name.ilike."%maria%"',
    ]);
  });

  it("omits the search filter when there is nothing to search for", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getYellowCardQueue({ search: "   " }, db);

    const params = parseQueryParams(requests[0].url);
    expect(params.filters["or"]).toBeUndefined();
  });

  it("narrows the queue when a status tab is selected", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getYellowCardQueue({ status: "resubmitted" }, db);

    const params = parseQueryParams(requests[0].url);
    expect(params.filters["status"]).toEqual(["eq.resubmitted"]);
  });

  it("does not narrow the queue when no status tab is selected", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getYellowCardQueue({ status: "all" }, db);

    const params = parseQueryParams(requests[0].url);
    expect(params.filters["status"]).toBeUndefined();
  });

  it("maps the canned row through the row mapper", async () => {
    const { fetch } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    const queue = await getYellowCardQueue({}, db);

    expect(queue).toEqual([
      {
        id: "app-1",
        reference_number: "YC-2026-000123",
        first_name: "Maria",
        middle_name: "Santos",
        last_name: "Dela Cruz",
        suffix: null,
        barangay_name: "Barangay Ibabang Dupay",
        status: "pending",
        submitted_at: "2026-08-01T02:11:09.114000+00:00",
        due_at: "2026-08-04T02:11:09.114000+00:00",
        document_count: 3,
        deadline_state: "overdue",
      },
    ]);
  });

  /**
   * A failed read must raise. Swallowing it and returning [] would render as
   * "no work to do" — the reviewer sees an empty queue and goes home.
   */
  it("raises when the read fails rather than returning an empty queue", async () => {
    const { fetch } = createFailingFetch({
      status: 500,
      message: "permission denied for view staff_yellow_card_queue",
    });
    const db = createTestClient(fetch);

    await expect(getYellowCardQueue({}, db)).rejects.toThrow(
      /staff_yellow_card_queue read failed: permission denied/,
    );
  });
});

// ---------------------------------------------------------------------------
// Status counts
// ---------------------------------------------------------------------------

/**
 * The counting helper is exercised here rather than in isolation. It only ever
 * runs on rows this query supplies, so a test that hands it hand-written rows
 * proves the tally and nothing about the read that feeds it.
 */
describe("getYellowCardStatusCounts", () => {
  it("queries the staff_yellow_card_queue table", async () => {
    const { fetch, requests } = createRecordingFetch([]);
    const db = createTestClient(fetch);

    await getYellowCardStatusCounts(db);

    expect(requests).toHaveLength(1);
    const params = parseQueryParams(requests[0].url);
    expect(params.table).toBe("staff_yellow_card_queue");
  });

  /**
   * PostgREST has no GROUP BY, so the tally is done here from one column of
   * every row. Selecting more than status would drag the whole queue over the
   * wire just to count it.
   */
  it("selects only the status column", async () => {
    const { fetch, requests } = createRecordingFetch([]);
    const db = createTestClient(fetch);

    await getYellowCardStatusCounts(db);

    const params = parseQueryParams(requests[0].url);
    expect(params.select).toBe("status");
  });

  /**
   * The tab counts summarise the whole workload. Narrowing them — by the
   * search box, by the selected tab — would turn them into a restatement of
   * the table below them.
   */
  it("counts every application rather than narrowing", async () => {
    const { fetch, requests } = createRecordingFetch([]);
    const db = createTestClient(fetch);

    await getYellowCardStatusCounts(db);

    const params = parseQueryParams(requests[0].url);
    expect(params.filters).toEqual({});
  });

  it("returns a zero for every status, including ones with no rows", async () => {
    const { fetch } = createRecordingFetch([]);
    const db = createTestClient(fetch);

    await expect(getYellowCardStatusCounts(db)).resolves.toEqual({
      pending: 0,
      resubmitted: 0,
      revision_requested: 0,
      approved: 0,
      rejected: 0,
      withdrawn: 0,
    });
  });

  it("tallies the rows it is given by status", async () => {
    const { fetch } = createRecordingFetch([
      ...Array(3).fill({ status: "pending" }),
      ...Array(3).fill({ status: "resubmitted" }),
      ...Array(3).fill({ status: "revision_requested" }),
      ...Array(3).fill({ status: "approved" }),
      ...Array(9).fill({ status: "rejected" }),
      ...Array(9).fill({ status: "withdrawn" }),
    ]);
    const db = createTestClient(fetch);

    await expect(getYellowCardStatusCounts(db)).resolves.toEqual({
      pending: 3,
      resubmitted: 3,
      revision_requested: 3,
      approved: 3,
      rejected: 9,
      withdrawn: 9,
    });
  });

  it("ignores a row with no status rather than throwing", async () => {
    const { fetch } = createRecordingFetch([
      { status: null },
      { status: "pending" },
    ]);
    const db = createTestClient(fetch);

    const counts = await getYellowCardStatusCounts(db);

    expect(counts.pending).toBe(1);
  });

  /**
   * Counts that fail silently render as six zeroes — a reviewer with nothing
   * to do — which is worse than an error page.
   */
  it("raises when the read fails rather than returning six zeroes", async () => {
    const { fetch } = createFailingFetch({
      status: 500,
      message: "permission denied for view staff_yellow_card_queue",
    });
    const db = createTestClient(fetch);

    await expect(getYellowCardStatusCounts(db)).rejects.toThrow(
      /staff_yellow_card_queue count read failed: permission denied/,
    );
  });
});
