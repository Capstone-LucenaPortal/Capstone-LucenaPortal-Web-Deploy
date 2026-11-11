import type { TimelineItem } from "@/portals/super-staff/components/ui/history-timeline";
import type { AuditEntry } from "../types";

/**
 * An audit entry as the history timeline shows it.
 *
 * This lives in audit-log, not in the three content editors that render it,
 * because both sides of the mapping are audit-log's: `AuditEntry` is this
 * feature's type, and how a change reads to an operator is this feature's
 * question. The announcement, event and place editors each carried a
 * byte-identical copy, so a change to the summary format meant three edits.
 */
export function toTimelineItem(entry: AuditEntry): TimelineItem {
  // The em dash joins the short change to its detail. `detail` is often
  // absent — a status flip has nothing to add — and an empty one must not
  // leave a trailing separator.
  const summary = entry.detail
    ? `${entry.change} — ${entry.detail}`
    : entry.change;
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    // An account change that sent a Responder's report back to the pool
    // (DB l104) says which one: the Super Staff cannot open the report.
    summary: entry.releasedReport
      ? `${summary} · Report ${entry.releasedReport} returned to the pool`
      : summary,
    actor: entry.actor,
  };
}

export function toTimelineItems(entries: AuditEntry[]): TimelineItem[] {
  return entries.map(toTimelineItem);
}
