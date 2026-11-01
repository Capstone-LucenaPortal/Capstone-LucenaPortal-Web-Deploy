import { truncateStatement } from "../lib/format";
import type { Statement, SystemHealth } from "../types";
import { Panel } from "./panel";

function StatementTable({ title, rows }: { title: string; rows: Statement[] }) {
  return (
    <div className="min-w-0">
      <h3 className="px-5 pb-2 pt-3 text-sm font-semibold text-gray-700">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-gray-500">No statements recorded yet.</p>
      ) : (
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-y border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="w-20 px-5 py-2 text-right">Calls</th>
              <th className="w-20 py-2 text-right">Mean</th>
              <th className="px-5 py-2">Statement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Keyed by rank: two statements can share their first 120 characters. */}
            {rows.map((q, rank) => (
              <tr key={rank}>
                <td className="px-5 py-2 text-right tabular-nums">{q.calls.toLocaleString("en-PH")}</td>
                <td className="py-2 text-right tabular-nums">{q.mean_ms.toFixed(1)} ms</td>
                <td className="truncate px-5 py-2 font-mono text-xs text-gray-700">{truncateStatement(q.query)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Information only: the ticket set no threshold, so there is no badge. */
export function PerformancePanel({ performance }: { performance: SystemHealth["performance"] }) {
  return (
    <Panel title="Performance">
      <div className="grid gap-2 pb-2 2xl:grid-cols-2">
        <StatementTable title="Slowest statements" rows={performance.by_mean} />
        <StatementTable title="Most-called statements" rows={performance.by_calls} />
      </div>
    </Panel>
  );
}
