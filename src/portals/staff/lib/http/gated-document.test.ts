// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFailingFetch,
  createRecordingFetch,
  createTestClient,
  downloadedDocument,
  failedDownload,
  parseProcedureName,
} from "@/portals/staff/lib/supabase/testing";

/**
 * What the stubbed factory hands back, and nothing else about it: set it, and
 * the next call to `createClient()` returns that client.
 *
 * A route handler's signature is fixed by the framework, so a test cannot pass
 * the shell's client in through it — stubbing the factory is the only way to
 * reach the shell the way a request does. What comes back is still a real
 * Supabase client over the recording fetch, so the query builder still
 * serialises the request and these tests still assert the wire.
 *
 * `vi.hoisted` because the mock factory below is hoisted above this file's
 * imports.
 */
const { factory } = vi.hoisted(() => ({
  factory: { returns: null as unknown },
}));

vi.mock("@/shared/supabase/server", () => ({
  createClient: async () => {
    if (!factory.returns) throw new Error("no test client was set for this call");
    return factory.returns;
  },
}));

// Imported after the mock so the shell resolves the stubbed factory.
const yellowCard = await import("@/app/(staff)/staff/api/yellow-card/documents/[id]/route");
const booking = await import("@/app/(staff)/staff/api/booking/documents/[id]/route");
const incidents = await import("@/app/(staff)/staff/api/incidents/photos/[id]/route");
const { serveGatedDocument } = await import("./gated-document");

const DOCUMENT_ID = "11111111-1111-1111-1111-111111111111";

/** `%PDF` — bytes rather than a string, because a Document is not text. */
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

/** Where the procedure points for a Document the caller may have. */
const PATH = "2026/abc.pdf";

/** One row of what `get_document_path` answers: the bucket and the path in it. */
type DocumentLocation = { bucket: string; path: string };

/**
 * The three gated Document routes, and the only thing that differs between
 * them: the kind each names to the procedure, and the bucket the procedure
 * answers with for that kind.
 *
 * The ladder below runs against all three. It belongs to the shell, but a
 * route only gets it by delegating — a route that quietly grew its own copy of
 * the mechanism, or that stopped answering 404 on one rung, would still pass
 * every test written against one of its neighbours.
 */
const ROUTES = [
  {
    route: "/staff/api/yellow-card/documents",
    kind: "yellow_card_document",
    bucket: "yellow-card-documents",
    GET: yellowCard.GET,
  },
  {
    route: "/staff/api/booking/documents",
    kind: "booking_document",
    bucket: "booking-documents",
    GET: booking.GET,
  },
  {
    route: "/staff/api/incidents/photos",
    kind: "incident_photo",
    bucket: "incident-photos",
    GET: incidents.GET,
  },
] as const;

afterEach(() => {
  // So a test that forgets to arrange one fails loudly rather than inheriting
  // the client of the test above it.
  factory.returns = null;
});

/**
 * Points the stubbed factory at a client over this recorder, and hands back
 * the array it captures requests into.
 */
function servedBy(recorder: ReturnType<typeof createRecordingFetch>) {
  factory.returns = createTestClient(recorder.fetch);

  return recorder.requests;
}

/**
 * A download that succeeds, of whatever the procedure was arranged to point
 * at — the arrangement behind every success path.
 */
function servableDocument(location: DocumentLocation[]) {
  return createRecordingFetch(location, {
    download: downloadedDocument(PDF_BYTES, "application/pdf"),
  });
}

/**
 * Everything a caller can see of a response. What the 404s are compared on: a
 * difference in any of these is a difference a caller could read a Document
 * out of.
 */
async function everythingVisible(response: Response) {
  return {
    status: response.status,
    body: await response.text(),
    headers: Object.fromEntries(response.headers),
  };
}

describe.each(ROUTES)("the $route route", ({ route, kind, bucket, GET }) => {
  /** What `get_document_path` answers for this kind. */
  const location = [{ bucket, path: PATH }];

  function get(id = DOCUMENT_ID) {
    return GET(new Request(`http://localhost:3000${route}/${id}`), {
      params: Promise.resolve({ id }),
    });
  }

  it("answers 404 when the procedure fails", async () => {
    // Not "no rows" — the procedure itself raised. The caller learns nothing
    // about why.
    servedBy(createFailingFetch({ message: "permission denied" }));

    const response = await get();

    expect(response.status).toBe(404);
  });

  it("answers 404 when the procedure finds no row", async () => {
    // The procedure returns no rows — not an error — when the caller is not
    // entitled to the Document, and also when there is no such Document. Both
    // arrive here, and both leave as the same 404.
    servedBy(createRecordingFetch([]));

    const response = await get();

    expect(response.status).toBe(404);
  });

  it("answers 404 when the download fails", async () => {
    // The caller was entitled and the object was not there. Storage failing is
    // not the caller's business either.
    const requests = servedBy(
      createRecordingFetch(location, {
        download: failedDownload({ message: "Object not found" }),
      }),
    );

    const response = await get();

    expect(response.status).toBe(404);
    // Two requests: this rung is reached by a download that was attempted and
    // failed, not by the procedure failing before one was sent.
    expect(requests).toHaveLength(2);
  });

  it("streams the Document when the procedure points at one", async () => {
    servedBy(servableDocument(location));

    const response = await get();

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PDF_BYTES);
  });

  it("downloads from the location the procedure named", async () => {
    // The bucket comes back from the procedure, per kind; nothing about it is
    // decided here. A shell that named a bucket of its own would serve one
    // kind and 404 the other two.
    const requests = servedBy(servableDocument(location));

    await get();

    expect(requests).toHaveLength(2);
    expect(requests[1].url).toContain(`/storage/v1/object/${bucket}/${PATH}`);
  });

  it("streams it under the safe content headers", async () => {
    servedBy(servableDocument(location));

    const response = await get();

    // Spelled out rather than compared against safeContentHeaders(), which
    // would assert the code against itself.
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("content-security-policy")).toBe(
      "sandbox; default-src 'none'; img-src 'self' data:;",
    );
  });

  it("never echoes the stored content type back", async () => {
    // The stored type is attacker-influenced. An SVG served as an SVG from
    // this origin scripts as the staff portal.
    servedBy(
      createRecordingFetch(location, {
        download: downloadedDocument(PDF_BYTES, "image/svg+xml"),
      }),
    );

    const response = await get();

    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toBe("attachment");
  });

  it("names its own kind to the procedure", async () => {
    const requests = servedBy(createRecordingFetch([]));

    await get();

    expect(parseProcedureName(requests[0].url)).toBe("get_document_path");
    expect(requests[0].body).toEqual({ p_kind: kind, p_row_id: DOCUMENT_ID });
  });

  it("lands a malformed id in the same 404 as everything else", async () => {
    // A malformed id does not match nothing — it raises 22P02 inside the
    // procedure, which is why it needs saying that it lands here too.
    const requests = servedBy(
      createFailingFetch({
        code: "22P02",
        message: 'invalid input syntax for type uuid: "not-a-uuid"',
      }),
    );

    const response = await get("not-a-uuid");

    expect(response.status).toBe(404);
    // The id went to the database rather than being screened here. A route
    // that rejected it early would answer its own 404 and never send this.
    expect(requests[0].body).toEqual({ p_kind: kind, p_row_id: "not-a-uuid" });
  });

  it("answers every failure with the same response, byte for byte", async () => {
    // The whole point of the ladder. Nothing in a response may tell a caller
    // whether a Document they cannot see exists.
    const failures = [
      createFailingFetch({ message: "permission denied" }),
      createFailingFetch({
        code: "22P02",
        message: 'invalid input syntax for type uuid: "not-a-uuid"',
      }),
      createRecordingFetch([]),
      createRecordingFetch(location, {
        download: failedDownload({ message: "Object not found" }),
      }),
    ];

    const seen = [];
    for (const recorder of failures) {
      servedBy(recorder);
      seen.push(await everythingVisible(await get()));
    }

    expect(seen[1]).toEqual(seen[0]);
    expect(seen[2]).toEqual(seen[0]);
    expect(seen[3]).toEqual(seen[0]);
  });
});

describe("the gated-document shell", () => {
  it("serves through a client it was handed", async () => {
    // The seam ADR-0001 describes. Nothing arranges the factory here, so it
    // throws if it is called — a shell that built its own client would fail
    // this test rather than pass it quietly.
    const recorder = servableDocument([{ bucket: "yellow-card-documents", path: PATH }]);
    const db = createTestClient(recorder.fetch);

    const response = await serveGatedDocument("yellow_card_document", DOCUMENT_ID, db);

    expect(response.status).toBe(200);
    expect(recorder.requests).toHaveLength(2);
  });
});
