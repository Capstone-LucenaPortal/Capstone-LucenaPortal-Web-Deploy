// src/portals/admin/features/sla/components/sla-reports-page.tsx
"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  departmentStatus,
  formatTargetGap,
  getSlaByDepartment,
  getSlaMonthlyHistory,
  getSlaPastDueNow,
  getSlaRangeStats,
  getSlaTrend,
  SLA_SERVICES,
  SLA_TARGET_PCT,
  summarizeMonthlyHistory,
} from "@/portals/admin/features/sla/lib/sla";
import { formatDuration, formatRate } from "@/portals/admin/lib/aggregate";
import { formatManilaTimestamp, presetDateRange } from "@/portals/admin/lib/dates";
import type { PortalError } from "@/portals/admin/lib/supabase/errors";
import {
  ServiceRangeStats,
  SlaDateBasis,
  SlaDepartmentRow,
  SlaDepartmentStatus,
  SlaTrendRow,
} from "@/portals/admin/features/sla/types";
import { Button } from "@/portals/admin/components/ui/button";
import { DataTable } from "@/portals/admin/components/ui/data-table";
import { DateFilterBar, DateFilterPreset } from "@/portals/admin/components/ui/date-filter-bar";
import { SplitKpiTile } from "@/portals/admin/components/ui/kpi-tile";
import { PageHero } from "@/portals/admin/components/layout/page-hero";
import { LoadingStatus, Skeleton } from "@/portals/admin/components/ui/skeleton";
import { ComplianceTrendCard, TREND_TITLE } from "@/portals/admin/features/sla/components/compliance-trend-card";
import { downloadCsv } from "@/portals/admin/lib/csv";
import { listIncidents, IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import { listApplications, YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import { listDepartments, DepartmentRow } from "@/portals/admin/lib/supabase/catalogs";
import {
  finishedLateHref,
  INCIDENT_REPORTS_PATH,
  pastDueHref,
  YELLOW_CARD_PATH,
} from "@/portals/admin/features/sla/lib/sla-links";

const DEPARTMENT_STATUS_CLASSES: Record<SlaDepartmentStatus, string> = {
  "Meeting target": "text-gray-600",
  "Near target": "text-gray-600",
  "Below target": "text-gray-600",
  "Needs attention": "text-red-600",
};

type SlaServiceKey = (typeof SLA_SERVICES)[number]["key"];

const BASIS_OPTIONS: { value: SlaDateBasis; label: string }[] = [
  { value: "request", label: "Request Date" },
  { value: "resolution", label: "Resolution Date" },
];

// Where each service's Finished late and Past due now link to (#127), what
// that page lists, and its own name for each of this page's date types.
const SERVICE_PAGES: Record<
  SlaServiceKey,
  { path: string; noun: [string, string]; basis: Record<SlaDateBasis, string> }
> = {
  yellowCard: {
    path: YELLOW_CARD_PATH,
    noun: ["application", "applications"],
    basis: { request: "application", resolution: "completion" },
  },
  incidents: {
    path: INCIDENT_REPORTS_PATH,
    noun: ["report", "reports"],
    basis: { request: "report", resolution: "resolution" },
  },
};

// "See the 8 reports": the link under a count, only once there is something
// to see. Nothing while loading or after a failed fetch.
function seeTheRequests(key: SlaServiceKey, count: number, href: string): { href: string; label: string } | undefined {
  if (count === 0) return undefined;
  const [one, many] = SERVICE_PAGES[key].noun;
  return { href, label: `See the ${count.toLocaleString()} ${count === 1 ? one : many}` };
}

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
  // incidentDateAccessor/applicationDateAccessor). Nothing on this page
  // pools the two services: the two SLA clocks are not comparable (see
  // getSlaTrend's doc comment), so getSlaRangeStats gives each its own
  // figures, getSlaByDepartment gives Yellow Card its own row, and
  // getSlaTrend and getSlaMonthlyHistory are incidents-only. getSlaPastDueNow
  // alone takes no range: it describes right now.
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
  // No dateRange or dateBasis in its deps: past due is right now, whatever
  // the range, so a filter change leaves it alone (#126).
  const pastDueNow = useMemo(
    () => getSlaPastDueNow(incidentRows, applicationRows),
    [incidentRows, applicationRows]
  );
  const monthlyHistory = useMemo(
    () => getSlaMonthlyHistory(incidentRows, dateRange, dateBasis),
    [incidentRows, dateRange, dateBasis]
  );

  // Real, derived from monthlyHistory — not the old mock's fixed
  // always-10-months array. Incidents-only (see getSlaMonthlyHistory's doc
  // comment) and range-bounded. On time ÷ scored across the months, so it
  // equals the Incidents compliance tile (#122); see summarizeMonthlyHistory.
  const monthlySummary = useMemo(
    () => (monthlyHistory.length === 0 ? null : summarizeMonthlyHistory(monthlyHistory)),
    [monthlyHistory]
  );

  // One service's value on a per-service tile: the figure once loaded, a
  // skeleton while loading, and "—" after a failed fetch, never a stale or
  // fabricated 0 (Admin Portal Fix Plan, Task 1.5).
  function tileValue(read: (service: ServiceRangeStats) => string, key: SlaServiceKey): ReactNode {
    if (status === "ready" && stats) return read(stats[key]);
    return status === "loading" ? <Skeleton className="h-6 w-14" /> : "—";
  }

  function handleExport() {
    if (!stats) return;
    downloadCsv(
      "sla-report.csv",
      ["Period", "Incidents resolved on time %", "Incidents finished late"],
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

      {/* Every SLA tile is shown once per service and never pooled: the
          Yellow Card clock and the incident clocks make different promises
          (ADR 0001, #122). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SplitKpiTile
          label="Requests scored"
          parts={SLA_SERVICES.map(({ name, key }) => ({
            name,
            value: tileValue((service) => service.scored.toLocaleString(), key),
            // What the scored count was out of: this service's requests in
            // range, before pending, withdrawn, open and invalid ones are
            // left out of scoring.
            caption:
              status === "ready" && stats
                ? `of ${stats[key].inRange.toLocaleString()} ${dateBasis === "request" ? "filed" : "closed"} in range`
                : undefined,
            note: status === "ready" && compare ? stats?.[key].scoredDelta : undefined,
          }))}
          direction="neutral"
          noteTone="positive"
        />
        <SplitKpiTile
          label="Finished late"
          parts={SLA_SERVICES.map(({ name, key }) => ({
            name,
            value: tileValue((service) => service.finishedLate.toLocaleString(), key),
            note: status === "ready" && compare ? stats?.[key].finishedLateDelta : undefined,
            // The same range and date type, so the table lists exactly the
            // requests counted here.
            link:
              status === "ready" && stats
                ? seeTheRequests(
                    key,
                    stats[key].finishedLate,
                    finishedLateHref(SERVICE_PAGES[key].path, preset, dateRange, SERVICE_PAGES[key].basis[dateBasis])
                  )
                : undefined,
          }))}
          direction="lower-is-better"
          noteTone="negative"
        />
        <SplitKpiTile
          label="Compliance"
          parts={SLA_SERVICES.map(({ name, key }) => ({
            name,
            value: tileValue((service) => formatRate(service.compliancePct), key),
            caption: status === "ready" && stats ? formatTargetGap(stats[key].gapToTargetPts) : undefined,
          }))}
          footnote={`Project target: ${SLA_TARGET_PCT}%`}
          direction="higher-is-better"
          noteTone="neutral"
        />
        {/* Past due now replaced Avg Response, which repeated the incident
            time to resolve and was not on the clock (#126, metrics sheet
            S4). It describes right now, so it has no delta. */}
        <SplitKpiTile
          label="Past due now"
          parts={SLA_SERVICES.map(({ name, key }) => ({
            name,
            value:
              status === "ready"
                ? pastDueNow[key].toLocaleString()
                : status === "loading"
                  ? <Skeleton className="h-6 w-14" />
                  : "—",
            link: status === "ready" ? seeTheRequests(key, pastDueNow[key], pastDueHref(SERVICE_PAGES[key].path)) : undefined,
          }))}
          footnote="Right now, whatever the date range"
          direction="lower-is-better"
          noteTone="negative"
        />
      </div>
      {/* The third service's absence is a stated choice, not an oversight:
          SCRUM-131's booking clock was cut, and the Charter's booking times
          are voluntary standards (ADR 0001, amendment 2026-10-06). */}
      <p className="text-xs text-gray-500">Booking has no turnaround clock yet (voluntary standard, ADR 0001)</p>

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
          <h2 className="text-lg font-semibold text-gray-900">{TREND_TITLE}</h2>
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
            Compliance against the {SLA_TARGET_PCT}% project target
          </p>
          {/* "Scored" only counts SLA-scoreable rows — the same scoreable-
              vs-total gap the Requests scored tile above captions. A row's
              "of N total" sub-line (when it differs) reconciles the two
              rather than leaving an admin to notice a raw count elsewhere
              disagrees with no explanation why (Admin Portal Fix Plan, Phase
              1 final review, finding 3). */}
          <p className="text-xs text-gray-500">
            Scored counts decided Yellow Card applications and resolved incidents only — pending reviews,
            withdrawals, and open, invalid, duplicate or expired reports are not scored (see the &quot;of N
            total&quot; note under a row&apos;s count).
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
                  header: "Scored",
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
                  header: "Scored",
                  headerClassName: "text-right",
                  className: "text-right tabular-nums",
                  render: (row: SlaTrendRow) => row.totalRequests,
                },
                {
                  header: "On time",
                  headerClassName: "text-right",
                  className: "text-right tabular-nums",
                  render: (row: SlaTrendRow) => row.onTime,
                },
                {
                  header: "Finished late",
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
                  // From filing to resolution, not the clock: the Admin
                  // glossary's "Time to resolve".
                  header: "Avg time to resolve",
                  headerClassName: "text-right",
                  className: "text-right tabular-nums",
                  render: (row: SlaTrendRow) => formatDuration(row.avgResponseDays),
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
            <strong className="text-gray-900">
              Across {monthlyHistory.length} month{monthlyHistory.length === 1 ? "" : "s"}:
            </strong>{" "}
            {formatRate(monthlySummary.compliancePct)} on time ({monthlySummary.onTime.toLocaleString()} of{" "}
            {monthlySummary.scored.toLocaleString()} scored) ·{" "}
            <strong className="text-gray-900">Best month:</strong>{" "}
            {monthlySummary.best
              ? `${monthlySummary.best.label} (${formatRate(monthlySummary.best.compliancePct)})`
              : "no scoreable month in range"}
          </div>
        )}
      </section>
    </div>
  );
}
