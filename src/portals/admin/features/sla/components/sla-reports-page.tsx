// src/portals/admin/features/sla/components/sla-reports-page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  departmentStatus,
  getSlaByDepartment,
  getSlaMonthlyHistory,
  getSlaRangeStats,
  getSlaTrend,
  SLA_TARGET_PCT,
} from "@/portals/admin/features/sla/lib/sla";
import { formatRate } from "@/portals/admin/lib/aggregate";
import { formatManilaTimestamp, presetDateRange } from "@/portals/admin/lib/dates";
import type { PortalError } from "@/portals/admin/lib/supabase/errors";
import { SlaDateBasis, SlaDepartmentRow, SlaDepartmentStatus, SlaTrendRow } from "@/portals/admin/features/sla/types";
import { Button } from "@/portals/admin/components/ui/button";
import { DataTable } from "@/portals/admin/components/ui/data-table";
import { DateFilterBar, DateFilterPreset } from "@/portals/admin/components/ui/date-filter-bar";
import { KpiTile } from "@/portals/admin/components/ui/kpi-tile";
import { PageHero } from "@/portals/admin/components/layout/page-hero";
import { LoadingStatus, Skeleton } from "@/portals/admin/components/ui/skeleton";
import { ComplianceTrendCard } from "@/portals/admin/features/sla/components/compliance-trend-card";
import { downloadCsv } from "@/portals/admin/lib/csv";
import { listIncidents, IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import { listApplications, YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import { listDepartments, DepartmentRow } from "@/portals/admin/lib/supabase/catalogs";

const DEPARTMENT_STATUS_CLASSES: Record<SlaDepartmentStatus, string> = {
  "Meeting target": "text-gray-600",
  "Near target": "text-gray-600",
  "Below target": "text-gray-600",
  "Needs attention": "text-red-600",
};

const BASIS_OPTIONS: { value: SlaDateBasis; label: string }[] = [
  { value: "request", label: "Request Date" },
  { value: "resolution", label: "Resolution Date" },
];

export function SLAReportsPage() {
  const [preset, setPreset] = useState<DateFilterPreset>("Month");
  // Seeded from the current Manila month rather than from literals written
  // the day this page was authored — see the yellow-card page for the same
  // note. Lazy initialisers, so presetDateRange runs once on mount.
  const [customStart, setCustomStart] = useState(() => presetDateRange("Month").from);
  const [customEnd, setCustomEnd] = useState(() => presetDateRange("Month").to);
  const [dateBasis, setDateBasis] = useState<SlaDateBasis>("request");
  const [compare, setCompare] = useState(true);

  const [incidentRows, setIncidentRows] = useState<IncidentRow[]>([]);
  const [applicationRows, setApplicationRows] = useState<YellowCardRow[]>([]);
  const [departmentCatalog, setDepartmentCatalog] = useState<DepartmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<PortalError | null>(null);
  // Set only inside the fetch effect's success path below, never on every
  // render — this is what lets the "Updated {time} (Asia/Manila)" stamp near
  // the title show only after data has actually loaded at least once, not
  // during the initial load or after a failed fetch (Admin Portal Fix Plan,
  // Task 4.3).
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  // Bumped only by handleRetry below (never read for its value) so the fetch
  // effect's dependency array can name it without the effect itself ever
  // writing to it. A plain state setter call is enough to trigger exactly
  // one additional effect run per click; nothing else in this component (a
  // preset/date-basis change, a re-render) ever changes it, so this cannot
  // reintroduce the duplicate-fetch-per-load problem Task 4.2 fixed.
  const [retryCount, setRetryCount] = useState(0);

  // getSlaByDepartment/getSlaTrend/getSlaRangeStats/getSlaMonthlyHistory
  // must all describe the same date window the filter controls above show,
  // the same property every other converted page in this portal now holds —
  // every DateFilterPreset value (including "Custom") resolves to concrete
  // from/to bounds, so this is never silently unfiltered. `dateBasis` (the
  // "Date type" toggle) is passed to all four too: "request" filters every
  // row by submitted_at, "resolution" filters incidents by resolved_at and
  // Yellow Card applications by decided_at (see src/portals/admin/features/sla/lib/sla.ts's
  // incidentDateAccessor/applicationDateAccessor). avgResponseDays stays
  // incidents-only regardless of basis — the two SLA clocks are not
  // comparable (see getSlaTrend's doc comment) — and getSlaByDepartment/
  // getSlaTrend/getSlaMonthlyHistory pool incidents with Yellow Card the
  // same way getSlaRangeStats does (see its own doc comment).
  const dateRange = useMemo(
    () => (preset === "Custom" ? { from: customStart, to: customEnd } : presetDateRange(preset)),
    [preset, customStart, customEnd]
  );

  // A SINGLE fetch effect for every table this page's four SLA computations
  // read — Incidents, Yellow Card applications, and the department catalog —
  // each read exactly ONCE per page load (Admin Portal Fix Plan, Task 4.2).
  // Before this fix, getSlaByDepartment/getSlaTrend/getSlaRangeStats/
  // getSlaMonthlyHistory each independently re-fetched listIncidents()/
  // listApplications() (and, for getSlaByDepartment, listDepartments())
  // themselves, so a single page load issued up to four redundant reads of
  // the same two analytics tables, and re-issued ALL of them on every
  // preset/date-basis change. Those four functions are now pure, synchronous
  // computations over these same fetched arrays (see src/portals/admin/features/sla/lib/sla.ts) —
  // switching `preset`/`customStart`/`customEnd`/`dateBasis` below is a
  // client-side recomputation via useMemo, not a new network request, so
  // there is nothing to re-fetch (or abort) on a filter change.
  //
  // Runs once per mount (empty deps): an AbortController is still created
  // and threaded through as listIncidents/listApplications' `signal` so
  // React 18 Strict Mode's dev-only double-invoke (mount → cleanup → mount)
  // — or an unmount before the fetch resolves — actually cancels the
  // in-flight HTTP requests instead of merely discarding their eventual
  // result the way the old `active` boolean flag did.
  useEffect(() => {
    const controller = new AbortController();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting loading/error state at the start of a data fetch is the standard fetch-in-effect shape; there is no external system to synchronize with instead.
    setIsLoading(true);
    setError(null);

    Promise.all([listIncidents(controller.signal), listApplications(controller.signal), listDepartments()])
      .then(([incidents, applications, departments]) => {
        if (controller.signal.aborted) return;
        setIncidentRows(incidents);
        setApplicationRows(applications);
        setDepartmentCatalog(departments);
        // Only stamped on an actual successful resolution of the Promise.all
        // above — not in .finally, which also runs on failure/abort — so the
        // "Updated {time} (Asia/Manila)" stamp near the title never appears
        // for a load that failed or was cancelled.
        setLastUpdatedAt(new Date());
      })
      .catch((err: PortalError) => {
        // A request this effect itself cancelled (unmount, or Strict Mode's
        // dev double-invoke) is not a real failure to report — reporting it
        // would flash an "Unable to load" error the user never actually hit.
        if (controller.signal.aborted) return;
        setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
    // `retryCount` is the only thing that can re-run this effect after
    // mount: clicking Retry below bumps it, which re-executes this exact
    // fetch (new AbortController, fresh listIncidents/listApplications/
    // listDepartments calls) rather than duplicating the fetch logic in a
    // second function. No other state this component holds (`preset`,
    // `customStart`/`customEnd`, `dateBasis`) is in this array, so a filter
    // change recomputes via the useMemo derivations below with zero
    // additional requests — Task 4.2's single-fetch-per-load guarantee holds
    // for every render that is not an explicit Retry click.
  }, [retryCount]);

  // Re-runs the fetch effect above on demand by bumping its `retryCount`
  // dependency — the mechanism this page and Dashboard share for turning a
  // "one fetch per mount" effect into one an error state's Retry button can
  // also trigger, without duplicating the fetch logic into a second
  // function.
  function handleRetry() {
    setRetryCount((count) => count + 1);
  }

  // A single fetch-status enum for the raw fetch above. Named the same way
  // (and for the same reason) as the equivalent on the Dashboard page:
  // `incidentRows`/`applicationRows`/`departmentCatalog` (and every SLA
  // figure derived from them below) are NOT reset to empty on a re-fetch, so
  // without this gate the four hero KpiTiles below would keep showing the
  // PREVIOUS successful fetch's numbers — or, before this fix, `stats?.x ?? 0`
  // during the initial load and forever after a failed fetch — while a new
  // request is loading or has failed. Every hero tile must check `status`,
  // not just whether `stats` happens to be populated.
  const status: "loading" | "error" | "ready" = isLoading ? "loading" : error ? "error" : "ready";

  // Pure, synchronous derivations over the once-per-load fetched rows — see
  // the fetch effect's own comment above for why these are no longer four
  // separate fetches. Recompute on every preset/custom-range/date-basis
  // change with zero additional network requests.
  const departmentRows = useMemo(
    () => getSlaByDepartment(incidentRows, applicationRows, departmentCatalog, dateRange, dateBasis),
    [incidentRows, applicationRows, departmentCatalog, dateRange, dateBasis]
  );
  const trendPoints = useMemo(
    () => getSlaTrend(incidentRows, dateRange, dateBasis),
    [incidentRows, dateRange, dateBasis]
  );
  const stats = useMemo(
    () => getSlaRangeStats(incidentRows, applicationRows, dateRange, dateBasis),
    [incidentRows, applicationRows, dateRange, dateBasis]
  );
  const monthlyHistory = useMemo(
    () => getSlaMonthlyHistory(incidentRows, dateRange, dateBasis),
    [incidentRows, dateRange, dateBasis]
  );

  // Real, derived from monthlyHistory — not the old mock's fixed
  // always-10-months array. Incidents-only (see getSlaMonthlyHistory's doc
  // comment) and range-bounded: under Today/Week this is one row's worth of
  // "average," which is the honest answer for a window that short, not a
  // defect to paper over with a wider hardcoded lookback.
  //
  // averageCompliancePct/best are derived only from `scoredMonths` — the
  // months whose compliancePct is non-null (see SlaTrendRow.compliancePct's
  // doc comment in src/portals/admin/lib/types.ts) — not all of `monthlyHistory`. A month with
  // zero scoreable incidents has no compliance figure to average in or
  // crown "best"; folding its null in as 0 would drag the average down and
  // could even crown a no-data month "worst" (Admin Portal Fix Plan, Phase 1
  // final review, finding 1). totalRequests is unaffected: it sums
  // totalRequests (scoreable counts, 0 for a no-data month), which is
  // already honest at 0.
  const monthlySummary = useMemo(() => {
    if (monthlyHistory.length === 0) return null;
    const totalRequests = monthlyHistory.reduce((sum, row) => sum + row.totalRequests, 0);
    const scoredMonths = monthlyHistory.filter(
      (row): row is typeof row & { compliancePct: number } => row.compliancePct !== null
    );
    const averageCompliancePct =
      scoredMonths.length > 0
        ? Math.round((scoredMonths.reduce((sum, row) => sum + row.compliancePct, 0) / scoredMonths.length) * 10) /
          10
        : null;
    const best =
      scoredMonths.length > 0 ? scoredMonths.reduce((a, b) => (b.compliancePct > a.compliancePct ? b : a)) : null;
    return { totalRequests, averageCompliancePct, best };
  }, [monthlyHistory]);

  function handleExport() {
    if (!stats) return;
    downloadCsv(
      "sla-report.csv",
      ["Period", "Compliance %", "Violations"],
      // point.compliancePct is null for a bucket with zero scoreable
      // incidents (see SlaTrendPoint's doc comment) — "—", the same glyph
      // formatRate renders on screen, not a blank/0 a spreadsheet reader
      // could misread as a genuine 0%.
      stats.trend.map((point) => [point.label, point.compliancePct ?? "—", point.violations])
    );
  }

  return (
    <div className="space-y-4">
      <PageHero
        title="Monthly SLA Compliance Report"
        subtitle="Public service standard tracking"
        image="/perez-park.webp"
      >
        <div className="flex flex-col items-end gap-3">
          <DateFilterBar
            tone="dark"
            basisOptions={BASIS_OPTIONS}
            dateBasis={dateBasis}
            onDateBasisChange={setDateBasis}
            preset={preset}
            onPresetChange={setPreset}
            customStart={customStart}
            customEnd={customEnd}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
            compare={compare}
            onCompareChange={setCompare}
          />
          <Button variant="secondary" onClick={handleExport}>
            ↓ Export report
          </Button>
        </div>
      </PageHero>

      {/* Only rendered once `lastUpdatedAt` has actually been set by a
          successful fetch — never during the initial load, and never after
          a failed one, so this never claims freshness the page does not
          have. */}
      {lastUpdatedAt && (
        <p className="text-xs text-gray-500">Updated {formatManilaTimestamp(lastUpdatedAt)} (Asia/Manila)</p>
      )}
      {/* The KPI tiles and the three sections below all render Skeleton
          placeholders while `isLoading` — Skeleton is aria-hidden (a purely
          visual block), so without this a screen reader gets no signal any
          of that is loading, unlike the plain "Loading SLA data…" DOM text
          it replaced. One page-level announcement is enough: every one of
          those regions is driven by this same single `isLoading`, so they
          all start and finish loading together. */}
      {isLoading && <LoadingStatus label="Loading SLA data…" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Responses"
          value={
            status === "ready" && stats
              ? stats.responses.toLocaleString()
              : status === "loading"
                ? <Skeleton className="h-7 w-16" />
                : "—"
          }
          // Explains the scoreable-vs-total gap ON the tile itself, rather
          // than leaving an admin to notice this figure disagrees with a raw
          // count shown elsewhere (e.g. Issue Reports' total report count)
          // with nothing on screen saying why (Admin Portal Fix Plan, Phase
          // 1 final review, finding 3). Only shown when there IS a gap to
          // explain — omitted once responses === totalInRange.
          caption={
            status === "ready" && stats && stats.totalInRange > stats.responses
              ? `${stats.responses.toLocaleString()} of ${stats.totalInRange.toLocaleString()} scoreable (pending/unverified excluded)`
              : undefined
          }
          note={status === "ready" && compare ? stats?.responsesDelta : undefined}
          noteTone="positive"
        />
        <KpiTile
          label="SLA Violations"
          value={
            status === "ready" && stats
              ? stats.violations.toLocaleString()
              : status === "loading"
                ? <Skeleton className="h-7 w-16" />
                : "—"
          }
          note={status === "ready" && compare ? stats?.violationsDelta : undefined}
          noteTone="negative"
        />
        <KpiTile
          label="Compliance"
          value={
            status === "ready" && stats
              ? formatRate(stats.compliancePct)
              : status === "loading"
                ? <Skeleton className="h-7 w-16" />
                : "—"
          }
          note={`Target: ${SLA_TARGET_PCT}%`}
          noteTone="neutral"
        />
        <KpiTile
          label="Avg Response"
          value={
            status === "ready" && stats
              ? `${stats.avgResponseDays}d`
              : status === "loading"
                ? <Skeleton className="h-7 w-16" />
                : "—"
          }
          note={status === "ready" && compare ? stats?.avgResponseDelta : undefined}
          noteTone="positive"
        />
      </div>

      {isLoading ? (
        <div className="rounded-none border border-gray-200 bg-white px-6 py-8">
          <Skeleton className="mx-auto h-24 w-full max-w-2xl" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 rounded-none border border-gray-200 bg-white px-6 py-8 text-center text-sm text-red-700">
          <p>
            {error.kind === "permission"
              ? "You do not have permission to view SLA reports."
              : `Unable to load SLA data: ${error.message}`}
          </p>
          <Button variant="secondary" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      ) : trendPoints.length === 0 ? (
        <section className="rounded-none border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Compliance trend</h2>
          <p className="mt-2 text-sm text-gray-500">No SLA data for this range.</p>
        </section>
      ) : (
        <ComplianceTrendCard
          subtitle={stats?.rangeLabel ?? ""}
          points={trendPoints}
          targetPct={SLA_TARGET_PCT}
        />
      )}

      <section className="rounded-none border border-gray-200 bg-white">
        <div className="px-6 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">By department</h2>
          <p className="text-sm text-gray-500">
            Performance against the {SLA_TARGET_PCT}% city standard
          </p>
          {/* "Requests" only counts SLA-scoreable rows — the same scoreable-
              vs-total gap the Responses hero tile above explains. A row's
              "of N total" sub-line (when it differs) reconciles the two
              rather than leaving an admin to notice a raw count elsewhere
              disagrees with no explanation why (Admin Portal Fix Plan, Phase
              1 final review, finding 3). */}
          <p className="text-xs text-gray-500">
            Requests counts SLA-scoreable rows only — pending Yellow Card reviews and still-open/unverified
            incidents are excluded (see the &quot;of N total&quot; note under a row&apos;s count).
          </p>
        </div>
        <div className="mt-2">
          {isLoading ? (
            <div className="space-y-2 px-6 py-8">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 px-6 py-8 text-center text-sm text-red-700">
              <p>
                {error.kind === "permission"
                  ? "You do not have permission to view SLA reports."
                  : `Unable to load SLA data: ${error.message}`}
              </p>
              <Button variant="secondary" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          ) : departmentRows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500">
              No department SLA data for this range.
            </p>
          ) : (
            // wrapperLabel (Admin Portal Fix Plan, Phase 3 accessibility
            // task): makes DataTable's horizontal-scroll wrapper a
            // keyboard-focusable `role="region"` with a real name, so a
            // keyboard-only user can Tab to it and scroll with arrow keys —
            // without this, the table's horizontal overflow on narrow
            // viewports is reachable only by mouse drag/trackpad.
            <DataTable
              wrapperLabel="Department SLA compliance table"
              columns={[
                {
                  // Labeled "Service area", not "Department": the synthetic
                  // Yellow Card row below is staff-module-scoped rather than
                  // department-routed, and "Department" would wrongly imply
                  // it's a peer of engineering/water/electrical/waste/etc.
                  header: "Service area",
                  render: (row: SlaDepartmentRow) => row.department,
                },
                {
                  header: "Requests",
                  headerClassName: "text-right",
                  className: "text-right tabular-nums",
                  render: (row: SlaDepartmentRow) => (
                    <span>
                      {row.requests}
                      {row.totalInRange > row.requests && (
                        <span className="block text-[10px] font-normal text-gray-500">
                          of {row.totalInRange} total
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  header: "Compliance",
                  headerClassName: "text-right",
                  className: "text-right font-semibold tabular-nums",
                  render: (row: SlaDepartmentRow) => `${row.compliancePct}%`,
                },
                {
                  header: "Status",
                  headerClassName: "text-right",
                  className: "text-right",
                  render: (row: SlaDepartmentRow) => {
                    const status = departmentStatus(row.compliancePct);
                    return (
                      <span className={`text-sm font-medium ${DEPARTMENT_STATUS_CLASSES[status]}`}>
                        {status}
                      </span>
                    );
                  },
                },
              ]}
              rows={departmentRows}
              rowKey={(row) => row.department}
            />
          )}
        </div>
      </section>

      <section className="rounded-none border border-gray-200 bg-white">
        <div className="px-6 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Monthly compliance history</h2>
          <p className="text-sm text-gray-500">
            {monthlyHistory.length} month{monthlyHistory.length === 1 ? "" : "s"} in the selected range ·
            incidents only
          </p>
        </div>
        <div className="mt-2">
          {isLoading ? (
            <div className="space-y-2 px-6 py-8">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 px-6 py-8 text-center text-sm text-red-700">
              <p>
                {error.kind === "permission"
                  ? "You do not have permission to view SLA reports."
                  : `Unable to load SLA data: ${error.message}`}
              </p>
              <Button variant="secondary" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          ) : monthlyHistory.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500">
              No monthly compliance history for this range.
            </p>
          ) : (
            // wrapperLabel — see the department table above for why.
            <DataTable
              wrapperLabel="Monthly SLA compliance history table"
              columns={[
                { header: "Period", render: (row: SlaTrendRow) => row.label },
                {
                  header: "Total",
                  headerClassName: "text-right",
                  className: "text-right tabular-nums",
                  render: (row: SlaTrendRow) => row.totalRequests,
                },
                {
                  header: "On Time",
                  headerClassName: "text-right",
                  className: "text-right tabular-nums",
                  render: (row: SlaTrendRow) => row.onTime,
                },
                {
                  header: "Late",
                  headerClassName: "text-right",
                  className: "text-right tabular-nums",
                  render: (row: SlaTrendRow) => row.violations,
                },
                {
                  header: "Compliance",
                  headerClassName: "text-right",
                  className: "text-right font-semibold tabular-nums",
                  render: (row: SlaTrendRow) => formatRate(row.compliancePct),
                },
                {
                  header: "Avg Response",
                  headerClassName: "text-right",
                  className: "text-right tabular-nums",
                  render: (row: SlaTrendRow) => `${row.avgResponseDays} days`,
                },
              ]}
              rows={monthlyHistory}
              rowKey={(row) => row.label}
            />
          )}
        </div>
        {/* status === "ready" as well as `monthlySummary` truthy: monthlyHistory/
            monthlySummary are NOT reset on a new fetch, so without this gate a
            failed range switch would leave the PREVIOUS range's summary
            figures on screen looking live, while the table just above it
            (correctly gated) and the four hero tiles already show "—"/an
            error — the exact "stale number posing as live data" bug Task 1.5
            exists to eliminate everywhere else on this page (Admin Portal Fix
            Plan, Phase 1 final review, finding 2). */}
        {status === "ready" && monthlySummary && (
          <div className="m-6 border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
            <strong className="text-gray-900">{monthlyHistory.length}-month average:</strong>{" "}
            {formatRate(monthlySummary.averageCompliancePct)} ·{" "}
            <strong className="text-gray-900">Best month:</strong>{" "}
            {monthlySummary.best
              ? `${monthlySummary.best.label} (${formatRate(monthlySummary.best.compliancePct)})`
              : "no scoreable month in range"}{" "}
            ·{" "}
            <strong className="text-gray-900">Total processed:</strong>{" "}
            {monthlySummary.totalRequests.toLocaleString()} incidents
          </div>
        )}
      </section>
    </div>
  );
}
