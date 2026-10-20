import { serveGatedDocument } from "@/portals/staff/lib/http/gated-document";

/**
 * Streams one incident photo to an entitled staff member.
 *
 * Entitlement for this kind is the widest of the three.
 * `get_document_path('incident_photo', id)` admits `i.citizen_id = auth.uid()
 * or i.assigned_responder_id = auth.uid() or (is_active_staff('staff') and
 * has_module('incidents')) or is_active_staff('super_staff')`, and one more
 * caller the other two kinds have no equivalent of: any active responder whose
 * department_code matches the incident's assigned_department_code. Read from
 * l56c, the last migration to redefine the procedure; verified 2026-08-31.
 *
 * It also filters `uploaded_at is not null`, so an abandoned reservation is not
 * servable even by id.
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

  return serveGatedDocument("incident_photo", id);
}
