import type { AuditArea, AuditEntry } from "../types";

/**
 * A row as `super_audit_log` hands it over. Every column is nullable because
 * PostgREST types a definer view that way — it cannot know the view's own
 * guarantees — so the narrowing back to `AuditEntry` happens here, in one
 * place, rather than in each of the three queries that read the view.
 */
export type AuditRow = {
  id: string | null;
  occurred_at: string | null;
  actor_name: string | null;
  area: AuditArea | null;
  target_id: string | null;
  target_label: string | null;
  change: string | null;
  detail: string | null;
  session_id: string | null;
  /** `inet`, which PostgREST types `unknown`. A string on the wire. */
  ip_address: unknown;
  user_agent: string | null;
};

/**
 * Null when the row cannot honestly become an entry. An entry with no id, no
 * timestamp or no area cannot be keyed, ordered or filtered, so showing it
 * would be worse than dropping it.
 */
export function toEntry(row: AuditRow): AuditEntry | null {
  if (!row.id || !row.occurred_at || !row.area) return null;
  return {
    id: row.id,
    timestamp: row.occurred_at,
    // Some RPCs write unattended — `write_audit` reads `auth.uid()`, and a
    // scheduled sweep has none.
    actor: row.actor_name ?? "System",
    area: row.area,
    change: row.change ?? "",
    target: row.target_label ?? "—",
    // Histories match on this, never on the label: a rename must not orphan a
    // history, and a fabricated id would attach it to the wrong row.
    targetId: row.target_id,
    detail: row.detail ?? undefined,
    sessionId: row.session_id,
    ipAddress: typeof row.ip_address === "string" ? row.ip_address : null,
    userAgent: row.user_agent,
  };
}

/**
 * The Forensic Context fields an entry actually carries, labelled, in the
 * order the expanded row shows them. Empty for a system entry and for one
 * written before DB l79. A Session whose row was already gone when the entry
 * was written keeps its id with no IP or user agent.
 */
export function forensicContext(
  entry: AuditEntry,
): { label: string; value: string }[] {
  const fields: [string, string | null][] = [
    ["Session", entry.sessionId],
    ["IP address", entry.ipAddress],
    ["User agent", entry.userAgent],
  ];
  return fields
    .filter((f): f is [string, string] => f[1] !== null && f[1] !== "")
    .map(([label, value]) => ({ label, value }));
}

/** The whole result set, in the order the database returned it. */
export function toEntries(rows: AuditRow[] | null): AuditEntry[] {
  return (rows ?? []).map(toEntry).filter((e): e is AuditEntry => e !== null);
}
