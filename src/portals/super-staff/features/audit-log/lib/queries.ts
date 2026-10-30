import { createClient } from "@/shared/supabase/client";
import { rows } from "@/portals/super-staff/lib/supabase/select";
import { toEntries } from "./entry";
import type { AuditArea, AuditEntry } from "../types";

// One line. Splitting with `+` degrades the row type to GenericStringError[].
const COLUMNS =
  "id, occurred_at, actor_name, area, target_kind, target_id, target_label, change, detail, session_id, ip_address, user_agent, changes";

/** Every audit entry the caller may see. The view self-scopes — do not filter. */
export async function listAuditEntries(): Promise<AuditEntry[]> {
  return toEntries(
    await rows(
      createClient()
        .from("super_audit_log")
        .select(COLUMNS)
        .order("occurred_at", { ascending: false }),
    ),
  );
}

/** History for one record, matched on target_id so a rename cannot orphan it. */
export async function listAuditEntriesForTarget(
  targetId: string,
): Promise<AuditEntry[]> {
  return toEntries(
    await rows(
      createClient()
        .from("super_audit_log")
        .select(COLUMNS)
        .eq("target_id", targetId)
        .order("occurred_at", { ascending: false }),
    ),
  );
}

/**
 * The most recent entries in one area.
 *
 * ⚠️ The filter and the limit BOTH belong in PostgREST. Monitoring used to read
 * the entire log through `listAuditEntries()` and slice five rows off the
 * client side, which empties silently the moment this area's entries fall past
 * PostgREST's default row cap — a strip that goes blank without erroring is the
 * worst failure this page has.
 */
export async function listRecentAuditEntries(
  area: AuditArea,
  limit: number,
): Promise<AuditEntry[]> {
  return toEntries(
    await rows(
      createClient()
        .from("super_audit_log")
        .select(COLUMNS)
        .eq("area", area)
        .order("occurred_at", { ascending: false })
        .limit(limit),
    ),
  );
}
