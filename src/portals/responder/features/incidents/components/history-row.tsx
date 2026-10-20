import { RotateCcw } from "lucide-react";
import { formatDuration } from "@/portals/responder/features/incidents/lib/sla";
import { levelLabel, levelTone } from "@/portals/responder/features/incidents/lib/tone";
import type { HistoryRow as HistoryRowType } from "@/portals/responder/features/incidents/types";
import { cn } from "@/portals/responder/lib/utils";

/**
 * One finished ticket.
 *
 * Story 49: the list is a record of DECISIONS, not of contact. What a responder
 * needs from it is which reports they touched and how each one ended — so the
 * outcome is a pill and the SLA verdict sits beside it, and the citizen's phone
 * number is nowhere on this screen.
 *
 * Released and rejected tickets appear here alongside resolved ones (story 48):
 * the work done on a ticket is not erased by handing it back, which is why
 * `responder_history` is scoped to "incidents I have an event on" rather than
 * to assignment.
 */

const PILL = "rounded-full px-2.25 py-0.5 text-[11px] font-semibold";

/** The three ways a responder's involvement can end, as they read on screen. */
const OUTCOME: Partial<
  Record<NonNullable<HistoryRowType["my_last_outcome"]>, string>
> = {
  resolved: "Resolved",
  released: "Released",
  rejected: "Sent back",
};

const OUTCOME_TONE: Record<string, string> = {
  Resolved: "bg-green-100 text-green-800",
  Released: "bg-amber-100 text-amber-800",
  "Sent back": "bg-gray-100 text-gray-700",
};

export function HistoryRow({ row }: { row: HistoryRowType }) {
  const outcome = row.my_last_outcome ? OUTCOME[row.my_last_outcome] : undefined;

  return (
    <article className="border-b border-gray-100 bg-white px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-1.5">
        <span className={`${PILL} ${levelTone(row.incident_level)}`}>
          {levelLabel(row.incident_level)}
        </span>
        {outcome && (
          <span className={`${PILL} ${OUTCOME_TONE[outcome]}`}>{outcome}</span>
        )}
        {(row.reopened_count ?? 0) > 0 && (
          <span
            className={`${PILL} inline-flex items-center gap-1 bg-amber-100 text-amber-800`}
          >
            <RotateCcw size={11} aria-hidden />
            Reopened
          </span>
        )}
        <span className="ml-auto text-[11.5px] tabular-nums text-gray-500">
          {row.reference_number}
        </span>
      </div>

      <h3 className="mt-1.5 text-[14.5px] font-semibold text-pretty text-gray-900">
        {row.type_label}
      </h3>
      <p className="mt-0.5 truncate text-[12.5px] text-gray-500">
        Brgy. {row.barangay_name} · {row.address}
      </p>

      <SlaVerdict row={row} />
    </article>
  );
}

/**
 * Only a RESOLVE is measured against the promise. A release hands the clock on
 * untouched and a reject says the promise was never this department's to keep —
 * scoring either would turn "this was not our job" into a missed deadline.
 */
function SlaVerdict({ row }: { row: HistoryRowType }) {
  if (row.my_last_outcome !== "resolved" || !row.resolved_at) return null;

  if (!row.sla_due_at) {
    return (
      <p className="mt-1 text-[11.5px] font-semibold text-gray-500">No SLA</p>
    );
  }

  const marginMs = Date.parse(row.sla_due_at) - Date.parse(row.resolved_at);
  const late = marginMs < 0;

  return (
    <p
      className={cn(
        "mt-1 text-[11.5px] font-semibold tabular-nums",
        late ? "text-red-600" : "text-green-800",
      )}
    >
      {formatDuration(Math.abs(marginMs))} {late ? "over" : "to spare"}
    </p>
  );
}
