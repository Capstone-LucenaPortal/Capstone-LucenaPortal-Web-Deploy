import { serveGatedDocument } from "@/portals/staff/lib/http/gated-document";

/**
 * Streams a booking Document — an organisation document or a GCash receipt —
 * to an entitled staff member.
 *
 * Entitlement for this kind: `get_document_path('booking_document', id)`
 * already admits `b.citizen_id = auth.uid() or (is_active_staff('staff') and
 * has_module('booking')) or is_active_staff('super_staff')`, and already
 * filters `uploaded_at is not null` — so an abandoned upload reservation
 * resolves to zero rows here, which is the same 404 as everything else. No l54
 * change was needed for it; verified 2026-08-11.
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

  return serveGatedDocument("booking_document", id);
}
