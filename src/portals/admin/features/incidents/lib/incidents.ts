import { createClient } from "@/shared/supabase/client";
import { toPortalError } from "@/portals/admin/lib/supabase/errors";
import { listViewNewestFirst } from "@/portals/admin/lib/supabase/views";
import type { Database } from "@/shared/supabase/types";

export type IncidentRow =
  Database["public"]["Views"]["admin_incident_analytics"]["Row"];
export type IncidentPii =
  Database["public"]["Functions"]["read_incident_pii"]["Returns"][number];

/**
 * The incident read surface.
 *
 * listIncidents reads an analytics view that carries NO reporter PII by
 * design — names, contact details and email are only available through
 * readIncidentPii.
 *
 * readIncidentPii writes a pii_access audit row on EVERY call. It must never
 * be used to populate a list or called in a render loop: the audit log is
 * evidence, and filling it with noise makes a real investigation harder.
 *
 * Anonymous reports return null for reporter name, contact number and email
 * TOGETHER — the RPC masks all three. Layer 32 is a security fix that exists
 * precisely because an earlier version masked only the name while exposing
 * the mobile number unconditionally, which "defeated the whole feature." A
 * caller must render "Anonymous" rather than treating the nulls as missing
 * data.
 *
 * The view is read whole, newest first, through listViewNewestFirst, which
 * holds the pages still past 1,000 rows (an upper limit on submitted_at and an
 * id tie-break) and threads `signal` through every request. Callers
 * (Dashboard, SLA Reports) create one `AbortController` per fetch and abort
 * the previous one on remount/re-fetch, so this view is never read in more
 * than one in-flight request at a time.
 */
export async function listIncidents(signal?: AbortSignal): Promise<IncidentRow[]> {
  return listViewNewestFirst("admin_incident_analytics", signal);
}

export async function readIncidentPii(id: string): Promise<IncidentPii> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("read_incident_pii", {
    p_incident_id: id,
  });

  if (error) throw toPortalError(error);

  const row = data?.[0];
  if (!row) {
    throw { kind: "not-found" as const, message: "Incident not found." };
  }
  return row;
}
