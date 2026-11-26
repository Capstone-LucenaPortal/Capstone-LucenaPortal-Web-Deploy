import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dateRangeToBounds } from "./date-range";
import {
  countAuditAreas,
  listAuditEntriesForTarget,
  listAuditPage,
  newestAuditEntryAt,
  type AuditPageQuery,
} from "./queries";

// Tested at the network: the supabase-js builder is real, so these assertions
// are about the requests it actually sends. The fake stands in for PostgREST on
// `super_audit_log` and, like it, never answers more than 1,000 rows. It
// applies the time bounds, the area and the target, and answers `count=exact`
// with a Content-Range. It does not evaluate a search: that filter is asserted
// as sent.

const DB_MAX_ROWS = 1000;

const ACCOUNT_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_ID = "33333333-3333-3333-3333-333333333333";
const NEWEST = "2026-11-06T15:24:11.000649+00:00";

type FakeRow = {
  id: string;
  occurred_at: string;
  target_id: string;
  area: string;
  change: string;
};

let table: FakeRow[];
let requests: URL[];
let methods: string[];
/** Runs after a page is served, for what happens "between pages". */
let afterPage: (pageNumber: number) => void;
/** The page number (1-based) that answers with an error, if any. */
let failingPage: number | null;
/** The area whose count answers with an error, if any ("all" for no area). */
let failingCount: string | null;

// Three rows share each timestamp, as rows written by one transaction do.
function makeRows(
  count: number,
  targetId = ACCOUNT_ID,
  area = "auth",
): FakeRow[] {
  const newest = Date.UTC(2026, 10, 6, 15, 24, 11);
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${String(i).padStart(5, "0")}`,
    occurred_at: new Date(newest - Math.floor(i / 3) * 1000)
      .toISOString()
      .replace("Z", "649+00:00"),
    target_id: targetId,
    area,
    change: "Signed in",
  }));
}

function row(id: string, occurredAt: string, area = "auth"): FakeRow {
  return {
    id,
    occurred_at: occurredAt,
    target_id: ACCOUNT_ID,
    area,
    change: "Signed in",
  };
}

/** The microseconds past the millisecond, which a Date drops. */
function micros(instant: string): number {
  return Number((instant.match(/\.\d{3}(\d{1,3})/)?.[1] ?? "").padEnd(3, "0"));
}

/** Instants as PostgreSQL orders them, down to the microsecond. */
function compare(a: string, b: string): number {
  return Date.parse(a) - Date.parse(b) || micros(a) - micros(b);
}

function matchesTime(value: string, filter: string): boolean {
  const dot = filter.indexOf(".");
  const op = filter.slice(0, dot);
  const c = compare(value, filter.slice(dot + 1));
  if (op === "lte") return c <= 0;
  if (op === "lt") return c < 0;
  if (op === "gte") return c >= 0;
  throw new Error(`fake PostgREST: unsupported occurred_at filter ${filter}`);
}

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

async function fakePostgrest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // As the real fetch does: an aborted signal never reaches the network.
  init?.signal?.throwIfAborted();

  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  requests.push(url);
  methods.push(method);

  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? DB_MAX_ROWS),
    DB_MAX_ROWS,
  );
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const times = url.searchParams.getAll("occurred_at");
  const target = url.searchParams.get("target_id")?.replace(/^eq\./, "");
  const area = url.searchParams.get("area")?.replace(/^eq\./, "");
  const matching = table.filter(
    (r) =>
      times.every((t) => matchesTime(r.occurred_at, t)) &&
      (target === undefined || r.target_id === target) &&
      (area === undefined || r.area === area),
  );

  if (method === "HEAD" && (area ?? "all") === failingCount) {
    return json(null, 500);
  }
  const pageNumber = pages().length;
  if (isPage(url) && pageNumber === failingPage) {
    return json({ code: "42501", message: "not an active Super-staff" }, 403);
  }

  const page = matching.slice(offset, offset + limit);
  const counted = /count=exact/.test(
    new Headers(init?.headers).get("Prefer") ?? "",
  );
  const shown = page.length
    ? `${offset}-${offset + page.length - 1}`
    : "*";
  const range: Record<string, string> = counted
    ? { "content-range": `${shown}/${matching.length}` }
    : {};
  if (method === "HEAD") return json(null, 200, range);
  if (isPage(url)) afterPage(pageNumber);
  return json(page, 200, range);
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
  methods = [];
  afterPage = () => {};
  failingPage = null;
  failingCount = null;
});

const pageOf = (patch: Partial<AuditPageQuery> = {}): AuditPageQuery => ({
  fromIso: null,
  beforeIso: null,
  area: "all",
  search: "",
  ceiling: NEWEST,
  page: 1,
  ...patch,
});

describe("newestAuditEntryAt", () => {
  it("is the newest row's timestamp, to the microsecond, in one request", async () => {
    table = makeRows(5);

    expect(await newestAuditEntryAt()).toBe(NEWEST);
    expect(requests).toHaveLength(1);
  });

  it("is null for an empty log", async () => {
    expect(await newestAuditEntryAt()).toBeNull();
  });
});

describe("listAuditPage", () => {
  it("reads the first 50 rows, newest first, with the exact count of every match", async () => {
    table = makeRows(123);

    const { entries, total } = await listAuditPage(pageOf());

    expect(entries.map((e) => e.id)).toEqual(
      table.slice(0, 50).map((r) => r.id),
    );
    expect(total).toBe(123);
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("order")).toBe(
      "occurred_at.desc,id.desc",
    );
    expect(requests[0].searchParams.get("limit")).toBe("50");
  });

  it("reads a later page from its own offset, short on the last page", async () => {
    table = makeRows(123);

    const { entries, total } = await listAuditPage(pageOf({ page: 3 }));

    expect(requests[0].searchParams.get("offset")).toBe("100");
    expect(entries.map((e) => e.id)).toEqual(
      table.slice(100).map((r) => r.id),
    );
    expect(total).toBe(123);
  });

  it("neither reads nor counts a row newer than the ceiling", async () => {
    table = [
      row("written-while-paging", "2026-11-06T15:24:12.000000+00:00"),
      ...makeRows(60),
    ];

    const { entries, total } = await listAuditPage(pageOf());

    expect(entries[0].id).toBe("row-00000");
    expect(total).toBe(60);
  });

  it("keeps the whole To day, to its last fraction of a second, and nothing after it", async () => {
    // 15:59:59.5Z is 23:59:59.500 on 2026-10-30 in PH; 16:00Z is the next day.
    table = [
      row("next-day", "2026-10-30T16:00:00.000000+00:00"),
      row("last-half-second", "2026-10-30T15:59:59.500000+00:00"),
      row("first-instant", "2026-10-29T16:00:00.000000+00:00"),
      row("day-before", "2026-10-29T15:59:59.999999+00:00"),
    ];
    const bounds = dateRangeToBounds({
      fromDate: "2026-10-30",
      toDate: "2026-10-30",
    });

    const { entries, total } = await listAuditPage(
      pageOf({ ...bounds, ceiling: "2026-10-30T16:00:00.000000+00:00" }),
    );

    expect(entries.map((e) => e.id)).toEqual([
      "last-half-second",
      "first-instant",
    ]);
    expect(total).toBe(2);
  });

  it("leaves an empty date box unbounded", async () => {
    table = makeRows(3);

    await listAuditPage(pageOf());

    expect(requests[0].searchParams.getAll("occurred_at")).toEqual([
      `lte.${NEWEST}`,
    ]);
  });

  it("reads one area for its tab, and every area for All", async () => {
    table = [
      ...makeRows(3, ACCOUNT_ID, "auth"),
      ...makeRows(2, ACCOUNT_ID, "content"),
    ];

    const content = await listAuditPage(pageOf({ area: "content" }));
    const all = await listAuditPage(pageOf({ area: "all" }));

    expect(requests[0].searchParams.get("area")).toBe("eq.content");
    expect(content.total).toBe(2);
    expect(requests[1].searchParams.has("area")).toBe(false);
    expect(all.total).toBe(5);
  });

  it("rejects with the classified error when the read fails", async () => {
    table = makeRows(3);
    failingPage = 1;

    await expect(listAuditPage(pageOf())).rejects.toMatchObject({
      name: "RpcError",
      kind: "permission",
    });
  });

  it("sends nothing when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      listAuditPage(pageOf(), controller.signal),
    ).rejects.toBeTruthy();
    expect(requests).toHaveLength(0);
  });
});

describe("listAuditPage — the search", () => {
  const orSent = async (search: string) => {
    requests = [];
    await listAuditPage(pageOf({ search }));
    return requests[0].searchParams.get("or");
  };

  it("sends no search filter for an empty or blank box", async () => {
    expect(await orSent("")).toBeNull();
    expect(await orSent("   ")).toBeNull();
  });

  it("matches the actor or the target, case-insensitively, on the trimmed text", async () => {
    expect(await orSent("  Ramon ")).toBe(
      '(actor_name.imatch."Ramon",target_label.imatch."Ramon")',
    );
  });

  it.each(["sys", "System", " SYSTEM ", "tem", "s"])(
    "also matches the entries with no actor, shown as System, for %j",
    async (search) => {
      expect(await orSent(search)).toMatch(/,actor_name\.is\.null\)$/);
    },
  );

  it.each(["systems", "ramon", "sys tem"])(
    "does not match the entries with no actor for %j",
    async (search) => {
      expect(await orSent(search)).not.toMatch(/is\.null/);
    },
  );

  // Each value is quoted, so PostgREST reads , ( ) as text, and it unescapes
  // \" and \\ inside the quotes. What is left is a POSIX regex, so its
  // metacharacters are escaped to match themselves. % and _ mean nothing to a
  // regex, and nor does * once escaped (an ilike would read it as %).
  it.each([
    ["a,b)", String.raw`a,b\\)`],
    ["50%", "50%"],
    ["x_y", "x_y"],
    ['say "hi"', String.raw`say \"hi\"`],
    [String.raw`C:\temp`, String.raw`C:\\\\temp`],
    ["(a.b*c?)", String.raw`\\(a\\.b\\*c\\?\\)`],
    ["[1]{2}^$|+", String.raw`\\[1\\]\\{2\\}\\^\\$\\|\\+`],
  ])("sends %j as the literal text %s", async (search, sent) => {
    expect(await orSent(search)).toBe(
      `(actor_name.imatch."${sent}",target_label.imatch."${sent}")`,
    );
  });
});

describe("countAuditAreas", () => {
  it("counts All and each area with its own count-only request, within the dates and the ceiling", async () => {
    table = [
      row("too-new", "2026-11-06T15:24:12.000000+00:00", "auth"),
      ...makeRows(4, ACCOUNT_ID, "auth"),
      ...makeRows(2, ACCOUNT_ID, "content").map((r) => ({
        ...r,
        id: `c-${r.id}`,
      })),
      row("too-old", "2026-11-01T00:00:00.000000+00:00", "content"),
    ];

    const counts = await countAuditAreas({
      fromIso: "2026-11-05T00:00:00+08:00",
      beforeIso: null,
      ceiling: NEWEST,
    });

    expect(counts).toEqual({
      all: 6,
      accounts: 0,
      configuration: 0,
      catalogs: 0,
      content: 2,
      pii_access: 0,
      calendar: 0,
      auth: 4,
      yellow_card: 0,
      maintenance: 0,
      system_issues: 0,
    });
    expect(methods).toEqual(Array(11).fill("HEAD"));
    expect(requests.map((u) => u.searchParams.get("area"))).toEqual([
      null,
      "eq.accounts",
      "eq.configuration",
      "eq.catalogs",
      "eq.content",
      "eq.pii_access",
      "eq.calendar",
      "eq.auth",
      "eq.yellow_card",
      "eq.maintenance",
      "eq.system_issues",
    ]);
  });

  it("rejects when any one count fails", async () => {
    table = makeRows(3);
    failingCount = "content";

    await expect(
      countAuditAreas({ fromIso: null, beforeIso: null, ceiling: NEWEST }),
    ).rejects.toMatchObject({ name: "RpcError" });
  });
});

describe("listAuditEntriesForTarget", () => {
  /** Another record's entries, interleaved with the target's. */
  function withOtherTarget(rows: FakeRow[]): FakeRow[] {
    return rows.flatMap((r) => [
      r,
      { ...r, id: `other-${r.id}`, target_id: OTHER_ID },
    ]);
  }

  it.each([
    ["more than one page", 2663],
    ["an exact multiple of the page size", 2000],
    ["exactly one page", 1000],
    ["less than one page", 3],
  ])("returns every entry for the record, once, when it has %s", async (_, count) => {
    const mine = makeRows(count);
    table = withOtherTarget(mine);

    const entries = await listAuditEntriesForTarget(ACCOUNT_ID);

    expect(entries.map((e) => e.id)).toEqual(mine.map((r) => r.id));
  });

  it("filters every page on the record, orders it on occurred_at then id, and limits it to the record's newest entry", async () => {
    // The other record's newest entry is a second newer than this one's.
    const others = makeRows(1, OTHER_ID).map((r) => ({
      ...r,
      id: "other-newest",
      occurred_at: "2026-11-06T15:24:12.000649+00:00",
    }));
    table = [...others, ...makeRows(2500)];

    await listAuditEntriesForTarget(ACCOUNT_ID);

    expect(
      pages().map((url) => [
        url.searchParams.get("target_id"),
        url.searchParams.get("order"),
        url.searchParams.get("occurred_at"),
      ]),
    ).toEqual(
      Array.from({ length: 3 }, () => [
        `eq.${ACCOUNT_ID}`,
        "occurred_at.desc,id.desc",
        `lte.${NEWEST}`,
      ]),
    );
  });

  it("does not repeat an entry when the record signs in between pages", async () => {
    table = makeRows(1500);
    const before = table.map((r) => r.id);
    afterPage = (pageNumber) => {
      if (pageNumber === 1) {
        table = [
          row("signed-in-during-the-load", "2026-11-06T15:24:12.000000+00:00"),
          ...table,
        ];
      }
    };

    const entries = await listAuditEntriesForTarget(ACCOUNT_ID);

    expect(entries.map((e) => e.id)).toEqual(before);
  });

  it("rejects with no entries when a later page fails", async () => {
    table = makeRows(2500);
    failingPage = 2;

    await expect(listAuditEntriesForTarget(ACCOUNT_ID)).rejects.toMatchObject({
      name: "RpcError",
      kind: "permission",
    });
    expect(pages()).toHaveLength(2);
  });

  it("stops asking for pages once the signal is aborted", async () => {
    table = makeRows(2500);
    const controller = new AbortController();
    afterPage = () => controller.abort();

    await expect(
      listAuditEntriesForTarget(ACCOUNT_ID, controller.signal),
    ).rejects.toBeTruthy();

    expect(pages()).toHaveLength(1);
  });

  it("sends nothing at all when the signal is already aborted", async () => {
    table = makeRows(2500);
    const controller = new AbortController();
    controller.abort();

    await expect(
      listAuditEntriesForTarget(ACCOUNT_ID, controller.signal),
    ).rejects.toBeTruthy();

    expect(requests).toHaveLength(0);
  });

  it("returns an empty history after one request, asking for no pages", async () => {
    table = makeRows(5, OTHER_ID);

    const entries = await listAuditEntriesForTarget(ACCOUNT_ID);

    expect(entries).toEqual([]);
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("target_id")).toBe(`eq.${ACCOUNT_ID}`);
  });
});
