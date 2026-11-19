import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listViewNewestFirst } from "./views";

// Tested at the network: the supabase-js builder is real, so these assertions
// are about the requests it actually sends. The fake stands in for PostgREST on
// one analytics view and, like it, never answers more than 1,000 rows.

const DB_MAX_ROWS = 1000;
const VIEW = "admin_incident_analytics";

type FakeRow = { id: string; submitted_at: string };

let table: FakeRow[];
let requests: URL[];
/** The signal each request was sent with, in request order. */
let signals: (AbortSignal | null | undefined)[];
/** Runs after a page is served, for what happens "between pages". */
let afterPage: (pageNumber: number) => void;
/** Which request (1-based, counting every request) answers with an error. */
let failingRequest: number | null;

// Three rows share each timestamp, as a batch of submissions can. Ids descend
// within a timestamp, matching the id tie-break.
function makeRows(count: number): FakeRow[] {
  const newest = Date.UTC(2026, 10, 6, 15, 24, 11);
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${String(count - i).padStart(5, "0")}`,
    submitted_at: new Date(newest - Math.floor(i / 3) * 1000)
      .toISOString()
      .replace("Z", "649+00:00"),
  }));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function fakePostgrest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // As the real fetch does: an aborted signal never reaches the network.
  init?.signal?.throwIfAborted();

  const url = new URL(String(input));
  requests.push(url);
  signals.push(init?.signal);

  if (requests.length === failingRequest) {
    return json({ code: "42501", message: "read_incidents: caller is not an active Admin" }, 403);
  }

  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? DB_MAX_ROWS),
    DB_MAX_ROWS,
  );
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const upTo = url.searchParams.get("submitted_at")?.replace(/^lte\./, "");
  const matching = table.filter(
    (row) => upTo === undefined || row.submitted_at <= upTo,
  );

  const page = matching.slice(offset, offset + limit);
  if (isPage(url)) afterPage(pages().length);
  return json(page);
}

function isPage(url: URL): boolean {
  return url.searchParams.has("offset");
}

/** The requests that read a page of the view. */
function pages(): URL[] {
  return requests.filter(isPage);
}

vi.mock("@/shared/supabase/client", () => ({
  createClient: () =>
    createSupabaseClient("https://fake.supabase.co", "anon-key", {
      auth: { persistSession: false },
      global: { fetch: fakePostgrest },
    }),
}));

beforeEach(() => {
  table = [];
  requests = [];
  signals = [];
  afterPage = () => {};
  failingRequest = null;
});

describe("listViewNewestFirst", () => {
  it.each([
    ["more than one page", 2663],
    ["an exact multiple of the page size", 2000],
    ["exactly one page", 1000],
    ["less than one page", 3],
  ])("returns every row, once, newest first, when the view holds %s", async (_, count) => {
    table = makeRows(count);

    const rows = await listViewNewestFirst(VIEW);

    expect(rows.map((row) => row.id)).toEqual(table.map((row) => row.id));
  });

  // Rows can share a timestamp, so without a tie-break a row at a page edge can
  // land on both pages or on neither.
  it("orders every page on submitted_at, then id, both descending", async () => {
    table = makeRows(2500);

    await listViewNewestFirst(VIEW);

    expect(pages().map((url) => url.searchParams.get("order"))).toEqual([
      "submitted_at.desc,id.desc",
      "submitted_at.desc,id.desc",
      "submitted_at.desc,id.desc",
    ]);
  });

  it("first reads the view's newest row, then limits every page to it, to the microsecond", async () => {
    table = makeRows(2500);

    await listViewNewestFirst(VIEW);

    const newest = "2026-11-06T15:24:11.000649+00:00";
    expect(table[0].submitted_at).toBe(newest);
    const [first] = requests;
    expect(first.pathname).toBe(`/rest/v1/${VIEW}`);
    expect(first.searchParams.get("select")).toBe("submitted_at");
    expect(first.searchParams.get("order")).toBe("submitted_at.desc");
    expect(first.searchParams.get("limit")).toBe("1");
    expect(
      pages().map((url) => [
        url.pathname,
        url.searchParams.get("select"),
        url.searchParams.get("submitted_at"),
      ]),
    ).toEqual(
      Array.from({ length: 3 }, () => [`/rest/v1/${VIEW}`, "*", `lte.${newest}`]),
    );
  });

  it("does not repeat a row when a new one is submitted between pages", async () => {
    table = makeRows(1500);
    const before = table.map((row) => row.id);
    afterPage = (pageNumber) => {
      if (pageNumber === 1) {
        table = [
          { id: "submitted-during-the-load", submitted_at: "2026-11-06T15:24:12.000000+00:00" },
          ...table,
        ];
      }
    };

    const rows = await listViewNewestFirst(VIEW);

    expect(rows.map((row) => row.id)).toEqual(before);
  });

  it("returns [] for an empty view after one request, asking for no pages", async () => {
    table = [];

    const rows = await listViewNewestFirst(VIEW);

    expect(rows).toEqual([]);
    expect(requests).toHaveLength(1);
    expect(pages()).toHaveLength(0);
  });

  it("sends both the newest-row read and every page with the given signal", async () => {
    table = makeRows(1500);
    const controller = new AbortController();

    await listViewNewestFirst(VIEW, controller.signal);

    // supabase-js may forward the signal or one tied to it, so check that
    // aborting the caller's controller aborts what every request was sent with.
    expect(requests).toHaveLength(3);
    expect(signals.map((signal) => signal?.aborted)).toEqual([false, false, false]);
    controller.abort();
    expect(signals.map((signal) => signal?.aborted)).toEqual([true, true, true]);
  });

  it("stops asking for pages once the signal is aborted", async () => {
    table = makeRows(2500);
    const controller = new AbortController();
    afterPage = () => controller.abort();

    await expect(listViewNewestFirst(VIEW, controller.signal)).rejects.toBeTruthy();

    expect(pages()).toHaveLength(1);
  });

  it("sends nothing at all when the signal is already aborted", async () => {
    table = makeRows(2500);
    const controller = new AbortController();
    controller.abort();

    await expect(listViewNewestFirst(VIEW, controller.signal)).rejects.toBeTruthy();

    expect(requests).toHaveLength(0);
  });

  it("throws a PortalError, asking for no pages, when the newest-row read fails", async () => {
    table = makeRows(2500);
    failingRequest = 1;

    await expect(listViewNewestFirst(VIEW)).rejects.toMatchObject({ kind: "permission" });
    expect(pages()).toHaveLength(0);
  });

  it("throws a PortalError with no rows when a later page fails", async () => {
    table = makeRows(2500);
    failingRequest = 3; // the newest-row read, page 1, then page 2

    await expect(listViewNewestFirst(VIEW)).rejects.toMatchObject({ kind: "permission" });
    expect(pages()).toHaveLength(2);
  });
});
