import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAuditEntries } from "./queries";

// Tested at the network: the supabase-js builder is real, so these assertions
// are about the requests it actually sends. The fake stands in for PostgREST on
// `super_audit_log` and, like it, never answers more than 1,000 rows.

const DB_MAX_ROWS = 1000;

type FakeRow = {
  id: string;
  occurred_at: string;
  area: string;
  change: string;
};

let table: FakeRow[];
let requests: URL[];
/** Runs after a page is served, for what happens "between pages". */
let afterPage: (pageNumber: number) => void;
/** The page number (1-based) that answers with an error, if any. */
let failingPage: number | null;

// Three rows share each timestamp, as rows written by one transaction do.
function makeRows(count: number): FakeRow[] {
  const newest = Date.UTC(2026, 10, 6, 15, 24, 11);
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${String(i).padStart(5, "0")}`,
    occurred_at: new Date(newest - Math.floor(i / 3) * 1000)
      .toISOString()
      .replace("Z", "649+00:00"),
    area: "auth",
    change: "Signed in",
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

  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? DB_MAX_ROWS),
    DB_MAX_ROWS,
  );
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const upTo = url.searchParams.get("occurred_at")?.replace(/^lte\./, "");
  const matching = upTo
    ? table.filter((row) => row.occurred_at <= upTo)
    : table;

  const pageNumber = pages().length;
  if (isPage(url) && pageNumber === failingPage) {
    return json({ code: "42501", message: "not an active Super-staff" }, 403);
  }
  const page = matching.slice(offset, offset + limit);
  if (isPage(url)) afterPage(pageNumber);
  return json(page);
}

function isPage(url: URL): boolean {
  return url.searchParams.has("offset");
}

/** The requests that read a page of the log. */
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
  afterPage = () => {};
  failingPage = null;
});

describe("listAuditEntries", () => {
  it.each([
    ["more than one page", 2663],
    ["an exact multiple of the page size", 2000],
    ["exactly one page", 1000],
    ["less than one page", 3],
    ["nothing", 0],
  ])("returns every row, once, when the log holds %s", async (_, count) => {
    table = makeRows(count);

    const entries = await listAuditEntries();

    expect(entries.map((e) => e.id)).toEqual(table.map((row) => row.id));
  });

  // Rows can share a timestamp, so without a tie-break a row at a page edge can
  // land on both pages or on neither.
  it("orders every page on occurred_at, then id", async () => {
    table = makeRows(2500);

    await listAuditEntries();

    expect(pages().map((url) => url.searchParams.get("order"))).toEqual([
      "occurred_at.desc,id.desc",
      "occurred_at.desc,id.desc",
      "occurred_at.desc,id.desc",
    ]);
  });

  it("limits every page to the newest row when the load started, to the microsecond", async () => {
    table = makeRows(2500);

    await listAuditEntries();

    const newest = "2026-11-06T15:24:11.000649+00:00";
    expect(table[0].occurred_at).toBe(newest);
    expect(pages().map((url) => url.searchParams.get("occurred_at"))).toEqual([
      `lte.${newest}`,
      `lte.${newest}`,
      `lte.${newest}`,
    ]);
  });

  it("does not repeat a row when a new one is written between pages", async () => {
    table = makeRows(1500);
    const before = table.map((row) => row.id);
    afterPage = (pageNumber) => {
      if (pageNumber === 1) {
        table = [
          {
            id: "written-during-the-load",
            occurred_at: "2026-11-06T15:24:12.000000+00:00",
            area: "auth",
            change: "Signed in",
          },
          ...table,
        ];
      }
    };

    const entries = await listAuditEntries();

    expect(entries.map((e) => e.id)).toEqual(before);
  });

  it("rejects with no rows when a later page fails", async () => {
    table = makeRows(2500);
    failingPage = 2;

    await expect(listAuditEntries()).rejects.toMatchObject({
      name: "RpcError",
      kind: "permission",
    });
    expect(pages()).toHaveLength(2);
  });

  it("stops asking for pages once the signal is aborted", async () => {
    table = makeRows(2500);
    const controller = new AbortController();
    afterPage = () => controller.abort();

    await expect(listAuditEntries(controller.signal)).rejects.toBeTruthy();

    expect(pages()).toHaveLength(1);
  });

  it("sends nothing at all when the signal is already aborted", async () => {
    table = makeRows(2500);
    const controller = new AbortController();
    controller.abort();

    await expect(listAuditEntries(controller.signal)).rejects.toBeTruthy();

    expect(requests).toHaveLength(0);
  });
});
