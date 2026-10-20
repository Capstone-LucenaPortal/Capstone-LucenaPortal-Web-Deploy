import { Clock } from "lucide-react";
import { EmptyState } from "@/portals/responder/components/ui/empty-state";
import { HistoryRow } from "@/portals/responder/features/incidents/components/history-row";
import { getHistory } from "@/portals/responder/features/incidents/lib/data";
import { historyStats } from "@/portals/responder/features/incidents/lib/history-stats";

export const metadata = { title: "History · LucenaPortal Responder" };

/**
 * Everything this responder has worked, resolved or handed back. The two tiles
 * are the success signals from PRD §9 — SLA compliance and the citizen reopen
 * rate.
 *
 * ⚠️ WITH NO HISTORY THE TILES SHOW "—", NEVER "0%". Story 53: nothing has been
 * measured yet, which is not the same as having failed every ticket, and a new
 * account greeted by "0%" reads as a failing responder.
 *
 * Released and rejected tickets are listed too (story 48) — `responder_history`
 * is scoped to "incidents I have an event on", so handing a ticket back does
 * not erase the work done on it.
 */
export default async function HistoryPage() {
  const rows = await getHistory();
  const stats = historyStats(rows, new Date());

  return (
    <div className="mx-auto max-w-2xl px-3 py-3.5">
      <div className="mb-3 flex gap-2">
        <StatTile
          value={stats.slaMetPercent === null ? "—" : `${stats.slaMetPercent}%`}
          label="SLA met this month"
          tone="text-green-800"
          measured={stats.slaMetPercent !== null}
        />
        <StatTile
          value={rows.length === 0 ? "—" : String(stats.reopenedCount)}
          label="Reopened by citizen"
          tone="text-amber-600"
          measured={rows.length > 0}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nothing finished yet"
          description="Tickets you resolve show up here with how long they took against their SLA."
          className="py-12"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          {rows.map((row) => (
            <HistoryRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({
  value,
  label,
  tone,
  measured,
}: {
  value: string;
  label: string;
  tone: string;
  measured: boolean;
}) {
  return (
    <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3.25 py-3">
      <p
        className={`text-2xl font-bold tabular-nums ${tone}`}
        aria-label={measured ? `${label}: ${value}` : `${label}: not yet measured`}
      >
        {value}
      </p>
      <p className="mt-px text-[11.5px] text-gray-500">{label}</p>
    </div>
  );
}
