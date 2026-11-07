import { createClient } from "@/shared/supabase/client";
import { allRows, rows } from "@/portals/super-staff/lib/supabase/select";
import { toEntries } from "./entry";
import type { AuditEntry } from "../types";

// One line. Splitting with `+` degrades the row type to GenericStringError[].
const COLUMNS =
  "id, occurred_at, actor_name, area, target_kind, target_id, target_label, change, detail, session_id, ip_address, user_agent, changes";

/**
 * The newest row's timestamp, or null on an empty log. Read from the log, not
 * the browser's clock: a slow clock would hide the newest rows, a fast one would
 * let new rows in. Keep it the string the API sent. A `Date` has no microseconds,
 * so one would fall just short of the row it came from.
 */
async function newestOccurredAt(signal?: AbortSignal): Promise<string | null> {
  let query = createClient()
    .from("super_audit_log")
    .select("occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(1);
  if (signal) query = query.abortSignal(signal);
  const [newest] = await rows(query);
  return newest?.occurred_at ?? null;
}

/**
 * Every audit entry the caller may see, newest first, across as many requests
 * as that takes. The view self-scopes — do not filter by role.
 *
 * Pages are read by offset from a log that every sign-in writes to, so two
 * things hold them still. The upper limit stops a new row from pushing the rows
 * after it onto the next page; it appears on the next load instead. The `id`
 * tie-break fixes the order of rows that share a timestamp, which would otherwise
 * be free to differ between pages.
 */
export async function listAuditEntries(
  signal?: AbortSignal,
): Promise<AuditEntry[]> {
  const upTo = await newestOccurredAt(signal);
  if (upTo === null) return [];

  let query = createClient()
    .from("super_audit_log")
    .select(COLUMNS)
    .lte("occurred_at", upTo)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });
  if (signal) query = query.abortSignal(signal);
  return toEntries(await allRows(query, signal));
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
