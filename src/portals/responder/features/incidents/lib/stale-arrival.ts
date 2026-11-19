import type {
  IncidentStatus,
  ResponderNotification,
} from "@/portals/responder/features/incidents/types";

/** The event_code trg_notify_department_pool writes on every pool arrival. */
export const POOL_ARRIVAL = "incident_pool_arrival";

/** What decides whether an Inbox row is an arrival, and for which report. */
export type ArrivalKey = Pick<ResponderNotification, "event_code" | "record_id">;

/**
 * The ids of the reports behind a list's pool arrivals, each once: what the
 * status lookup is asked about.
 */
export function arrivalIncidentIds(rows: readonly ArrivalKey[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.event_code === POOL_ARRIVAL && row.record_id) ids.add(row.record_id);
  }
  return [...ids];
}

/**
 * A **stale arrival**: a pool arrival whose report is no longer in my
 * department's pool to act on — the PO's rule (HIP-007, 2026-10-27), #138.
 *
 * `visible` is what responder_incidents returned for the arrivals' ids. That
 * view is scoped to my DEPARTMENT with no status filter, so a report missing
 * from it was rerouted away or rejected, and one present with `closed` is
 * closed. Every other status is live — including a report rerouted away and
 * back again, whose old entry is live once more. Claimed, in-progress and
 * resolved reports are outside the rule on purpose.
 *
 * One function for the list and the badge, so the two cannot disagree.
 */
export function isStaleArrival(
  row: ArrivalKey,
  visible: ReadonlyMap<string, IncidentStatus>,
): boolean {
  if (row.event_code !== POOL_ARRIVAL || !row.record_id) return false;
  const status = visible.get(row.record_id);
  return status === undefined || status === "closed";
}
