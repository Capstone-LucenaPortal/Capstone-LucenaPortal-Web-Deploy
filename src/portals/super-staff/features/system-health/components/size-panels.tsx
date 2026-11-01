import { formatBytes } from "../lib/format";
import { checkStatus } from "../lib/checks";
import type { PlatformSections } from "../types";
import { Panel, UsageBar, type Tone } from "./panel";

function UsedOfLimit({
  label,
  used,
  limit,
  pct,
  status,
}: {
  label: string;
  used: string;
  limit: string;
  pct: number;
  status: Tone;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-sm">
        <span className="font-medium text-gray-900">{label}</span>
        <span className="tabular-nums text-gray-600">
          {used} of {limit} · {pct}%
        </span>
      </div>
      <UsageBar pct={pct} status={status} />
    </div>
  );
}

const CONNECTION_STATES = [
  ["active", "Active"],
  ["idle", "Idle"],
  ["idle_in_transaction", "Idle in transaction"],
  ["other", "Other"],
] as const;

/**
 * The database's size, with its largest tables, and its open connections by
 * state, each against its limit. The bars take the size and connections
 * checks' grades.
 */
export function DatabaseSizePanel({ database }: { database: PlatformSections["database"] }) {
  const { detail } = database;
  const { connections } = detail;
  return (
    <Panel title="Size and connections">
      <div className="space-y-4 px-5 pb-4">
        <UsedOfLimit
          label="Database size"
          used={formatBytes(detail.bytes)}
          limit={formatBytes(detail.limit_bytes)}
          pct={detail.pct}
          status={checkStatus(database.checks, "size")}
        />
        {/* Every open client connection, idle ones included: each holds a slot against the limit. */}
        <div>
          <UsedOfLimit
            label="Open connections"
            used={String(connections.active)}
            limit={String(connections.limit)}
            pct={connections.pct}
            status={checkStatus(database.checks, "connections")}
          />
          <p className="mt-1 text-xs tabular-nums text-gray-500">
            {CONNECTION_STATES.map(([key, label]) => `${label} ${connections.by_state[key]}`).join(" · ")}
          </p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-5 py-2">Largest tables</th>
            <th className="px-5 py-2 text-right">Size</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {detail.largest_tables.map((t) => (
            <tr key={t.table}>
              <td className="px-5 py-2 font-mono text-xs text-gray-900">{t.table}</td>
              <td className="px-5 py-2 text-right tabular-nums">{formatBytes(t.bytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/**
 * Storage against the plan's quota, then what each bucket holds: its files,
 * the stray ones no row points to (ungraded) and the missing ones a confirmed
 * row points to but are gone. Counts only, never a path.
 */
export function BucketsPanel({ storage }: { storage: PlatformSections["storage"] }) {
  const { detail } = storage;
  return (
    <Panel title="Buckets">
      <div className="px-5 pb-4">
        <UsedOfLimit
          label="All buckets"
          used={formatBytes(detail.bytes)}
          limit={formatBytes(detail.limit_bytes)}
          pct={detail.pct}
          status={checkStatus(storage.checks, "quota")}
        />
        <p className="mt-2 text-sm text-gray-600">
          Agency seal: {detail.seal_present ? "on file" : "no file"}
        </p>
      </div>
      {detail.buckets.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-gray-500">No buckets hold any files yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-2">Bucket</th>
                <th className="py-2 text-right">Objects</th>
                <th className="px-4 py-2 text-right">Size</th>
                <th className="py-2 text-right">Stray</th>
                <th className="px-5 py-2 text-right">Missing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detail.buckets.map((b) => (
                <tr key={b.bucket}>
                  <td className="px-5 py-2 font-mono text-xs text-gray-900">{b.bucket}</td>
                  <td className="py-2 text-right tabular-nums">{b.objects.toLocaleString("en-PH")}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatBytes(b.bytes)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {b.stray_objects === 0
                      ? "0"
                      : `${b.stray_objects.toLocaleString("en-PH")} (${formatBytes(b.stray_bytes)})`}
                  </td>
                  <td className="px-5 py-2 text-right tabular-nums">{b.missing_objects.toLocaleString("en-PH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
