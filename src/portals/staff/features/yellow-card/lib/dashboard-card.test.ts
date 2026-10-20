import { afterEach, describe, expect, it, vi } from "vitest";
import {
  contentRange,
  createFailingFetch,
  createRecordingFetch,
  createTestClient,
  parseQueryParams,
  postgrestErrorBody,
  type RecordedRequest,
} from "@/portals/staff/lib/supabase/testing";
import {
  buildYellowCardCard,
  getYellowCardCard,
  waitingLabel,
  type PreviewRow,
} from "./dashboard-card";

const now = new Date("2026-08-07T00:00:00.000Z");

describe("waitingLabel", () => {
  it("counts whole days since submission", () => {
    expect(waitingLabel("2026-08-03T00:00:00.000Z", now)).toBe("4d waiting");
  });

  it("says today for something submitted hours ago", () => {
    expect(waitingLabel("2026-08-06T18:00:00.000Z", now)).toBe("today");
  });
});

describe("buildYellowCardCard", () => {
  const rows = [
    {
      id: "a",
      first_name: "Juan",
      middle_name: null,
      last_name: "Dela Cruz",
      suffix: null,
      submitted_at: "2026-08-03T00:00:00.000Z",
      due_at: "2026-08-05T00:00:00.000Z",
      deadline_state: "overdue",
    },
    {
      id: "b",
      first_name: "Maria",
      middle_name: null,
      last_name: "Santos",
      suffix: null,
      submitted_at: "2026-08-06T00:00:00.000Z",
      due_at: "2026-08-09T00:00:00.000Z",
      deadline_state: "at_risk",
    },
    {
      id: "c",
      first_name: "Pedro",
      middle_name: null,
      last_name: "Reyes",
      suffix: null,
      submitted_at: "2026-08-06T12:00:00.000Z",
      due_at: "2026-08-10T00:00:00.000Z",
      deadline_state: "on_track",
    },
  ] satisfies PreviewRow[];

  it("reports the totals it was given rather than the length of the preview", () => {
    const card = buildYellowCardCard({ pending: 12, atRisk: 5, overdue: 3, rows, now });

    expect(card.module).toBe("yellow-card");
    expect(card.pending).toBe(12);
    expect(card.atRisk).toBe(5);
    expect(card.overdue).toBe(3);
  });

  it("previews at most three applicants, by full name", () => {
    const many = [...rows, ...rows, ...rows];
    const card = buildYellowCardCard({ pending: 9, atRisk: 0, overdue: 0, rows: many, now });

    expect(card.preview).toHaveLength(3);
    expect(card.preview[0].label).toBe("Juan Dela Cruz");
  });

  /**
   * The tone is the database's state (l80), never a comparison of due_at
   * against the browser clock: Overdue is red, At risk amber, On track plain —
   * so amber means "At risk" on the card and in the queue alike.
   */
  it("tones Overdue as critical, At risk as a warning and On track as neutral", () => {
    const card = buildYellowCardCard({ pending: 3, atRisk: 1, overdue: 1, rows, now });

    expect(card.preview[0].tag).toEqual({ text: "4d waiting", tone: "critical" });
    expect(card.preview[1].tag).toEqual({ text: "1d waiting", tone: "warning" });
    expect(card.preview[2].tag).toEqual({ text: "today", tone: "neutral" });
  });

  it("tones a stopped clock (no state) as neutral", () => {
    const card = buildYellowCardCard({
      pending: 1,
      atRisk: 0,
      overdue: 0,
      rows: [{ ...rows[0], due_at: null, deadline_state: null }],
      now,
    });

    expect(card.preview[0].tag.tone).toBe("neutral");
  });

  it("returns an empty preview when nothing is awaiting review", () => {
    const card = buildYellowCardCard({ pending: 0, atRisk: 0, overdue: 0, rows: [], now });

    expect(card.preview).toEqual([]);
    expect(card.pending).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The reader on the seam
// ---------------------------------------------------------------------------

/**
 * The card's two figures are counts, so the rows the recorder returns are
 * deliberately fewer than the count it reports — a reader that totalled the
 * rows would come back with 3, not 12.
 */
const CANNED_PREVIEW_ROWS: PreviewRow[] = [
  {
    id: "app-1",
    first_name: "Juan",
    middle_name: null,
    last_name: "Dela Cruz",
    suffix: null,
    submitted_at: "2026-08-03T00:00:00.000Z",
    due_at: "2026-08-05T00:00:00.000Z",
    deadline_state: "overdue",
  },
  {
    id: "app-2",
    first_name: "Maria",
    middle_name: null,
    last_name: "Santos",
    suffix: null,
    submitted_at: "2026-08-04T00:00:00.000Z",
    due_at: "2026-08-09T00:00:00.000Z",
    deadline_state: "at_risk",
  },
  {
    id: "app-3",
    first_name: "Pedro",
    middle_name: null,
    last_name: "Reyes",
    suffix: null,
    submitted_at: "2026-08-06T00:00:00.000Z",
    due_at: null,
    deadline_state: null,
  },
];

/**
 * All three requests fire inside one Promise.all, so the order they land in
 * `requests` is not guaranteed. The preview is the one that is not head-only;
 * the two counts are told apart by the state they filter on.
 */
const previewRequest = (requests: RecordedRequest[]) =>
  requests.find((r) => r.method !== "HEAD")!;

const countRequest = (requests: RecordedRequest[], state: "overdue" | "at_risk") =>
  requests.find(
    (r) =>
      r.method === "HEAD" &&
      parseQueryParams(r.url).filters["deadline_state"]?.[0] === `eq.${state}`,
  )!;

const overdueRequest = (requests: RecordedRequest[]) => countRequest(requests, "overdue");
const atRiskRequest = (requests: RecordedRequest[]) => countRequest(requests, "at_risk");

/** Answers each head-only count with its own total, the preview with 12. */
function perStateCountFetch(totals: { overdue: number; at_risk: number }): typeof globalThis.fetch {
  return async (input, init) => {
    const req = new Request(input, init);
    const state = parseQueryParams(req.url).filters["deadline_state"]?.[0]?.replace("eq.", "");
    const total =
      req.method === "HEAD" ? totals[state as "overdue" | "at_risk"] : 12;

    return new Response(req.method === "HEAD" ? null : JSON.stringify(CANNED_PREVIEW_ROWS), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-range": contentRange(req.method === "HEAD" ? 0 : CANNED_PREVIEW_ROWS.length, total),
      },
    });
  };
}

/** The serialised filter both requests must carry, not the status set itself. */
const AWAITING_FILTER = "in.(pending,resubmitted)";

/** Restores the clock for the two tests below that fix it. */
afterEach(() => {
  vi.useRealTimers();
});

/**
 * The two requests need different answers, which neither shared helper can
 * give — both answer every request the same way. Only the overdue count is
 * head-only, so its method is what singles it out.
 *
 * The response shapes come from the shared layer rather than being restated
 * here, so that canned rows and error keys cannot drift out from under it.
 */
function failingOverdueCountFetch(message: string): typeof globalThis.fetch {
  return async (input, init) => {
    const req = new Request(input, init);

    if (req.method === "HEAD") {
      return new Response(JSON.stringify(postgrestErrorBody(message)), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify(CANNED_PREVIEW_ROWS), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-range": contentRange(CANNED_PREVIEW_ROWS.length, 12),
      },
    });
  };
}

describe("getYellowCardCard", () => {
  it("sends exactly three requests", async () => {
    const { fetch, requests } = createRecordingFetch(CANNED_PREVIEW_ROWS, {
      rowCount: 12,
    });
    const db = createTestClient(fetch);

    await getYellowCardCard(db);

    expect(requests).toHaveLength(3);
  });

  it("reads the preview from staff_yellow_card_queue", async () => {
    const { fetch, requests } = createRecordingFetch(CANNED_PREVIEW_ROWS, {
      rowCount: 12,
    });
    const db = createTestClient(fetch);

    await getYellowCardCard(db);

    const params = parseQueryParams(previewRequest(requests).url);
    expect(params.table).toBe("staff_yellow_card_queue");
  });

  it("selects the exact column list for the preview", async () => {
    const { fetch, requests } = createRecordingFetch(CANNED_PREVIEW_ROWS, {
      rowCount: 12,
    });
    const db = createTestClient(fetch);

    await getYellowCardCard(db);

    const params = parseQueryParams(previewRequest(requests).url);
    const columns = params.select!.split(",").map((c) => c.trim());

    expect(columns).toEqual([
      "id",
      "first_name",
      "middle_name",
      "last_name",
      "suffix",
      "submitted_at",
      "due_at",
      "deadline_state",
    ]);
  });

  it("orders the preview by soonest deadline, with a paused clock last", async () => {
    const { fetch, requests } = createRecordingFetch(CANNED_PREVIEW_ROWS, {
      rowCount: 12,
    });
    const db = createTestClient(fetch);

    await getYellowCardCard(db);

    const params = parseQueryParams(previewRequest(requests).url);
    expect(params.order).toBe("due_at.asc.nullslast");
  });

  it("asks for three preview rows", async () => {
    const { fetch, requests } = createRecordingFetch(CANNED_PREVIEW_ROWS, {
      rowCount: 12,
    });
    const db = createTestClient(fetch);

    await getYellowCardCard(db);

    const params = parseQueryParams(previewRequest(requests).url);
    expect(params.limit).toBe("3");
  });

  it("asks the preview request for an exact count", async () => {
    const { fetch, requests } = createRecordingFetch(CANNED_PREVIEW_ROWS, {
      rowCount: 12,
    });
    const db = createTestClient(fetch);

    await getYellowCardCard(db);

    expect(previewRequest(requests).headers["prefer"]).toContain("count=exact");
  });

  it("takes the pending figure from that count, not from the rows returned", async () => {
    const { fetch } = createRecordingFetch(CANNED_PREVIEW_ROWS, { rowCount: 12 });
    const db = createTestClient(fetch);

    const card = await getYellowCardCard(db);

    expect(card.pending).toBe(12);
    expect(card.preview).toHaveLength(CANNED_PREVIEW_ROWS.length);
  });

  it("narrows every request to the statuses a staff member still has to act on", async () => {
    const { fetch, requests } = createRecordingFetch(CANNED_PREVIEW_ROWS, {
      rowCount: 12,
    });
    const db = createTestClient(fetch);

    await getYellowCardCard(db);

    expect(parseQueryParams(previewRequest(requests).url).filters["status"]).toEqual([
      AWAITING_FILTER,
    ]);
    expect(parseQueryParams(overdueRequest(requests).url).filters["status"]).toEqual([
      AWAITING_FILTER,
    ]);
    expect(parseQueryParams(atRiskRequest(requests).url).filters["status"]).toEqual([
      AWAITING_FILTER,
    ]);
  });

  it.each([
    ["overdue", overdueRequest],
    ["at-risk", atRiskRequest],
  ] as const)("asks for the %s figure head-only, transferring no rows", async (_, pick) => {
    const { fetch, requests } = createRecordingFetch(CANNED_PREVIEW_ROWS, {
      rowCount: 12,
    });
    const db = createTestClient(fetch);

    await getYellowCardCard(db);

    const count = pick(requests);
    expect(count.method).toBe("HEAD");
    expect(count.headers["prefer"]).toContain("count=exact");
    expect(parseQueryParams(count.url).select).toBe("id");
  });

  it("takes each figure from its own count", async () => {
    const db = createTestClient(perStateCountFetch({ overdue: 3, at_risk: 5 }));

    const card = await getYellowCardCard(db);

    expect(card.overdue).toBe(3);
    expect(card.atRisk).toBe(5);
    expect(card.pending).toBe(12);
  });

  /**
   * The whole filter set of each count, asserted as one equality carrying the
   * values.
   *
   * The state is the database's deadline_state (l80), not `due_at < now`: the
   * browser clock and the database's Working Time would otherwise be two
   * definitions of Overdue, and the card and the queue badge could disagree.
   * A stopped clock has no state, so no filter matches it. The status set is
   * Awaiting Review and not some other, because a count over decided
   * applications is a backlog nobody can clear. And nothing sits beside the
   * two: `barangay_code` is the tempting third, on a Dashboard that already
   * knows which barangay a clerk works, and it would narrow a figure the card
   * presents as whole.
   *
   * Whole-set equality rather than key names (#46/#50): a key-names check
   * passes against the two states swapped, which puts each figure under the
   * other's label.
   */
  it("counts Overdue and At risk on Awaiting Review and the database's state, and nothing else", async () => {
    const { fetch, requests } = createRecordingFetch(CANNED_PREVIEW_ROWS, {
      rowCount: 12,
    });
    const db = createTestClient(fetch);

    await getYellowCardCard(db);

    expect(parseQueryParams(overdueRequest(requests).url).filters).toEqual({
      deadline_state: ["eq.overdue"],
      status: [AWAITING_FILTER],
    });
    expect(parseQueryParams(atRiskRequest(requests).url).filters).toEqual({
      deadline_state: ["eq.at_risk"],
      status: [AWAITING_FILTER],
    });
  });

  it("raises when the preview read fails, rather than reporting an empty card", async () => {
    const { fetch } = createFailingFetch({
      status: 500,
      message: "permission denied for view staff_yellow_card_queue",
    });
    const db = createTestClient(fetch);

    await expect(getYellowCardCard(db)).rejects.toThrow(
      /yellow card dashboard read failed: permission denied/,
    );
  });

  it("reports zero when a count fails, instead of raising", async () => {
    // Current behaviour, pinned rather than endorsed: only the preview
    // result's error is checked, so a failed count reaches the card as a
    // reassuring nought. Changing that is a behaviour change and a separate
    // ticket. l80 added the at-risk count on the same terms.
    const db = createTestClient(failingOverdueCountFetch("statement timeout"));

    const card = await getYellowCardCard(db);

    expect(card.overdue).toBe(0);
    expect(card.atRisk).toBe(0);
    expect(card.pending).toBe(12);
  });
});
