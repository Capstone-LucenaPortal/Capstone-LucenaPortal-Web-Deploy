import { describe, expect, it } from "vitest";
import {
  createFailingFetch,
  createRecordingFetch,
  createTestClient,
  orClausesOf,
  parseQueryParams,
} from "@/portals/staff/lib/supabase/testing";
import {
  getAtRiskCount,
  getIncidentQueue,
  getIncidentStatusCounts,
  readAwaitingTriageCount,
} from "./queries";
import type { StaffIncidentQueueRow } from "./row-mapper";

/**
 * The reads in this module on ADR-0001's recording-fetch seam. What is
 * asserted is the request that would have reached the database — which view,
 * which columns, which orderings, which filters — and the rule applied to the
 * answer.
 *
 * Every read behind the queue page is here bar one: `getAtRiskThreshold` in
 * ./config.ts is `cache()`-wrapped on purpose and so must never take a client,
 * per ADR-0001. The three detail reads are no longer in ./queries.ts at all —
 * they are private to ./incident-dossier.ts and asserted through
 * `getIncidentDossier` in its own test, on this same seam. The shell in
 * ./actions.ts is deliberately not tested — see the note above
 * `readAwaitingTriageCount`.
 */

// ---------------------------------------------------------------------------
// Queue read
// ---------------------------------------------------------------------------

const CANNED_QUEUE_ROW: StaffIncidentQueueRow = {
  id: "inc-1",
  reference_number: "INC-2026-000123",
  type_label: "Flooding",
  incident_level: "high",
  status: "in_progress",
  closure_reason: null,
  is_verified: true,
  barangay_name: "Barangay Ibabang Dupay",
  submitted_at: "2026-08-01T02:11:09.114000+00:00",
  sla_armed_at: "2026-08-01T02:40:00.000000+00:00",
  sla_due_at: "2026-08-02T02:40:00.000000+00:00",
  resolved_at: null,
  closed_at: null,
  duplicate_of: null,
  original_reference: null,
};

describe("getIncidentQueue", () => {
  it("queries the staff_incidents view", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getIncidentQueue({}, db);

    expect(requests).toHaveLength(1);
    expect(parseQueryParams(requests[0].url).table).toBe("staff_incidents");
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

    await getIncidentQueue({}, db);

    const columns = parseQueryParams(requests[0].url)
      .select!.split(",")
      .map((column) => column.trim());

    expect(columns).toEqual([
      "id",
      "reference_number",
      "type_label",
      "incident_level",
      "status",
      "closure_reason",
      "is_verified",
      "barangay_name",
      "submitted_at",
      "sla_armed_at",
      "sla_due_at",
      "resolved_at",
      "closed_at",
      "duplicate_of",
      "original_reference",
    ]);
  });

  /**
   * The most load-bearing sequence of lines in the module, asserted whole:
   * four orderings and two different null placements, in the order they are
   * applied. Inverting any one of them, or flipping either null placement,
   * puts the wrong report in front of the officer with nothing on screen to
   * say so — so it is pinned as one equality rather than four containments.
   */
  it("orders by closure, then resolution, then deadline, then most recent", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getIncidentQueue({}, db);

    expect(parseQueryParams(requests[0].url).order!.split(",")).toEqual([
      "closed_at.asc.nullsfirst",
      "resolved_at.asc.nullsfirst",
      "sla_due_at.asc.nullslast",
      "submitted_at.desc",
    ]);
  });

  /**
   * What the first two orderings mean on screen: everything not yet closed
   * comes ahead of everything closed, and within that everything unresolved
   * comes ahead of everything resolved. Both columns are NULL exactly while
   * the thing has not happened yet, which is why nullsfirst is what puts live
   * work in front rather than finished work.
   */
  it("puts incidents not yet closed first, and unresolved before resolved", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getIncidentQueue({}, db);

    const [closure, resolution] =
      parseQueryParams(requests[0].url).order!.split(",");

    expect(closure).toBe("closed_at.asc.nullsfirst");
    expect(resolution).toBe("resolved_at.asc.nullsfirst");
  });

  /**
   * sla_due_at is NULL while the clock has never armed — an unverified report
   * has no deadline to breach. Those sort last rather than crowding out work
   * with a live deadline, which is what nullslast buys, and it is the one null
   * placement in this read that runs the other way.
   */
  it("sorts an incident whose SLA clock never armed last", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getIncidentQueue({}, db);

    expect(parseQueryParams(requests[0].url).order!.split(",")[2]).toBe(
      "sla_due_at.asc.nullslast",
    );
  });

  /**
   * A report nobody has routed has no SLA clock — the clock arms on routing —
   * so the deadline ordering sinks it below every breached row in the pool.
   * But it is the one row in the queue waiting on somebody in this building,
   * which is what Awaiting Triage means (CONTEXT.md). It comes first, and the
   * database's order stands everywhere else — within the Awaiting Triage rows
   * as much as outside them.
   */
  it("puts reports awaiting triage first and keeps the database's order otherwise", async () => {
    const queueRow = (id: string, status: StaffIncidentQueueRow["status"]) => ({
      ...CANNED_QUEUE_ROW,
      id,
      status,
    });
    const { fetch } = createRecordingFetch([
      queueRow("breached-1", "in_pool"),
      queueRow("breached-2", "in_progress"),
      queueRow("rejected-back", "open"),
      queueRow("breached-3", "in_pool"),
      queueRow("new-report", "open"),
      queueRow("done", "resolved"),
    ]);

    const queue = await getIncidentQueue({}, createTestClient(fetch));

    expect(queue.map((item) => item.id)).toEqual([
      "rejected-back",
      "new-report",
      "breached-1",
      "breached-2",
      "breached-3",
      "done",
    ]);
  });

  /**
   * One screenful, defensible only because the queue is ordered by urgency:
   * the rows past this limit are by construction the least urgent.
   */
  it("limits the queue to one screenful", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getIncidentQueue({}, db);

    expect(parseQueryParams(requests[0].url).limit).toBe("100");
  });

  /**
   * A desk officer looks a report up by whichever detail they happen to hold.
   * `address` is searched but never displayed in the queue, which is exactly
   * why the list is worth asserting separately: a search that quietly stops
   * covering it is invisible until someone cannot find a report they know
   * exists.
   */
  it("searches reference number, incident type, barangay and address", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getIncidentQueue({ search: "dupay" }, db);

    const clauses = orClausesOf(parseQueryParams(requests[0].url));

    expect(clauses).toEqual([
      'reference_number.ilike."%dupay%"',
      'type_label.ilike."%dupay%"',
      'barangay_name.ilike."%dupay%"',
      'address.ilike."%dupay%"',
    ]);
  });

  it("omits the search filter when there is nothing to search for", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getIncidentQueue({ search: "   " }, db);

    expect(parseQueryParams(requests[0].url).filters["or"]).toBeUndefined();
  });

  it("narrows the queue when a status tab is selected", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getIncidentQueue({ status: "in_pool" }, db);

    expect(parseQueryParams(requests[0].url).filters["status"]).toEqual([
      "eq.in_pool",
    ]);
  });

  it("does not narrow the queue when no status tab is selected", async () => {
    const { fetch, requests } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    await getIncidentQueue({ status: "all" }, db);

    expect(parseQueryParams(requests[0].url).filters["status"]).toBeUndefined();
  });

  it("maps the canned row through the row mapper", async () => {
    const { fetch } = createRecordingFetch([CANNED_QUEUE_ROW]);
    const db = createTestClient(fetch);

    expect(await getIncidentQueue({}, db)).toEqual([
      {
        id: "inc-1",
        reference_number: "INC-2026-000123",
        type_label: "Flooding",
        incident_level: "high",
        status: "in_progress",
        closure_reason: null,
        is_verified: true,
        barangay_name: "Barangay Ibabang Dupay",
        submitted_at: "2026-08-01T02:11:09.114000+00:00",
        sla_armed_at: "2026-08-01T02:40:00.000000+00:00",
        sla_due_at: "2026-08-02T02:40:00.000000+00:00",
        resolved_at: null,
        closed_at: null,
        duplicate_of: null,
        original_reference: null,
      },
    ]);
  });

  /**
   * A failed read must raise. Swallowing it and returning [] renders on screen
   * as "no work to do" — the officer sees an empty queue and goes home.
   */
  it("raises when the read fails rather than returning an empty queue", async () => {
    const { fetch } = createFailingFetch({
      status: 500,
      message: "permission denied for view staff_incidents",
    });
    const db = createTestClient(fetch);

    await expect(getIncidentQueue({}, db)).rejects.toThrow(
      /staff_incidents read failed: permission denied/,
    );
  });
});

// ---------------------------------------------------------------------------
// Awaiting-triage count
// ---------------------------------------------------------------------------

describe("readAwaitingTriageCount", () => {
  it("counts the awaiting-triage statuses without shipping any rows", async () => {
    const { fetch, requests } = createRecordingFetch([], { rowCount: 4 });

    const count = await readAwaitingTriageCount(createTestClient(fetch));

    const params = parseQueryParams(requests[0].url);
    expect(requests[0].method).toBe("HEAD");
    expect(params.table).toBe("staff_incidents");
    expect(params.select).toBe("id");
    expect(count).toBe(4);
  });

  /**
   * The whole filter, asserted as an equality rather than as a containment.
   *
   * An unverified report is counted: it has no SLA clock and may never become
   * real, and deciding which reports are real is what triage *is*. An
   * `is_verified` filter appearing beside the status one would make that
   * decision for the officer, invisibly — so what this pins is the absence of a
   * second filter as much as the presence of the first.
   */
  it("counts unverified reports too", async () => {
    const { fetch, requests } = createRecordingFetch([], { rowCount: 4 });

    await readAwaitingTriageCount(createTestClient(fetch));

    expect(parseQueryParams(requests[0].url).filters).toEqual({
      status: ["in.(open)"],
    });
  });

  /**
   * This runs on a timer behind a triage officer's queue. A blip must not
   * surface as an error while they are reading a row; the caller keeps its last
   * figure and tries again on the next tick.
   */
  it("returns nothing rather than raising when the read fails", async () => {
    const { fetch } = createFailingFetch({ message: "network is unreachable" });

    await expect(
      readAwaitingTriageCount(createTestClient(fetch)),
    ).resolves.toBeNull();
  });

  /** No count header at all is an empty queue, not an unknown figure. */
  it("reports zero rather than nothing when the count comes back absent", async () => {
    const { fetch } = createRecordingFetch([]);

    expect(await readAwaitingTriageCount(createTestClient(fetch))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Status counts
// ---------------------------------------------------------------------------

describe("getIncidentStatusCounts", () => {
  it("queries the staff_incidents view for the status column alone", async () => {
    const { fetch, requests } = createRecordingFetch([{ status: "open" }]);

    await getIncidentStatusCounts(createTestClient(fetch));

    const params = parseQueryParams(requests[0].url);
    expect(params.table).toBe("staff_incidents");
    expect(params.select).toBe("status");
  });

  /**
   * The counts are whole-view, and that is what makes them a workload summary
   * rather than a restatement of the table below them. Every figure a queue
   * shows is whole-view — see CONTEXT.md, "Queue".
   *
   * Asserted as an equality over the whole filter set, and over the absence of
   * a limit, so a search term or a status tab reaching this read fails here
   * rather than showing an officer a summary that only ever agrees with the
   * tab they already clicked.
   */
  it("counts the whole view — no search term and no status tab narrows it", async () => {
    const { fetch, requests } = createRecordingFetch([{ status: "open" }]);

    await getIncidentStatusCounts(createTestClient(fetch));

    const params = parseQueryParams(requests[0].url);
    expect(params.filters).toEqual({});
    expect(params.limit).toBeNull();
  });

  /**
   * Every status gets a tab, so a status nothing is in has to come back as a
   * zero. Left out of the record it renders as a blank tab rather than as
   * "nothing here".
   */
  it("reports a zero for a status no row is in rather than leaving it out", async () => {
    const { fetch } = createRecordingFetch([
      { status: "open" },
      { status: "open" },
    ]);

    expect(await getIncidentStatusCounts(createTestClient(fetch))).toEqual({
      open: 2,
      in_pool: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    });
  });

  /**
   * `status` is nullable on the view, so a row can arrive without one. It is
   * counted nowhere, and it does not take the queue page down with it.
   */
  it("ignores a row with no status rather than throwing", async () => {
    const { fetch } = createRecordingFetch([
      { status: "in_pool" },
      { status: null },
    ]);

    const counts = await getIncidentStatusCounts(createTestClient(fetch));

    expect(counts.in_pool).toBe(1);
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(1);
  });

  /**
   * Five zeroes across the tabs is the wrong-looking success here: it reads as
   * an office with nothing in front of it rather than as a failed read.
   */
  it("raises when the count read fails rather than reporting five zeroes", async () => {
    const { fetch } = createFailingFetch({
      status: 500,
      message: "permission denied for view staff_incidents",
    });

    await expect(
      getIncidentStatusCounts(createTestClient(fetch)),
    ).rejects.toThrow(/staff_incidents count read failed: permission denied/);
  });
});

// ---------------------------------------------------------------------------
// At-risk count
// ---------------------------------------------------------------------------

/** Armed at midnight, due at ten — six of the ten hours gone at NOW. */
const NOW = new Date("2026-08-07T06:00:00.000Z");

function atRiskRow(over: Record<string, unknown> = {}) {
  return {
    is_verified: true,
    status: "in_progress",
    sla_armed_at: "2026-08-07T00:00:00.000Z",
    sla_due_at: "2026-08-07T10:00:00.000Z",
    resolved_at: null,
    closed_at: null,
    ...over,
  };
}

describe("getAtRiskCount", () => {
  it("queries the staff_incidents view", async () => {
    const { fetch, requests } = createRecordingFetch([]);

    await getAtRiskCount(0.5, NOW, createTestClient(fetch));

    expect(requests).toHaveLength(1);
    expect(parseQueryParams(requests[0].url).table).toBe("staff_incidents");
  });

  /**
   * There is no SQL for "at risk", so the read pulls the fields the derivation
   * needs and nothing else. The list is asserted exactly for the reason the
   * queue read's is — a column added without the live check breaks a test —
   * and for one more: a column dropped from it silently changes what
   * `deriveSlaState` is handed, and an absent `is_verified` reads as
   * unverified, which suspends every clock and reports nothing at risk at all.
   */
  it("selects the exact column list the derivation needs", async () => {
    const { fetch, requests } = createRecordingFetch([]);

    await getAtRiskCount(0.5, NOW, createTestClient(fetch));

    const columns = parseQueryParams(requests[0].url)
      .select!.split(",")
      .map((column) => column.trim());

    expect(columns).toEqual([
      "is_verified",
      "status",
      "sla_armed_at",
      "sla_due_at",
      "resolved_at",
      "closed_at",
    ]);
  });

  /**
   * The filter, asserted as an equality rather than as a containment, because
   * what matters is the absence of a second filter as much as the presence of
   * the first — `is_verified` most temptingly, since an unverified report
   * never is at risk. The equality is what fails when one appears; why it must
   * not is beside `getAtRiskCount`.
   */
  it("narrows to the active statuses and nothing else", async () => {
    const { fetch, requests } = createRecordingFetch([]);

    await getAtRiskCount(0.5, NOW, createTestClient(fetch));

    expect(parseQueryParams(requests[0].url).filters).toEqual({
      status: ["in.(open,in_pool,in_progress)"],
    });
  });

  /**
   * The threshold is a fraction of the elapsed window and it is configurable,
   * so the same row is at risk under one setting and healthy under another.
   * The figure has to come from the threshold the caller handed over, not from
   * the default baked into ./sla.ts.
   */
  it("counts against the threshold it was handed", async () => {
    const countAt = async (threshold: number) => {
      const { fetch } = createRecordingFetch([atRiskRow()]);
      return getAtRiskCount(threshold, NOW, createTestClient(fetch));
    };

    // Six tenths of the window gone: past a half-window threshold, short of a
    // three-quarter one.
    expect(await countAt(0.5)).toBe(1);
    expect(await countAt(0.75)).toBe(0);
  });

  /**
   * `now` is the same shape of fact as the threshold, and cuts the same way:
   * the same row is at risk at one moment and healthy at an earlier one. The
   * figure has to come from the moment the caller handed over, so the tile and
   * the rows beneath it can no longer be counting from two different clocks.
   */
  it("counts against the moment it was handed", async () => {
    const countAt = async (now: Date) => {
      const { fetch } = createRecordingFetch([atRiskRow()]);
      return getAtRiskCount(0.5, now, createTestClient(fetch));
    };

    // Six tenths of the window gone at NOW: past a half-window threshold. One
    // tenth gone an hour in: short of it.
    expect(await countAt(NOW)).toBe(1);
    expect(await countAt(new Date("2026-08-07T01:00:00.000Z"))).toBe(0);
  });

  /**
   * The filter says which rows could be at risk; the derivation says which of
   * them are. A row the query let through still has to earn the count.
   */
  it("counts only the rows the derivation says are at risk", async () => {
    const { fetch } = createRecordingFetch([
      atRiskRow(),
      // No SLA clock at all: the citizen has not verified the report.
      atRiskRow({ is_verified: false }),
      // Barely started — one of the ten hours gone.
      atRiskRow({ sla_armed_at: "2026-08-07T05:00:00.000Z" }),
    ]);

    expect(await getAtRiskCount(0.5, NOW, createTestClient(fetch))).toBe(1);
  });

  /**
   * A zero on the At Risk card is the wrong-looking success here: it reads as
   * an office on top of its deadlines.
   */
  it("raises when the read fails rather than reporting nothing at risk", async () => {
    const { fetch } = createFailingFetch({
      status: 500,
      message: "permission denied for view staff_incidents",
    });

    await expect(getAtRiskCount(0.5, NOW, createTestClient(fetch))).rejects.toThrow(
      /staff_incidents at-risk read failed: permission denied/,
    );
  });
});
