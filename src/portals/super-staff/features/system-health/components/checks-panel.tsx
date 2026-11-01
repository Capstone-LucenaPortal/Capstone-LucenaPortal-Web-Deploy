import { formatSeconds } from "../lib/format";
import type { HealthCheck } from "../types";
import { Panel, STATUS_WORD, StatusPill } from "./panel";

/** A check's count; a percentage on the capacity and cache checks, whose label says so. */
function formatCount(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("en-PH");
}

/**
 * A section's named checks, as the database grades them. An ungraded check is
 * information only: it shows its count and no pill, and nothing on its row is
 * coloured.
 */
export function ChecksPanel({ checks }: { checks: HealthCheck[] }) {
  return (
    <Panel title="Checks">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-2">Check</th>
              <th className="py-2 text-right">Count</th>
              <th className="px-4 py-2 text-right">Oldest</th>
              <th className="py-2">Status</th>
              <th className="px-5 py-2">What to do</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 align-top">
            {checks.map((c) => (
              <tr key={c.key}>
                <td className="px-5 py-2 font-medium text-gray-900">{c.label}</td>
                <td className="py-2 text-right tabular-nums">{formatCount(c.count)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                  {formatSeconds(c.oldest_seconds)}
                </td>
                <td className="py-2">
                  {c.graded ? (
                    <StatusPill tone={c.status}>{STATUS_WORD[c.status]}</StatusPill>
                  ) : (
                    <span className="text-xs text-gray-500">Not graded</span>
                  )}
                </td>
                <td className="px-5 py-2 text-gray-600">{c.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
