import { serveGatedDocument } from "@/portals/staff/lib/http/gated-document";

/**
 * Streams a Yellow Card Document to an entitled staff member.
 *
 * Entitlement for this kind: `get_document_path('yellow_card_document', id)`
 * admits `a.citizen_id = auth.uid() or (is_active_staff('staff') and
 * has_module('yellow_card')) or is_active_staff('admin') or
 * is_active_staff('super_staff')`. Read from l56c, the last migration to
 * redefine the procedure; verified 2026-09-01.
 *
 * It also filters `uploaded_at is not null`, so an abandoned upload
 * reservation is not servable even by id.
 *
 * The mechanism — why a proxy rather than a signed URL, the two independent
 * gates, and why every failure answers the same 404 — lives on
 * `serveGatedDocument`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return serveGatedDocument("yellow_card_document", id);
}
