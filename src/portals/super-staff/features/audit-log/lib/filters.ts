import type { AuditArea, AuditEntry } from "../types";

export type AuditQuery = {
  area?: AuditArea | "all";
  search?: string;
  fromIso?: string | null;
  toIso?: string | null;
};

/**
 * Client-side filter over already-loaded entries. Mirrors the mock's
 * `listAuditEntries` semantics (area / actor+target search / inclusive date
 * bounds) so the screen can re-filter on every keystroke without re-fetching.
 * Returns a new array, newest-first.
 */
export function filterAuditEntries(
  entries: AuditEntry[],
  query: AuditQuery,
): AuditEntry[] {
  const { area, search, fromIso, toIso } = query;
  const needle = search?.trim().toLowerCase();
  const fromMs = fromIso ? new Date(fromIso).getTime() : null;
  const toMs = toIso ? new Date(toIso).getTime() : null;

  return entries
    .filter((e) => {
      if (area && area !== "all" && e.area !== area) return false;
      const ms = new Date(e.timestamp).getTime();
      if (fromMs !== null && ms < fromMs) return false;
      if (toMs !== null && ms > toMs) return false;
      if (
        needle &&
        !e.actor.toLowerCase().includes(needle) &&
        !e.target.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    })
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}
