import { expect } from "vitest";
import { createServerClient } from "@supabase/ssr";
import type { Db } from "@/shared/supabase/server";
import type { Database } from "@/shared/supabase/types";

// ---------------------------------------------------------------------------
// Recording fetch — captures outgoing requests, returns a canned response
// ---------------------------------------------------------------------------

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  /**
   * The request body. `undefined` for a request that carried none, which is
   * every read — the arguments of a write travel here.
   *
   * A JSON body arrives parsed, so an assertion reads as the arguments the
   * caller meant, and so a key whose value is `undefined` is absent from it the
   * same way it is absent on the wire. Anything else — a Document on its way
   * up to storage, say — arrives as text, because a recorder that threw on the
   * first one would read as a broken test rather than as a layer that does
   * not cover a Document on its way up yet. One on its way down it does
   * cover; see `download` below.
   */
  body?: unknown;
}

/**
 * The shared recorder. Captures every outgoing request, then hands the
 * response back from `respond` so the caller decides what the wire returns.
 *
 * `respond` is given the request it is answering, which is what lets one
 * policy answer a procedure call and the storage download that follows it
 * differently. It is given the recorded form rather than the `Request`,
 * because the body has already been read off that one.
 *
 * Not exported: tests name the response policy they want (canned rows, a
 * failure, a downloaded Document) rather than assembling one.
 */
function createRecorder(respond: (request: RecordedRequest) => Response) {
  const requests: RecordedRequest[] = [];

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const text = await req.text();
    const recorded: RecordedRequest = {
      url: req.url,
      method: req.method,
      headers,
      body: recordedBody(text, headers["content-type"]),
    };
    requests.push(recorded);

    return respond(recorded);
  };

  return { fetch, requests } as const;
}

function recordedBody(text: string, contentType: string | undefined): unknown {
  if (text === "") return undefined;
  return contentType?.includes("json") ? JSON.parse(text) : text;
}

export interface RecordingFetchOptions {
  /**
   * How many rows the view holds behind the query — the figure a read gets
   * back from `{ count: "exact" }`, which is not the length of `cannedBody`
   * once a `limit` is in play.
   *
   * postgrest-js reads the count off the `content-range` header, so without
   * this a recorded response always yields a null count and a read whose
   * result is a count cannot be asserted at all. Omit it for reads that ask
   * for rows only.
   */
  rowCount?: number;
  /**
   * How a storage download is answered, when the caller sends one.
   *
   * Every gated Document route calls a procedure to decide whether the caller
   * may have the Document, then downloads what the procedure pointed at. Those
   * two requests need different answers, and the canned body alone cannot give
   * them: it would hand the download a JSON array where the route expects
   * bytes.
   *
   * Name one of `downloadedDocument` or `failedDownload` here and the canned
   * body goes on answering everything else. Omit it and a download is answered
   * by the canned body exactly as it is today — a read layer that never
   * touches storage is unaffected either way.
   */
  download?: DownloadPolicy;
}

/**
 * How a storage download is answered. Produced by `downloadedDocument` or
 * `failedDownload` — a test names one of those rather than writing a
 * `Response`. Exported only so that `RecordingFetchOptions` above can name
 * the type of its own field.
 */
export type DownloadPolicy = () => Response;

/**
 * Returns a `fetch` replacement and the array it pushes captured requests into.
 *
 * The canned body is returned for every request so the real row mappers still
 * run. Pass an array of objects that satisfy the mapper's nullable contract.
 *
 * The one exception is a storage download, which `options.download` answers
 * when it is given.
 */
export function createRecordingFetch(
  cannedBody: unknown[] = [],
  { rowCount, download }: RecordingFetchOptions = {},
) {
  return createRecorder((request) => {
    if (download && isStorageRequest(request.url)) return download();

    return new Response(JSON.stringify(cannedBody), {
      status: 200,
      headers: {
        "content-type": "application/json",
        ...(rowCount === undefined
          ? {}
          : { "content-range": contentRange(cannedBody.length, rowCount) }),
      },
    });
  });
}

/**
 * Whether a captured URL is bound for storage rather than PostgREST.
 *
 * supabase-js sends storage under `/storage/v1/` and everything this layer
 * otherwise records under `/rest/v1/`, so the prefix is what tells a download
 * from a procedure call. Knowing that lives here rather than in each test,
 * which is the point of the option above.
 */
function isStorageRequest(url: string): boolean {
  return new URL(url).pathname.startsWith("/storage/v1/");
}

/**
 * A storage download that succeeds, carrying the Document's bytes and the
 * content type storage reports for it.
 *
 * `content` is bytes rather than text because a Document is not text, and
 * because the route hands what comes back straight to the browser. The content
 * type is required: storage-js builds the blob's `type` from this header, and
 * that is what the route reads to decide the headers it answers with — so a
 * download answered without one would leave every Document typed as nothing.
 */
export function downloadedDocument(
  content: BufferSource,
  contentType: string,
): DownloadPolicy {
  return () =>
    new Response(content, {
      status: 200,
      headers: { "content-type": contentType },
    });
}

/**
 * A storage download that fails — the caller was entitled to the Document and
 * the object was not there, or storage would not give it up.
 *
 * The body carries storage's error keys so storage-js resolves to
 * `{ data: null, error }` with `error.message` populated, the way it would in
 * production. A body it did not recognise would throw out of the caller
 * instead, which is a different failure from the one under test.
 *
 * 404 by default because that is the one a gated Document route has to answer
 * correctly; every other storage failure lands in the same place.
 */
export function failedDownload({
  status = 404,
  message,
}: {
  status?: number;
  message: string;
}): DownloadPolicy {
  return () =>
    new Response(
      JSON.stringify({ statusCode: String(status), error: "", message }),
      { status, headers: { "content-type": "application/json" } },
    );
}

/**
 * PostgREST's `content-range`: the span of rows carried by this response over
 * the total behind the query. A response carrying none reports its span as
 * `*`.
 *
 * Exported because a test that answers two requests differently has to build
 * its own responses, and hard-coding the header there would drift the moment
 * its canned rows changed.
 */
export function contentRange(returned: number, total: number): string {
  return returned === 0 ? `*/${total}` : `0-${returned - 1}/${total}`;
}

/**
 * The same recorder, but every request comes back as a PostgREST error.
 *
 * The body carries PostgREST's four error keys so supabase-js populates
 * `error.message` the way it would in production. Only `message` is worth
 * varying today; the rest are empty until a test needs to assert on one.
 *
 * Use it to prove a read raises rather than swallowing the failure and
 * returning an empty result — which on screen reads as "nothing to do".
 */
export function createFailingFetch({
  status = 500,
  code = "",
  message,
}: {
  status?: number;
  /**
   * The PostgreSQL errcode. Only a write needs one — it is what error
   * translation switches on, so a failure asserted through `toActionFailure`
   * has to carry the code the database would have raised. A read that only
   * proves it does not swallow the failure can leave it out.
   */
  code?: string;
  message: string;
}) {
  return createRecorder(
    () =>
      new Response(JSON.stringify(postgrestErrorBody(message, code)), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

/**
 * PostgREST's four error keys. Exported for the same reason as
 * `contentRange`: a test building its own failing response should not restate
 * the shape supabase-js reads `error.message` out of.
 */
export function postgrestErrorBody(message: string, code = "") {
  return { message, code, details: "", hint: "" };
}

// ---------------------------------------------------------------------------
// Table-keyed recording fetch, and the helpers for reading a recorded request
//
// `createTableFetch` and `requestTo` are one unit: a dossier test takes both or
// neither. `columnsOf` and `orClausesOf` read a single `ParsedQueryParams`, so
// they serve any test on this seam — a queue read reaches them through
// `parseQueryParams` with no table-keyed fetch in sight. All four sit here
// rather than under the parser below — whose `ParsedQueryParams` they read —
// because what a caller comes looking for is the fetch, and the rest are how a
// captured request is asked a question.
// ---------------------------------------------------------------------------

/**
 * A response policy keyed on the table a request targets — not a hand-written
 * query double. The real builder still serialises the request and the real row
 * mappers still run on what comes back.
 *
 * `createRecordingFetch` answers every request with the same canned body,
 * which cannot drive a function that reads more than one table: a dossier's
 * second and third reads would each be handed the first read's row. That is
 * why this sits beside it rather than replacing it — a read that touches one
 * table wants the simpler helper, and the download policy lives there.
 *
 * What it records is already parsed. A caller asks which table, which columns,
 * which filters, so `requests` holds `ParsedQueryParams` rather than the raw
 * `RecordedRequest` the shared recorder captures.
 *
 * A table absent from `rows` answers with no rows. `failing` names the one
 * table whose request comes back as a PostgREST error instead.
 */
export function createTableFetch(
  rows: Record<string, unknown[]>,
  failing?: { table: string; message: string },
) {
  const requests: ParsedQueryParams[] = [];

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const params = parseQueryParams(request.url);
    requests.push(params);

    if (failing?.table === params.table) {
      return new Response(JSON.stringify(postgrestErrorBody(failing.message)), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify(rows[params.table] ?? []), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  return { fetch, requests } as const;
}

/**
 * The one request that went to `table`.
 *
 * Picked by name rather than by position: a dossier's reads fan out inside one
 * `Promise.all`, so their order in `requests` is not guaranteed — the
 * precedent set for the dashboard card reader's two concurrent requests, which
 * ADR-0003 and ADR-0004 each restated. Asserting there is exactly one also
 * pins the "one request per read" guarantee.
 *
 * This is why the module imports `expect`: the helper carries the assertion so
 * that a second request to a table reads as the failure it is, rather than as
 * whichever of the two the caller happened to be handed.
 */
export function requestTo(
  requests: ParsedQueryParams[],
  table: string,
): ParsedQueryParams {
  const matches = requests.filter((request) => request.table === table);

  expect(matches).toHaveLength(1);
  return matches[0];
}

/**
 * The select parameter as the list of column names it is.
 *
 * The `!` was a file-local shortcut before this moved, and as a shared export
 * it is a contract worth stating: this is for a request that selects columns.
 * A head-only request carries no `select`, so asking this of one throws — which
 * is the right failure, because "which columns" is not a question that request
 * has an answer to. Assert `params.select` is null for those instead.
 */
export function columnsOf(params: ParsedQueryParams): string[] {
  return params.select!.split(",").map((column) => column.trim());
}

/**
 * The clauses of the request's `or` filter — one per column the search term was
 * spread across — or no clauses at all for a request that sent no `or`.
 *
 * The whole `or` argument arrives in `filters` the way PostgREST serialises it:
 * the clauses comma-joined inside one pair of brackets. Which key holds it, that
 * it is bracketed, and that the list under that key holds a single entry are all
 * facts about the wire, so they belong here rather than in each queue's test.
 *
 * An absent `or` reports no clauses rather than throwing: an empty search box is
 * an ordinary read, not a broken test. That is the opposite of `columnsOf` above,
 * deliberately — "which columns" is a question a head-only request has no answer
 * to, where "which clauses" asked of a request that sent no `or` has one, and it
 * is none. A test claiming a read sends no `or` at all should still say that of
 * `filters` directly — that is a different claim from this one, and only the
 * direct form fails when an `or` appears.
 *
 * Two `or` parameters fail here instead of being read as one list. PostgREST
 * ANDs them, so their clauses are two groups and flattening them would assert a
 * query the read never sent. This carries its own assertion for the same reason
 * `requestTo` does: so that the second one fails by name rather than being
 * silently dropped.
 */
export function orClausesOf(params: ParsedQueryParams): string[] {
  const sent = params.filters["or"];
  if (sent === undefined) return [];

  expect(
    sent,
    "expected one `or` parameter — two are AND-ed, not one clause list",
  ).toHaveLength(1);
  return sent[0].replace(/^\(|\)$/g, "").split(",");
}

// ---------------------------------------------------------------------------
// Query-parameter parser — so assertions name what broke
// ---------------------------------------------------------------------------

export interface ParsedQueryParams {
  /** The table or view name (first path segment after /rest/v1/). */
  table: string;
  /** The `select` parameter, raw. */
  select: string | null;
  /** The `order` parameter, raw. */
  order: string | null;
  /** The `limit` parameter, raw. */
  limit: string | null;
  /**
   * Every other query parameter, as the list of values sent for it — filters
   * live here.
   *
   * Keyed by the parameter, not by a column: a queue search arrives under
   * `or`, which is a key in this record and is not a column of anything.
   *
   * A list per parameter rather than a value, because PostgREST parameters are
   * multi-valued and one parameter carrying two filters is ordinary: a date
   * window is `event_date=gte.…&event_date=lte.…`. This record held one value
   * per parameter until #46, and the second silently overwrote the first, so
   * an equality over it read a window as open at one end. Every read on this
   * seam happened to send each parameter once, which is why it went unnoticed.
   *
   * The single-filter case pays one pair of brackets for that —
   * `toEqual({ status: ["eq.confirmed"] })` — and in exchange an equality over
   * this record is worth what it appears to be worth.
   */
  filters: Record<string, string[]>;
}

/**
 * Extracts named PostgREST query parameters from a captured URL, so a test
 * failure reads "expected superseded_by filter" rather than showing a long URL
 * diff.
 */
export function parseQueryParams(url: string): ParsedQueryParams {
  const parsed = new URL(url);

  // The table name is the first segment after /rest/v1/
  const segments = parsed.pathname.split("/").filter(Boolean);
  const restIndex = segments.indexOf("rest");
  const table =
    restIndex >= 0 && segments[restIndex + 1] === "v1"
      ? segments[restIndex + 2] ?? ""
      : segments[segments.length - 1] ?? "";

  const select = parsed.searchParams.get("select");
  const order = parsed.searchParams.get("order");
  const limit = parsed.searchParams.get("limit");

  const filters: Record<string, string[]> = {};
  parsed.searchParams.forEach((value, key) => {
    if (!["select", "order", "limit", "apikey"].includes(key)) {
      (filters[key] ??= []).push(value);
    }
  });

  return { table, select, order, limit, filters };
}

/**
 * The procedure a captured `.rpc()` URL invokes, or null if the request is not
 * one.
 *
 * A procedure call is a POST to /rest/v1/rpc/<name>, so `parseQueryParams`
 * reports its table as "rpc" — true of every procedure and therefore useless
 * for telling one from another. This names the one that was actually called.
 */
export function parseProcedureName(url: string): string | null {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  const rpcIndex = segments.indexOf("rpc");

  return rpcIndex >= 0 ? segments[rpcIndex + 1] ?? null : null;
}

// ---------------------------------------------------------------------------
// Test client factory
// ---------------------------------------------------------------------------

/**
 * Creates a real Supabase client pointed at a dummy host, with `fetch`
 * replaced by the recorder. The real query builder serialises the request;
 * the recorder captures it and returns a canned response.
 */
export function createTestClient(
  recordingFetch: typeof globalThis.fetch,
): Db {
  return createServerClient<Database>(
    "http://localhost:00000",
    "test-anon-key",
    {
      global: { fetch: recordingFetch },
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
