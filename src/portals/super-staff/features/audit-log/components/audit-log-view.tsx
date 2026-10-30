"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { cn, formatDateTime } from "@/portals/super-staff/lib/utils";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import { AUDIT_AREAS, areaLabel } from "../lib/area";
import { computeAreaCounts } from "../lib/counts";
import { dateRangeToBounds, defaultDateRange } from "../lib/date-range";
import { forensicContext } from "../lib/entry";
import { filterAuditEntries } from "../lib/filters";
import { listAuditEntries } from "../lib/queries";
import type { AuditArea, AuditEntry } from "../types";
import { AreaBadge } from "./area-badge";

type Tab = "all" | AuditArea;
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  ...AUDIT_AREAS.map((a) => ({ key: a as Tab, label: areaLabel(a) })),
];

export function AuditLogView() {
  const [all, setAll] = useState<AuditEntry[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // One unfiltered load drives stable tab counts; filtering is client-side. The
  // newest entry anchors the default 30-day window so an inbox that has been
  // quiet for a while still opens on rows rather than on an empty range.
  useEffect(() => {
    let active = true;
    setLoading(true);
    listAuditEntries()
      .then((rows) => {
        if (!active) return;
        setAll(rows);
        const anchor =
          rows.length > 0 ? new Date(rows[0].timestamp) : new Date();
        const range = defaultDateRange(anchor);
        setFromDate(range.fromDate);
        setToDate(range.toDate);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(rpcErrorMessage(e, "Could not load the audit log."));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const { fromIso, toIso } = useMemo(
    () => dateRangeToBounds({ fromDate, toDate }),
    [fromDate, toDate],
  );

  // Date-scoped set drives the tab counts (area/search not applied here).
  const dateScoped = useMemo(
    () => filterAuditEntries(all, { fromIso, toIso }),
    [all, fromIso, toIso],
  );
  const counts = useMemo(() => computeAreaCounts(dateScoped), [dateScoped]);
  const rows = useMemo(
    () => filterAuditEntries(dateScoped, { area: tab, search }),
    [dateScoped, tab, search],
  );
  const countFor = (key: Tab) => (key === "all" ? counts.all : counts[key]);

  const toggle = (id: string) =>
    setExpandedId((current) => (current === id ? null : id));

  return (
    <div>
      <h1 className="text-3xl font-bold text-lucena-blue">Audit Log</h1>

      <div className="mt-6 flex border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key
                ? "border-lucena-blue text-lucena-blue"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {t.label} ({countFor(t.key)})
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <input
          type="search"
          aria-label="Search audit log"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actor or target…"
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        />
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
            />
          </label>
          <span className="pb-2 text-gray-500">–</span>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-500">Timestamp</th>
              <th className="px-4 py-3 font-medium text-gray-500">Actor</th>
              <th className="px-4 py-3 font-medium text-gray-500">Area</th>
              <th className="px-4 py-3 font-medium text-gray-500">Change</th>
              <th className="px-4 py-3 font-medium text-gray-500">Target</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Loading…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-red-600"
                >
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No audit entries match your filters.
                </td>
              </tr>
            ) : (
              rows.map((e) => {
                const context = forensicContext(e);
                const hasReferences = e.references.length > 0;
                const expandable =
                  Boolean(e.detail) || context.length > 0 || hasReferences;
                const isOpen = expandedId === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr
                      className={cn(
                        "border-b border-gray-100 last:border-0",
                        expandable && "cursor-pointer hover:bg-gray-50",
                      )}
                      onClick={expandable ? () => toggle(e.id) : undefined}
                    >
                      <td className="px-4 py-3 text-gray-700">
                        {formatDateTime(e.timestamp)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {e.actor}
                      </td>
                      <td className="px-4 py-3">
                        <AreaBadge area={e.area} />
                      </td>
                      <td className="px-4 py-3 text-gray-700">{e.change}</td>
                      <td className="px-4 py-3 text-gray-700">{e.target}</td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {expandable && (
                          <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                        )}
                      </td>
                    </tr>
                    {expandable && isOpen && (
                      <tr className="border-b border-gray-100 bg-gray-50 last:border-0">
                        <td
                          colSpan={6}
                          className="px-4 py-3 text-sm text-gray-600"
                        >
                          {e.detail && <p>{e.detail}</p>}
                          {/* Every reference an export released, uncapped:
                              the auditor needs the whole list, not a count. */}
                          {hasReferences && (
                            <div className={cn("text-xs", e.detail && "mt-2")}>
                              <p className="text-gray-500">References</p>
                              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-gray-700">
                                {e.references.map((ref, i) => (
                                  <li key={`${i}-${ref}`}>{ref}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {context.length > 0 && (
                            <dl
                              className={cn(
                                "grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs",
                                (e.detail || hasReferences) && "mt-2",
                              )}
                            >
                              {context.map((f) => (
                                <Fragment key={f.label}>
                                  <dt className="text-gray-500">{f.label}</dt>
                                  <dd className="break-all font-mono text-gray-700">
                                    {f.value}
                                  </dd>
                                </Fragment>
                              ))}
                            </dl>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && !error && (
        <p className="mt-3 text-sm text-gray-500">
          Showing {rows.length} of {counts.all} results.
        </p>
      )}
    </div>
  );
}
