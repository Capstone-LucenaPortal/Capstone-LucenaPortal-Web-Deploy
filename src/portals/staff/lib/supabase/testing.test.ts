import { describe, expect, it } from "vitest";
import {
  createRecordingFetch,
  createTestClient,
  downloadedDocument,
  failedDownload,
  orClausesOf,
  parseProcedureName,
  parseQueryParams,
} from "./testing";
import type { ParsedQueryParams } from "./testing";
import { buildSearchFilter } from "./search-filter";

/**
 * The gated document routes are the shape this policy exists for: one
 * procedure call that decides whether the caller may have the Document, then a
 * storage download of what it pointed at. Nothing else in the layer sends two
 * requests that need different answers.
 */
const CANNED_LOCATION = [
  { bucket: "yellow-card-documents", path: "2026/abc.pdf" },
];

/** `%PDF` — bytes rather than a string, because a Document is not text. */
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

async function callProcedure(db: ReturnType<typeof createTestClient>) {
  return db.rpc("get_document_path", {
    p_kind: "yellow_card_document",
    p_row_id: "11111111-1111-1111-1111-111111111111",
  });
}

function downloadFrom(db: ReturnType<typeof createTestClient>) {
  return db.storage.from("yellow-card-documents").download("2026/abc.pdf");
}

/** storage-js carries the status on `StorageApiError`, not on the union. */
async function downloadStatus(db: ReturnType<typeof createTestClient>) {
  const { error } = await downloadFrom(db);
  return (error as { status?: number } | null)?.status;
}

describe("createRecordingFetch with a download policy", () => {
  it("answers the procedure call with the canned rows", async () => {
    const { fetch } = createRecordingFetch(CANNED_LOCATION, {
      download: downloadedDocument(PDF_BYTES, "application/pdf"),
    });
    const db = createTestClient(fetch);

    const { data, error } = await callProcedure(db);

    expect(error).toBeNull();
    expect(data).toEqual(CANNED_LOCATION);
  });

  it("answers the download that follows it with the document bytes", async () => {
    const { fetch } = createRecordingFetch(CANNED_LOCATION, {
      download: downloadedDocument(PDF_BYTES, "application/pdf"),
    });
    const db = createTestClient(fetch);

    await callProcedure(db);
    const downloaded = await downloadFrom(db);

    expect(downloaded.error).toBeNull();
    expect(new Uint8Array(await downloaded.data!.arrayBuffer())).toEqual(PDF_BYTES);
  });

  it("carries the content type the download was given", async () => {
    // The route reads this off the blob to decide the response headers, so a
    // policy that dropped it would leave every Document typed as nothing.
    const { fetch } = createRecordingFetch(CANNED_LOCATION, {
      download: downloadedDocument(PDF_BYTES, "image/jpeg"),
    });
    const db = createTestClient(fetch);

    const downloaded = await downloadFrom(db);

    expect(downloaded.data?.type).toBe("image/jpeg");
  });

  it("records both requests exactly as it does today", async () => {
    const { fetch, requests } = createRecordingFetch(CANNED_LOCATION, {
      download: downloadedDocument(PDF_BYTES, "application/pdf"),
    });
    const db = createTestClient(fetch);

    await callProcedure(db);
    await downloadFrom(db);

    expect(requests).toHaveLength(2);

    const [procedure, download] = requests;
    expect(procedure.method).toBe("POST");
    expect(parseProcedureName(procedure.url)).toBe("get_document_path");
    expect(procedure.body).toEqual({
      p_kind: "yellow_card_document",
      p_row_id: "11111111-1111-1111-1111-111111111111",
    });

    expect(download.method).toBe("GET");
    expect(new URL(download.url).pathname).toBe(
      "/storage/v1/object/yellow-card-documents/2026/abc.pdf",
    );
    // A download carries no body, so the recorded shape is unchanged by it.
    expect(download.body).toBeUndefined();
  });

  it("can fail the download while the procedure call still succeeds", async () => {
    // This is the pairing no shared helper could express: the caller was
    // entitled to the Document and the object was not there.
    const { fetch } = createRecordingFetch(CANNED_LOCATION, {
      download: failedDownload({ status: 404, message: "Object not found" }),
    });
    const db = createTestClient(fetch);

    const { data, error } = await callProcedure(db);
    expect(error).toBeNull();
    expect(data).toEqual(CANNED_LOCATION);

    const downloaded = await downloadFrom(db);
    expect(downloaded.data).toBeNull();
    expect(downloaded.error?.message).toBe("Object not found");
  });

  it("carries the status the failure was given, and 404 when it was not", async () => {
    // The routes flatten every storage failure into the same 404, so nothing
    // downstream reads this yet. It is asserted because an option no test
    // exercises is an option nobody knows is wired up.
    const denied = createRecordingFetch(CANNED_LOCATION, {
      download: failedDownload({ status: 403, message: "Unauthorized" }),
    });
    const missing = createRecordingFetch(CANNED_LOCATION, {
      download: failedDownload({ message: "Object not found" }),
    });

    expect(await downloadStatus(createTestClient(denied.fetch))).toBe(403);
    expect(await downloadStatus(createTestClient(missing.fetch))).toBe(404);
  });

  it("answers a download with the canned body when no policy names one", async () => {
    // Today's behaviour, unchanged: without a policy the canned body answers
    // every request, so an uncovered download reads as JSON rather than as a
    // broken test.
    const { fetch } = createRecordingFetch(CANNED_LOCATION);
    const db = createTestClient(fetch);

    const downloaded = await downloadFrom(db);

    expect(downloaded.error).toBeNull();
    expect(await downloaded.data!.text()).toBe(JSON.stringify(CANNED_LOCATION));
  });
});

// ---------------------------------------------------------------------------
// Query-parameter parser
// ---------------------------------------------------------------------------

/**
 * Sends one request through the recorder and returns what the parser made of
 * it.
 *
 * The request is serialised by the real query builder rather than hand-written
 * into a URL, for the reason the ADR gives for everything else in this layer:
 * a hand-written URL asserts the test author's own idea of what a date window
 * looks like on the wire, which is the half of the claim most worth checking.
 * `staff_bookings` is a fixture here and nothing more — the parser reads a URL
 * and knows no view from another — picked because the date window that
 * motivated the list is the one that view's calendar read sends.
 */
async function capturedParams(
  send: (db: ReturnType<typeof createTestClient>) => PromiseLike<unknown>,
): Promise<ParsedQueryParams> {
  const { fetch, requests } = createRecordingFetch();

  await send(createTestClient(fetch));

  expect(requests).toHaveLength(1);
  return parseQueryParams(requests[0].url);
}

/**
 * The seam's reader. Every read on ADR-0001's seam asserts its shape through
 * this function, so how it reads a URL decides what all of those assertions
 * mean — and until this suite covered it, reverting the multi-valued handling
 * left this file green and turned a feature module red, where the failure
 * reads as that module's problem rather than as this one's.
 */
describe("parseQueryParams", () => {
  it("keeps both values of a parameter filtered twice, in the order sent", async () => {
    // The case the list exists for: a date window is one parameter carrying
    // two filters, and a record holding one value per parameter reads it as
    // open at whichever end it overwrote.
    const params = await capturedParams((db) =>
      db
        .from("staff_bookings")
        .select("id")
        .gte("event_date", "2026-09-01")
        .lte("event_date", "2026-09-30"),
    );

    expect(params.filters).toEqual({
      event_date: ["gte.2026-09-01", "lte.2026-09-30"],
    });
  });

  it("reads a single filter as the one-element list it is", async () => {
    // The bracket every other read on the seam pays, asserted once here so
    // that what those reads are paying for is written down somewhere.
    const params = await capturedParams((db) =>
      db.from("staff_bookings").select("id").eq("status", "confirmed"),
    );

    expect(params.filters).toEqual({ status: ["eq.confirmed"] });
  });

  it("leaves a parameter the request never sent out of the record", async () => {
    // Asked of a request that did send a filter, because a record with nothing
    // in it answers an absence check trivially — and this is the shape a read
    // meets: some parameters present, the one being asked about not among them.
    const params = await capturedParams((db) =>
      db.from("staff_bookings").select("id").eq("status", "confirmed"),
    );

    // Absent rather than an empty list, so a read asserting a filter it never
    // sent fails on the missing key instead of passing a length check.
    expect(params.filters.event_date).toBeUndefined();
  });

  it("keys the record by the parameter, not by a column", async () => {
    // A queue search is the case the name has to survive: it arrives under
    // `or`, which is a key in this record and is not a column of anything. It
    // is also the key whose contents are least obvious, so a reader who takes
    // the keys for column names goes looking for a column named `or`.
    const params = await capturedParams((db) =>
      db
        .from("staff_bookings")
        .select("id")
        .or(buildSearchFilter(["event_title", "reference_number"], "ana")!),
    );

    expect(params.filters).toEqual({
      or: ['(event_title.ilike."%ana%",reference_number.ilike."%ana%")'],
    });
  });

  it("does not duplicate the named parameters it lifts out", async () => {
    const params = await capturedParams((db) =>
      db
        .from("staff_bookings")
        .select("id,event_date")
        .eq("status", "confirmed")
        .order("event_date", { ascending: true })
        .limit(5),
    );

    expect(params.table).toBe("staff_bookings");
    expect(params.select).toBe("id,event_date");
    expect(params.order).toBe("event_date.asc");
    expect(params.limit).toBe("5");
    // Each of those is read off its own field, which is what makes an equality
    // over `filters` an equality over the filters and nothing else.
    expect(params.filters).toEqual({ status: ["eq.confirmed"] });
  });
});

// ---------------------------------------------------------------------------
// Search-filter accessor
// ---------------------------------------------------------------------------

/**
 * The other half of what a queue search read asserts. `parseQueryParams` puts
 * the whole `or` argument in `filters` as the bracketed, comma-joined string it
 * arrives as; the three queue tests want the clauses inside it, and each of them
 * used to unwrap that string itself.
 */
describe("orClausesOf", () => {
  it("reads a search term spread over several columns as one clause each", async () => {
    const params = await capturedParams((db) =>
      db
        .from("staff_bookings")
        .select("id")
        .or(
          buildSearchFilter(
            ["reference_number", "event_title", "organization_name"],
            "chamber",
          )!,
        ),
    );

    expect(orClausesOf(params)).toEqual([
      'reference_number.ilike."%chamber%"',
      'event_title.ilike."%chamber%"',
      'organization_name.ilike."%chamber%"',
    ]);
  });

  it("reports no clauses for a request that sent no or", async () => {
    // An empty search box sends no `or` at all, and a queue read asking what a
    // request it did not send contained should get an answer rather than an
    // exception — the same call, whether or not the search box had anything in
    // it.
    const params = await capturedParams((db) =>
      db.from("staff_bookings").select("id").eq("status", "confirmed"),
    );

    expect(orClausesOf(params)).toEqual([]);
  });

  it("fails rather than reporting the first of two or filters", async () => {
    // Two `or` parameters are AND-ed by PostgREST, so their clauses are not one
    // list and flattening them would read as one. Returning the first and
    // dropping the second silently is the defect #46 fixed at the other end of
    // the same list, where the second overwrote the first; this fails by name
    // instead, the way `requestTo` does for a second request to a table.
    const params = await capturedParams((db) =>
      db
        .from("staff_bookings")
        .select("id")
        .or(buildSearchFilter(["event_title"], "ana")!)
        .or(buildSearchFilter(["organization_name"], "chamber")!),
    );

    // Matched on the accessor's own words rather than on vitest's phrasing of a
    // length check, so this asserts which failure it is and survives a change to
    // the matcher's wording.
    expect(() => orClausesOf(params)).toThrow(/one `or` parameter/);
  });
});
