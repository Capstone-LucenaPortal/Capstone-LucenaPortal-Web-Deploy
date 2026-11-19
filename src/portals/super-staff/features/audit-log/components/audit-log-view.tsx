"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { cn, formatDateTime } from "@/portals/super-staff/lib/utils";
import { rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";
import { AUDIT_AREAS, areaLabel } from "../lib/area";
import {
  dateRangeToBounds,
  defaultDateRange,
  isReversedRange,
} from "../lib/date-range";
import { forensicContext } from "../lib/entry";
import {
  AUDIT_PAGE_SIZE,
  countAuditAreas,
  listAuditPage,
  newestAuditEntryAt,
  ZERO_COUNTS,
  type AuditPage,
} from "../lib/queries";
import type { AreaCounts, AreaFilter } from "../types";
import { AreaBadge } from "./area-badge";

const TABS: { key: AreaFilter; label: string }[] = [
  { key: "all", label: "All" },
  ...AUDIT_AREAS.map((a) => ({ key: a, label: areaLabel(a) })),
];

/** The search goes out this long after the last keystroke. */
const SEARCH_WAIT_MS = 300;

/** The page on screen, and which page it is (1-based). */
type ShownPage = AuditPage & { page: number };

export function AuditLogView() {
  const [tab, setTab] = useState<AreaFilter>("all");
  /** The search box as typed. */
  const [search, setSearch] = useState("");
  /** The search as sent: the box, trimmed, once typing pauses. */
  const [sentSearch, setSentSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  /** False until the first ceiling has set the default dates. */
  const [opened, setOpened] = useState(false);
  const [shown, setShown] = useState<ShownPage | null>(null);
  const [counts, setCounts] = useState<AreaCounts | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** The one load in flight. Starting another cancels it, so a late answer is
   *  never shown; leaving the page cancels it too. */
  const inFlight = useRef<AbortController | null>(null);
  /** The ceiling the shown page was read under; page turns keep it. */
  const ceiling = useRef<string | null>(null);
  /** The ceiling the first open read, which its first page reuses. */
  const openingCeiling = useRef<string | null | undefined>(undefined);
  /** The first open failed: keep its error up until a filter changes. */
  const openingFailed = useRef(false);
  /** The dates `counts` were read for. Counts follow the dates only. */
  const countedDates = useRef<string | null>(null);

  const { fromIso, beforeIso } = useMemo(
    () => dateRangeToBounds({ fromDate, toDate }),
    [fromDate, toDate],
  );
  // Nothing is read while reversed; the table says why instead.
  const reversed = isReversedRange({ fromDate, toDate });

  const startLoad = (): AbortSignal => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    return controller.signal;
  };

  // All or nothing: no rows beside counts that failed, or the reverse.
  const failLoad = (e: unknown) => {
    setError(rpcErrorMessage(e, "Could not load the audit log."));
    setShown(null);
    setCounts(null);
    countedDates.current = null;
    setLoading(false);
  };

  // The newest entry anchors the default 30-day window, so a log that has been
  // quiet for a while still opens on rows rather than on an empty range.
  useEffect(() => {
    const signal = startLoad();
    const open = (anchor: Date) => {
      const range = defaultDateRange(anchor);
      setFromDate(range.fromDate);
      setToDate(range.toDate);
      setOpened(true);
    };
    newestAuditEntryAt(signal)
      .then((newest) => {
        if (signal.aborted) return;
        openingCeiling.current = newest;
        open(newest ? new Date(newest) : new Date());
      })
      .catch((e: unknown) => {
        if (signal.aborted) return;
        failLoad(e);
        // Still fill the dates, so that changing a filter tries again.
        openingFailed.current = true;
        open(new Date());
      });
    return () => inFlight.current?.abort();
  }, []);

  // A cleared box searches at once (see `changeSearch`); text waits for a pause.
  useEffect(() => {
    const text = search.trim();
    if (text === "") return;
    const timer = setTimeout(() => setSentSearch(text), SEARCH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const changeSearch = (value: string) => {
    setSearch(value);
    if (value.trim() === "") setSentSearch("");
  };

  // A new filter state: page 1 under a new ceiling, with the counts too when
  // the dates are new. Pages read up to one ceiling, so a row written while
  // paging can't push a row onto the next page twice; it appears here, on the
  // next change.
  //
  // On a tab or search change the counts are kept from the last date change,
  // under that change's ceiling (#100: counts follow the dates only). So All
  // can trail the results line by the rows written in between, until the next
  // date change.
  useEffect(() => {
    if (!opened) return;
    if (openingFailed.current) {
      openingFailed.current = false;
      return;
    }
    if (reversed) {
      // Fixing the dates reads the counts again, even back to the same dates.
      inFlight.current?.abort();
      countedDates.current = null;
      return;
    }
    const signal = startLoad();
    const dates = `${fromIso}|${beforeIso}`;
    const opening = openingCeiling.current;
    openingCeiling.current = undefined;
    setLoading(true);
    setExpandedId(null);

    (async () => {
      const upTo =
        opening !== undefined ? opening : await newestAuditEntryAt(signal);
      if (upTo === null) {
        return { upTo, page: { entries: [], total: 0 }, areas: ZERO_COUNTS };
      }
      const scope = { fromIso, beforeIso, ceiling: upTo };
      const [page, areas] = await Promise.all([
        listAuditPage(
          { ...scope, area: tab, search: sentSearch, page: 1 },
          signal,
        ),
        countedDates.current === dates
          ? null
          : countAuditAreas(scope, signal),
      ]);
      return { upTo, page, areas };
    })().then(
      ({ upTo, page, areas }) => {
        if (signal.aborted) return;
        ceiling.current = upTo;
        setShown({ ...page, page: 1 });
        if (areas) {
          setCounts(areas);
          countedDates.current = dates;
        }
        setError(null);
        setLoading(false);
      },
      (e: unknown) => {
        if (!signal.aborted) failLoad(e);
      },
    );
  }, [opened, reversed, fromIso, beforeIso, tab, sentSearch]);

  const turnTo = (page: number) => {
    const upTo = ceiling.current;
    if (upTo === null) return;
    const signal = startLoad();
    setLoading(true);
    listAuditPage(
      { fromIso, beforeIso, ceiling: upTo, area: tab, search: sentSearch, page },
      signal,
    ).then(
      (result) => {
        if (signal.aborted) return;
        setShown({ ...result, page });
        setExpandedId(null);
        setLoading(false);
      },
      (e: unknown) => {
        if (!signal.aborted) failLoad(e);
      },
    );
  };

  const busy = loading && !reversed;
  const lastPage = shown
    ? Math.max(1, Math.ceil(shown.total / AUDIT_PAGE_SIZE))
    : 1;
  const firstShown = shown ? (shown.page - 1) * AUDIT_PAGE_SIZE + 1 : 0;
  const tabLabel = (t: (typeof TABS)[number]) =>
    counts && !reversed ? `${t.label} (${counts[t.key]})` : t.label;

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
            {tabLabel(t)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <input
          type="search"
          aria-label="Search audit log"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          placeholder="Search actor or target…"
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        />
        {/* Each box bounds the other, but typing can still get a reversed
            pair past min/max: see `reversed`. */}
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            From
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
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
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
            />
          </label>
        </div>
      </div>

      {/* Later loads keep what is on screen, dimmed, rather than flicker to
          an empty table; only the first open says Loading…. */}
      <div
        aria-busy={busy}
        className={cn(
          "mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white transition-opacity",
          busy && shown !== null && "opacity-50",
        )}
      >
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
            {reversed ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-red-600"
                >
                  From must be on or before To.
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
            ) : shown === null ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Loading…
                </td>
              </tr>
            ) : shown.entries.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No audit entries match your filters.
                </td>
              </tr>
            ) : (
              shown.entries.map((e) => {
                const context = forensicContext(e);
                const hasReferences = e.references.length > 0;
                const hasReleasedReport = e.releasedReport !== null;
                const expandable =
                  Boolean(e.detail) ||
                  context.length > 0 ||
                  hasReferences ||
                  hasReleasedReport;
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
                          {/* The one report an account change (DB l104) sent
                              back to the department's pool. Not a References
                              block: that is an export's list of applicants. */}
                          {hasReleasedReport && (
                            <p className={cn("text-xs", e.detail && "mt-2")}>
                              <span className="text-gray-500">
                                Report returned to the pool
                              </span>{" "}
                              <span className="font-mono text-gray-700">
                                {e.releasedReport}
                              </span>
                            </p>
                          )}
                          {/* Every reference an export released, uncapped:
                              the auditor needs the whole list, not a count. */}
                          {hasReferences && (
                            <div
                              className={cn(
                                "text-xs",
                                (e.detail || hasReleasedReport) && "mt-2",
                              )}
                            >
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
                                (e.detail || hasReferences || hasReleasedReport) &&
                                  "mt-2",
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

      {shown && !error && !reversed && (
        <div
          className={cn(
            "mt-3 flex flex-wrap items-center justify-between gap-3 transition-opacity",
            busy && "opacity-50",
          )}
        >
          <p className="text-sm text-gray-500">
            {shown.total === 0
              ? "Showing 0 of 0 results."
              : `Showing ${firstShown}–${firstShown + shown.entries.length - 1} of ${shown.total} results.`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => turnTo(shown.page - 1)}
              disabled={busy || shown.page <= 1}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => turnTo(shown.page + 1)}
              disabled={busy || shown.page >= lastPage}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
