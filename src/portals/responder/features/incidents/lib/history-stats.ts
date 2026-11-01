import type { HistoryRow } from "@/portals/responder/features/incidents/types";

/**
 * What /history lists, and its two tiles -- the success signals from PRD §9.
 *
 * Both return null rather than 0 when there is nothing to measure. A new
 * account showing "0%" reads as a failing responder; "—" reads as what it is.
 * The existing page already renders "—" and this keeps that true.
 */
export interface HistoryStats {
  /** 0-100, or null when nothing measurable finished this month. */
  slaMetPercent: number | null;
  reopenedCount: number;
}

/**
 * ⚠️ UNVERIFIED TICKETS ARE EXCLUDED FROM THE RATE, not counted as failures.
 * An unverified incident never carried a promise -- sla_due_at is null -- so
 * work that no clock was running on cannot count against a responder (story 51).
 */
export function historyStats(rows: HistoryRow[], now: Date): HistoryStats {
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

  const measurable = rows.filter(
    (r) =>
      r.my_last_outcome === "resolved" &&
      r.resolved_at !== null &&
      r.sla_due_at !== null &&
      Date.parse(r.resolved_at) >= monthStart,
  );

  const met = measurable.filter(
    (r) => Date.parse(r.resolved_at!) <= Date.parse(r.sla_due_at!),
  );

  return {
    slaMetPercent: measurable.length
      ? Math.round((met.length / measurable.length) * 100)
      : null,
    reopenedCount: rows.reduce((sum, r) => sum + (r.reopened_count ?? 0), 0),
  };
}

/**
 * The rows /history lists: everything but the ticket the responder holds now.
 *
 * ⚠️ THE HELD TICKET IS FOUND BY ID, NEVER INFERRED FROM `status`.
 * responder_history admits every incident the caller has an event on, and
 * claiming writes one, so the held ticket is always in it -- with a null
 * outcome, or with a stale one when it was released or resolved and then
 * claimed again. But the view is not scoped to assignment: a colleague's
 * in-progress ticket this responder once released is also `in_progress`, and
 * must still read "Released".
 */
export function historyToShow(
  rows: HistoryRow[],
  heldId: string | null,
): HistoryRow[] {
  // The generated row type allows a null id; without a held ticket there is
  // nothing to leave out, so don't let `null !== null` drop such a row.
  if (heldId === null) return rows;
  return rows.filter((r) => r.id !== heldId);
}
