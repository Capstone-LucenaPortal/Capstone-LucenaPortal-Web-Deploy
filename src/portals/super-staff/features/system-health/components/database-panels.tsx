import { formatDateTime } from "@/portals/super-staff/lib/utils";
import { formatSeconds } from "../lib/format";
import { supabaseLogsHref } from "../lib/routes";
import type { PlatformSections } from "../types";
import { Panel, SummaryItem } from "./panel";

type DatabaseDetail = PlatformSections["database"]["detail"];

const count = (x: number) => x.toLocaleString("en-PH");

/** The figures behind the cache, transaction and lock checks. The checks table grades them. */
export function DatabaseActivityPanel({ detail }: { detail: DatabaseDetail }) {
  const { cache, transactions, lock_waits, thresholds } = detail;
  const rows: Array<[string, string]> = [
    [
      "Cache hit ratio",
      cache.ratio_pct === null
        ? "no reads yet"
        : `${cache.ratio_pct}% (${count(cache.hit)} hits, ${count(cache.read)} disk reads)`,
    ],
    [
      "Open transactions",
      transactions.oldest_seconds === null
        ? count(transactions.open)
        : `${count(transactions.open)}, the oldest ${formatSeconds(transactions.oldest_seconds)}`,
    ],
    [
      `Waiting on a lock over ${formatSeconds(thresholds.lock_wait_seconds)}`,
      lock_waits.oldest_seconds === null
        ? count(lock_waits.waiting)
        : `${count(lock_waits.waiting)}, the longest ${formatSeconds(lock_waits.oldest_seconds)}`,
    ],
  ];
  return (
    <Panel title="Cache, transactions and locks">
      <dl className="divide-y divide-gray-100 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-5 py-2">
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-right tabular-nums text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** Information only: autovacuum clears dead rows, so none of this is graded. */
export function DeadRowsPanel({ detail }: { detail: DatabaseDetail }) {
  return (
    <Panel title="Dead rows" summary={<SummaryItem label="All tables" value={count(detail.dead_rows_total)} />}>
      {detail.dead_rows.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-gray-500">No table has dead rows.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-2">Table</th>
              <th className="py-2 text-right">Dead rows</th>
              <th className="py-2 text-right">Live rows</th>
              <th className="px-5 py-2 text-right">Last autovacuum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {detail.dead_rows.map((t) => (
              <tr key={t.table}>
                <td className="px-5 py-2 font-mono text-xs text-gray-900">{t.table}</td>
                <td className="py-2 text-right tabular-nums">{count(t.dead_rows)}</td>
                <td className="py-2 text-right tabular-nums">{count(t.live_rows)}</td>
                <td className="px-5 py-2 text-right text-gray-600">
                  {t.last_autovacuum === null ? "Never" : formatDateTime(t.last_autovacuum)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/**
 * The errors golden signal lives only in Supabase's logs (SCRUM-169, out of
 * scope): said plainly, so its absence is not read as no errors.
 */
export function NotMeasuredNote() {
  return (
    <p className="text-sm text-gray-600">
      Not measured here: request errors and failed sign-ins. See{" "}
      <a
        href={supabaseLogsHref()}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-lucena-blue underline"
      >
        Supabase → Logs
      </a>
    </p>
  );
}
