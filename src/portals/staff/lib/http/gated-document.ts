import { NextResponse } from "next/server";
import { createClient } from "@/shared/supabase/server";
import type { Db } from "@/shared/supabase/server";
import { safeContentHeaders } from "./safe-content";

/**
 * The kinds `get_document_path` decides entitlement for. One per module: a
 * Yellow Card requirement, a booking's organisation papers or GCash receipt,
 * an incident photo. Incidents call theirs photos and the tables disagree
 * about the word; the entitlement rule does not distinguish them, so neither
 * does this type.
 */
export type DocumentKind =
  | "yellow_card_document"
  | "booking_document"
  | "incident_photo";

/**
 * Streams a Document to a staff member entitled to it, or answers 404.
 *
 * Every gated Document route is this, differing only by the kind it names.
 * Who the database admits for a kind differs, and that rule stays in the route
 * file; the mechanism below is the same for all three.
 *
 * Why this exists rather than a signed URL: a Supabase signed URL is a bearer
 * token. Anyone who has the link has the Document for as long as it lives — paste
 * it into a private window and it still resolves. Proxying keeps the
 * credential on the server and puts nothing in front of the browser but a
 * document id.
 *
 * Two independent gates, deliberately:
 *
 *  1. The request guard (src/shared/guard/) redirects any request without a
 *     session to /staff/login. Route handlers do NOT run the (portal)
 *     layout, so that check is the only reason an anonymous request never
 *     reaches this code.
 *  2. get_document_path() re-checks entitlement in the database on every
 *     single request and returns no rows — not an error — when the caller is
 *     not allowed the Document. A session alone is never enough.
 *
 * Every failure answers 404, and every 404 is the same response. Telling "not
 * yours" from "does not exist" would confirm to someone that a Document they
 * cannot see exists.
 *
 * `db` is the seam of ADR-0001, and no production caller passes it. The
 * objection that refused this shape for `actions.ts` does not apply: a route
 * handler's signature is fixed by the framework, so no request can reach this
 * parameter, and the shell itself is reachable only from code.
 */
export async function serveGatedDocument(
  kind: DocumentKind,
  id: string,
  db?: Db,
): Promise<NextResponse> {
  const supabase = db ?? (await createClient());

  // A malformed id raises 22P02 here rather than matching anything, which
  // lands in the same 404 as every other failure.
  const { data, error } = await supabase.rpc(
    "get_document_path",
    { p_kind: kind, p_row_id: id },
  );

  if (error) return notFound();

  const location = (data as { bucket: string; path: string }[] | null)?.[0];
  if (!location?.path) return notFound();

  const downloaded = await supabase.storage.from(location.bucket).download(location.path);
  if (downloaded.error || !downloaded.data) return notFound();

  // The stored content type is attacker-influenced, so it is never echoed
  // back as-is. safeContentHeaders decides from an allowlist; see its comment
  // for why nosniff alone would not be enough.
  return new NextResponse(downloaded.data, {
    headers: safeContentHeaders(downloaded.data.type),
  });
}

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}
