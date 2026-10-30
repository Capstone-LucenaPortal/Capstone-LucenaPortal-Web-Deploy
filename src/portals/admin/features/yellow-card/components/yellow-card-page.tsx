// src/portals/admin/features/yellow-card/components/yellow-card-page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  barangayCoverage,
  barangayTotal,
  formatRate,
  recentMonthlyCounts,
  yellowCardDateAccessor,
  yellowCardRangeStats,
} from "@/portals/admin/lib/aggregate";
import {
  customRangeError,
  filterByDateRange,
  formatManilaDate,
  formatManilaRangeLabel,
  formatManilaTimestamp,
  presetDateRange,
} from "@/portals/admin/lib/dates";
import { YellowCardDateBasis } from "@/portals/admin/features/yellow-card/types";
import { exportApplications, listApplications, YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import { applicationMet } from "@/portals/admin/features/sla/lib/sla";
import { listBarangays } from "@/portals/admin/lib/supabase/catalogs";
import type { PortalError } from "@/portals/admin/lib/supabase/errors";
import { YELLOW_CARD_STATUS_LABELS, YELLOW_CARD_STATUS_ORDER, YellowCardStatusValue } from "@/portals/admin/lib/status-labels";
import { getSlaVariant, getYellowCardStatusVariant } from "@/portals/admin/lib/status-colors";
import { Tabs } from "@/portals/admin/components/ui/tabs";
import { DataTable } from "@/portals/admin/components/ui/data-table";
import { Badge, BadgeVariant } from "@/portals/admin/components/ui/badge";
import { Button } from "@/portals/admin/components/ui/button";
import { BarangayCoverageTable } from "@/portals/admin/features/yellow-card/components/barangay-coverage-table";
import { ApplicationReviewModal } from "@/portals/admin/features/yellow-card/components/application-review-modal";
import { DateFilterBar, DateFilterPreset } from "@/portals/admin/components/ui/date-filter-bar";
import { KpiTile } from "@/portals/admin/components/ui/kpi-tile";
import { PageHero } from "@/portals/admin/components/layout/page-hero";
import { MixBarCard } from "@/portals/admin/components/ui/mix-bar-card";
import { MonthlyBarCard } from "@/portals/admin/components/ui/monthly-bar-card";
import { LoadingStatus, Skeleton } from "@/portals/admin/components/ui/skeleton";
import { downloadCsv } from "@/portals/admin/lib/csv";

const BASIS_OPTIONS: { value: YellowCardDateBasis; label: string }[] = [
  { value: "application", label: "Application Date" },
  { value: "completion", label: "Approval/Completion Date" },
];

// The table's date column and the monthly chart's subtitle name the date the
// picked date type reads. The default (submitted) date type keeps the
// subtitle as it always was.
const DATE_COLUMN: Record<YellowCardDateBasis, string> = {
  application: "Submitted",
  completion: "Decided",
};
const MONTHLY_SUBTITLE: Record<YellowCardDateBasis, string> = {
  application: "Last 6 months",
  completion: "By decision date · Last 6 months",
};

// The real yellow_card_application_status enum, in display order, each with
// its human label sourced from Staff's canonical map (src/portals/admin/lib/status-labels.ts).
// "All" is a UI-only pseudo-status, not a database value.
const STATUS_TABS: { value: "all" | YellowCardStatusValue; label: string }[] = [
  { value: "all", label: "All" },
  ...YELLOW_CARD_STATUS_ORDER.map((value) => ({ value, label: YELLOW_CARD_STATUS_LABELS[value] })),
];

function statusLabel(status: YellowCardRow["status"]): string {
  if (!status) return "Unknown";
  return YELLOW_CARD_STATUS_LABELS[status] ?? status;
}

// A null status has no enum code to key a variant off of — same "falls
// through to the default variant" rule getYellowCardStatusVariant already
// applies to a code it doesn't recognise (e.g. withdrawn).
function statusVariant(status: YellowCardRow["status"]): BadgeVariant {
  return status ? getYellowCardStatusVariant(status) : "default";
}

function filterRows(rows: YellowCardRow[], tab: (typeof STATUS_TABS)[number]["value"]): YellowCardRow[] {
  if (tab === "all") return rows;
  return rows.filter((row) => row.status === tab);
}

export function YellowCardPage() {
  const [preset, setPreset] = useState<DateFilterPreset>("Month");
  // Seeded from the current Manila month rather than from literals written
  // the day this page was authored: a hardcoded "2026-05-01"/"2026-05-31"
  // silently ages into an offer to filter by a window months in the past.
  // Lazy initialisers, so presetDateRange runs once on mount instead of on
  // every render.
  const [customStart, setCustomStart] = useState(() => presetDateRange("Month").from);
  const [customEnd, setCustomEnd] = useState(() => presetDateRange("Month").to);
  const [dateBasis, setDateBasis] = useState<YellowCardDateBasis>("application");
  const [compare, setCompare] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof STATUS_TABS)[number]["value"]>("all");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [rows, setRows] = useState<YellowCardRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<PortalError | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  // The "Barangays Reached — N / TOTAL" denominator. null means the barangay
  // list could not be read, which the tile renders as "N / —"; it must never
  // collapse to 0, which would read as "there are no barangays".
  const [barangayCount, setBarangayCount] = useState<number | null>(null);
  // Set only inside the fetch effect's success path below, never on every
  // render — this is what lets the "Updated {time} (Asia/Manila)" stamp near
  // the title show only after data has actually loaded at least once, not
  // during the initial load or after a failed fetch (Admin Portal Fix Plan,
  // Task 4.3).
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  // Bumped only by handleRetry below so the fetch effect's dependency array
  // can name it without the effect itself ever writing to it — clicking
  // Retry re-runs this exact effect (the same listApplications()/
  // listBarangays() calls) rather than duplicating the fetch logic into a
  // second function. Nothing else in this component changes it, so this
  // cannot turn into a second fetch on an ordinary render.
  const [retryCount, setRetryCount] = useState(0);

  // A fresh AbortController per effect run (mount, or a Retry click bumping
  // `retryCount`) whose signal is threaded into listApplications() — the
  // same pattern Dashboard/SLA Reports use (Admin Portal Fix Plan Task 4.2).
  // Before this fix this effect used only the `active` boolean-flag pattern:
  // correctness-safe (a stale response was still discarded), but not
  // load-safe — a Retry click or navigating away mid-fetch left
  // fetchAllRows' pagination loop running to completion with nothing to
  // actually cancel the in-flight HTTP requests, undercutting the point of
  // this phase (Phase 4 final review, finding 2). listApplications already
  // accepted an optional `signal` before this fix; this page just never
  // passed one.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting loading/error state at the start of a data fetch is the standard fetch-in-effect shape; there is no external system to synchronize with instead.
    setIsLoading(true);
    setError(null);

    listApplications(controller.signal)
      .then((data) => {
        if (!active) return;
        setRows(data);
        // Only stamped on an actual successful resolution — not in .finally,
        // which also runs on failure — so the "Updated" stamp near the
        // title never appears for a load that failed or was cancelled.
        setLastUpdatedAt(new Date());
      })
      .catch((err: PortalError) => {
        if (!active) return;
        setError(err);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    // The total number of barangays is real reference data (public_barangays,
    // public reference, readable by anon), not a constant to paste into the
    // frontend: a barangay that has filed nothing never appears in the
    // application rows, so the denominator cannot come from them. Fetched
    // separately and its failure swallowed — a caller who cannot read the
    // catalog should still see their applications, with the denominator shown
    // as "—" rather than the whole page erroring out. Not threaded with the
    // AbortController: listBarangays has no signal parameter (out of this
    // task's scope), and its result is discarded on failure regardless.
    listBarangays()
      .then((data) => {
        if (!active) return;
        setBarangayCount(data.length);
      })
      .catch(() => {
        // Swallowed on purpose — see comment above.
      });

    return () => {
      active = false;
      controller.abort();
    };
    // `retryCount` is the only thing that can re-run this effect after
    // mount: clicking Retry below bumps it, which re-executes this exact
    // fetch. No other state this component holds (`preset`, `activeTab`,
    // ...) is in this array, so a filter change recomputes via the useMemo
    // derivations below with zero additional requests.
  }, [retryCount]);

  // Re-runs the fetch effect above on demand by bumping its `retryCount`
  // dependency, rather than duplicating the fetch logic into a second
  // function.
  function handleRetry() {
    setRetryCount((count) => count + 1);
  }

  // The table, KPI tiles and CSV export must all describe the same date
  // range: every DateFilterPreset value (including "Custom") resolves to
  // concrete from/to bounds, so the table is never silently unfiltered while
  // the export beneath it is bounded.
  const dateRange = useMemo(
    () => (preset === "Custom" ? { from: customStart, to: customEnd } : presetDateRange(preset)),
    [preset, customStart, customEnd]
  );
  // "application" reads submitted_at (when the applicant filed); "completion"
  // reads decided_at (when staff approved/rejected it) — a still-pending
  // application therefore has no decided_at and drops out of the KPI tiles,
  // the table, every panel and the monthly chart under the "completion"
  // basis. One accessor feeds all of them so they always count the same
  // rows (issue #24).
  const getDate = yellowCardDateAccessor(dateBasis);
  const rangeLabel = useMemo(() => formatManilaRangeLabel(dateRange), [dateRange]);
  const stats = useMemo(
    () => yellowCardRangeStats(rows, dateRange, getDate, barangayCount),
    [rows, dateRange, getDate, barangayCount]
  );
  const filtered = useMemo(
    () => filterByDateRange(filterRows(rows, activeTab), getDate, dateRange),
    [rows, activeTab, getDate, dateRange]
  );
  // barangayCoverage reads `filtered`, not raw `rows`, so this panel agrees
  // with the status tab and date preset the table/CSV export below already
  // reflect (Fix round 1, item 2) — a coverage figure that silently ignored
  // the active filter would be worse than a stale KPI number, since a stale
  // chart doesn't visually look wrong the way a stale number does.
  const coverage = useMemo(() => barangayCoverage(filtered), [filtered]);
  const topBarangays = useMemo(
    () =>
      [...coverage]
        .sort((a, b) => barangayTotal(b) - barangayTotal(a))
        .slice(0, 5)
        .map((row) => ({
          label: row.barangay,
          count: barangayTotal(row),
          barClass: "bg-blue-800",
        })),
    [coverage]
  );
  // Unlike coverage/topBarangays above, recentMonthlyCounts stays on the raw,
  // unfiltered `rows` — not `filtered` — on purpose: it exists to show a
  // multi-month trend, and feeding it an already date-preset-narrowed array
  // would collapse most presets to a single bucket, defeating the chart. Do
  // not "fix" this to match the other panels above.
  //
  // MonthlyBarCard's title promises "Last 6 months"; recentMonthlyCounts
  // keeps the trailing 6 Manila months present, never one after the current
  // month, counted by the picked date type.
  const monthlyApplications = useMemo(() => recentMonthlyCounts(rows, getDate), [rows, getDate]);

  // exportApplications is a separate audited RPC, not a client-side map over
  // the already-loaded `rows` state: it writes one pii_access audit row per
  // call carrying the full reference manifest of what was released, which a
  // client-side CSV build could never record.
  async function handleExportApplications() {
    setExportError(null);
    const status = activeTab === "all" ? null : activeTab;
    // Every preset maps to concrete bounds — the same `dateRange` the table
    // and KPI tiles already filter by (Custom uses the picked dates directly;
    // every named preset resolves through presetDateRange). There is
    // currently no "All time" pseudo-preset, so this covers every value
    // DateFilterBar can produce; if one is ever added, it is the only case
    // that may send nulls.
    // The RPC still filters on submitted_at whatever the date type, unlike
    // the table: following the date type is Capstone-LucenaPortal-DB#19, and
    // the date type gets passed here once that RPC change is applied.
    // TODO: Custom's from/to are the raw <input type="date"> strings, sent
    // straight to the same RPC whose `date` params get cast to timestamptz in
    // the UTC session zone (see presetDateRange's header in src/portals/admin/lib/dates.ts).
    // Out of scope here — predates this branch and was explicitly scoped out
    // — but it shares the defect.
    const { from, to } = dateRange;

    // Named presets are well-formed by construction (presetDateRange); the
    // Custom preset's bounds are raw <input type="date"> state and must be
    // validated before they reach the audited export RPC. Running the check
    // on every preset is free and keeps this branch-free.
    const rangeError = customRangeError(from, to);
    if (rangeError) {
      setExportError(rangeError);
      return;
    }

    try {
      const exportRows = await exportApplications({ status, from, to });
      downloadCsv(
        "yellow-card-applications.csv",
        ["Reference", "Name", "Barangay", "Email", "Submitted", "Status"],
        exportRows.map((row) => [
          row.reference,
          row.full_name,
          row.barangay_label,
          row.email,
          row.submitted_on,
          row.status,
        ])
      );
    } catch (err) {
      const portalError = err as PortalError;
      setExportError(
        portalError.kind === "permission"
          ? "You do not have permission to export Yellow Card applications."
          : `Unable to export applications: ${portalError.message}`
      );
    }
  }

  return (
    <div className="space-y-4">
      <PageHero title="Yellow Card" subtitle="Applications overview and coverage by barangay" image="/perez-park.webp">
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
      </PageHero>

      {/* Only rendered once `lastUpdatedAt` has actually been set by a
          successful fetch — never during the initial load, and never after
          a failed one, so this never claims freshness the page does not
          have. */}
      {lastUpdatedAt && (
        <p className="text-xs text-gray-500">Updated {formatManilaTimestamp(lastUpdatedAt)} (Asia/Manila)</p>
      )}
      {/* The KPI tiles and the Recent applications table below both render
          Skeleton placeholders while `isLoading` — Skeleton is aria-hidden (a
          purely visual block), so without this a screen reader gets no
          signal any of that is loading, unlike the plain "Loading
          applications…" DOM text it replaced. One page-level announcement is
          enough: both regions are driven by this same single `isLoading`, so
          they start and finish loading together. */}
      {isLoading && <LoadingStatus label="Loading applications…" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Applications"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : error ? "—" : stats.applications.toLocaleString()}
          note={isLoading ? <Skeleton className="h-3 w-24" /> : error || !compare ? undefined : stats.applicationsDelta}
          noteTone="positive"
        />
        <KpiTile
          label="Approval Rate"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : error ? "—" : formatRate(stats.approvalRatePct)}
          note={isLoading ? <Skeleton className="h-3 w-24" /> : error || !compare ? undefined : stats.approvalRateDelta}
          noteTone="positive"
        />
        <KpiTile
          label="Barangays Reached"
          value={
            isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : error ? (
              "—"
            ) : (
              <>
                {stats.barangaysReached}
                <span className="text-base font-medium text-gray-500"> / {stats.barangaysTotal ?? "—"}</span>
              </>
            )
          }
          // With no barangay total there is no "rest" to count, so the note
          // is dropped entirely rather than asserting a figure derived from a
          // denominator that was never read.
          note={
            isLoading ? (
              <Skeleton className="h-3 w-24" />
            ) : error ? undefined : stats.barangaysWithZero === null ? (
              "Barangay list unavailable"
            ) : (
              `${stats.barangaysWithZero} with 0 applicants`
            )
          }
          noteTone="neutral"
        />
        {/* The hour figure is the one the pending rows actually carry
            (sla_target_hours), not a literal: it is set by
            public_yellow_card_config.processing_time_target_days and is
            Super Staff-editable. When a config change leaves the backlog on
            two different clocks there is no single figure to name, so the
            caption drops it rather than misdescribe half the queue.

            pendingPastSla is null until Phase 6 lands a real due-date column
            — admin_yellow_card_analytics.sla_breached is only meaningful for
            DECIDED applications (see applicationMet's doc comment in
            src/portals/admin/features/sla/lib/sla.ts), so there is no honest count of "how many of
            these pending applications are overdue" yet. The caption says so
            rather than showing a number that structurally always reads too
            low.

            stats.pendingPastSla is UNCONDITIONALLY null right now, so the
            ternary below always takes the "unavailable" branch — the
            pendingSlaTargetHours-dependent branches underneath are dead
            code today. They are kept, not collapsed to the single reachable
            branch: once Phase 6 gives pendingPastSla a real non-null value,
            the note should immediately pick the right target-hours wording
            back up, with no further edit needed here (Admin Portal Fix
            Plan, Phase 1 final review, finding 4). */}
        <KpiTile
          label="Pending Review"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : error ? "—" : stats.pendingReview}
          note={
            isLoading ? (
              <Skeleton className="h-3 w-24" />
            ) : error ? undefined : stats.pendingPastSla === null ? (
              "SLA status unavailable for pending applications"
            ) : stats.pendingSlaTargetHours === null ? (
              `${stats.pendingPastSla} past SLA`
            ) : (
              `${stats.pendingPastSla} past ${stats.pendingSlaTargetHours}h SLA`
            )
          }
          noteTone={stats.pendingPastSla === null ? "neutral" : "negative"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyBarCard
          title="Applications by month"
          subtitle={MONTHLY_SUBTITLE[dateBasis]}
          months={monthlyApplications}
          showCounts
        />
        {/* Names the ACTIVE range — it used to read a fixed "this month"
            while the panel below was fed `filtered`. See the same note on
            the Incident Reports page's Category mix panel. */}
        <MixBarCard
          title="Top barangays"
          subtitle={`By applications · ${rangeLabel}`}
          labelStyle="plain"
          slices={topBarangays}
        />
      </div>

      <BarangayCoverageTable rows={coverage} />

      <section className="rounded-none border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent applications</h2>
          <div className="flex flex-col items-end gap-1">
            <Button variant="secondary" onClick={handleExportApplications}>
              ↓ Export
            </Button>
            {exportError && <p className="text-xs text-red-700">{exportError}</p>}
          </div>
        </div>
        <div className="mt-2">
          <Tabs
            tabs={STATUS_TABS.map((tab) => tab.label)}
            active={STATUS_TABS.find((tab) => tab.value === activeTab)?.label ?? "All"}
            onChange={(label) => {
              const match = STATUS_TABS.find((tab) => tab.label === label);
              if (match) setActiveTab(match.value);
            }}
          />
        </div>

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
                ? "You do not have permission to view Yellow Card applications."
                : `Unable to load applications: ${error.message}`}
            </p>
            <Button variant="secondary" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">No applications match this filter.</p>
        ) : (
          <DataTable
            columns={[
              { header: "Reference", render: (row: YellowCardRow) => row.reference_number ?? "—" },
              { header: "Barangay", render: (row: YellowCardRow) => row.barangay_name ?? row.barangay_code ?? "—" },
              { header: DATE_COLUMN[dateBasis], render: (row: YellowCardRow) => formatManilaDate(getDate(row)) },
              {
                header: "Status",
                render: (row: YellowCardRow) => (
                  <Badge status={statusLabel(row.status)} variant={statusVariant(row.status)} />
                ),
              },
              {
                header: "SLA",
                // applicationMet reads null for a still-pending/resubmitted/
                // revision_requested row — its sla_breached is not a
                // scoreable value yet (see applicationMet's doc comment in
                // src/portals/admin/features/sla/lib/sla.ts) — so the badge reads "Unknown" rather
                // than the misleadingly reassuring "On time" it used to show
                // for every undecided application. This is a derived
                // on-time/breached tri-state, not an enum status — its color
                // handling is unchanged by this task, just moved to
                // getSlaVariant (see src/portals/admin/lib/status-colors.ts) now that Badge no
                // longer derives color from its own status text.
                render: (row: YellowCardRow) => {
                  const met = applicationMet(row);
                  return (
                    <Badge
                      status={met === null ? "Unknown" : met ? "On time" : "Breached"}
                      variant={getSlaVariant(met)}
                    />
                  );
                },
              },
              {
                header: "Review",
                render: (row: YellowCardRow) =>
                  row.id ? (
                    <Button variant="secondary" onClick={() => setReviewingId(row.id)}>
                      Review
                    </Button>
                  ) : (
                    "—"
                  ),
              },
            ]}
            rows={filtered}
            rowKey={(row) => row.id ?? row.reference_number ?? ""}
          />
        )}
      </section>

      <ApplicationReviewModal applicationId={reviewingId} onClose={() => setReviewingId(null)} />
    </div>
  );
}
