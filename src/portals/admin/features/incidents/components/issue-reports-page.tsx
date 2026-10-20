// src/portals/admin/features/incidents/components/issue-reports-page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  barangayIncidentRows,
  categoryMix,
  formatRate,
  incidentSlaHours,
  issueRangeStats,
  monthlyCounts,
} from "@/portals/admin/lib/aggregate";
import { IssueDateBasis } from "@/portals/admin/features/incidents/types";
import {
  filterByDateRange,
  formatManilaDate,
  formatManilaRangeLabel,
  formatManilaTimestamp,
  presetDateRange,
} from "@/portals/admin/lib/dates";
import { listIncidents, IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import {
  listDepartments,
  DepartmentRow,
  listIncidentCategories,
  IncidentCategoryRow,
  getIncidentConfig,
  IncidentConfigRow,
} from "@/portals/admin/lib/supabase/catalogs";
import type { PortalError } from "@/portals/admin/lib/supabase/errors";
import { Tabs } from "@/portals/admin/components/ui/tabs";
import { DataTable } from "@/portals/admin/components/ui/data-table";
import { Badge, BadgeVariant } from "@/portals/admin/components/ui/badge";
import { Button } from "@/portals/admin/components/ui/button";
import { DateFilterBar, DateFilterPreset } from "@/portals/admin/components/ui/date-filter-bar";
import { KpiTile } from "@/portals/admin/components/ui/kpi-tile";
import { PageHero } from "@/portals/admin/components/layout/page-hero";
import { MixBarCard } from "@/portals/admin/components/ui/mix-bar-card";
import { MonthlyBarCard } from "@/portals/admin/components/ui/monthly-bar-card";
import { LoadingStatus, Skeleton } from "@/portals/admin/components/ui/skeleton";
import { BarangayReportsTable } from "@/portals/admin/features/incidents/components/barangay-reports-table";
import { IssueReportReviewModal } from "@/portals/admin/features/incidents/components/issue-report-review-modal";
import {
  getCategoryBarClass,
  getCategoryChipClasses,
  getIncidentLevelVariant,
  getIncidentStatusVariant,
} from "@/portals/admin/lib/status-colors";
import {
  CLOSURE_REASON_LABELS,
  INCIDENT_LEVEL_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_ORDER,
  IncidentStatusValue,
} from "@/portals/admin/lib/status-labels";
import { downloadCsv } from "@/portals/admin/lib/csv";

const BASIS_OPTIONS: { value: IssueDateBasis; label: string }[] = [
  { value: "report", label: "Report Date" },
  { value: "resolution", label: "Resolution Date" },
];

// The real incident_status enum, in display order, each with its human label
// sourced from Staff's canonical map (src/portals/admin/lib/status-labels.ts). "All" is a
// UI-only pseudo-status, not a database value.
const STATUS_TABS: { value: "all" | IncidentStatusValue; label: string }[] = [
  { value: "all", label: "All" },
  ...INCIDENT_STATUS_ORDER.map((value) => ({ value, label: INCIDENT_STATUS_LABELS[value] })),
];

function statusLabel(status: IncidentRow["status"]): string {
  if (!status) return "Unknown";
  return INCIDENT_STATUS_LABELS[status] ?? status;
}

function statusVariant(status: IncidentRow["status"]): BadgeVariant {
  return status ? getIncidentStatusVariant(status) : "default";
}

function levelLabel(level: IncidentRow["incident_level"]): string {
  if (!level) return "Unknown";
  return INCIDENT_LEVEL_LABELS[level] ?? level;
}

function levelVariant(level: IncidentRow["incident_level"]): BadgeVariant {
  return level ? getIncidentLevelVariant(level) : "default";
}

// "—" for null rather than a blank cell — an open/in-progress incident has
// no closure_reason yet, which is a legitimately-absent value, not missing
// data (same convention as departmentLabel/barangayLabel elsewhere on this
// page).
function closureReasonLabel(reason: IncidentRow["closure_reason"]): string {
  if (!reason) return "—";
  return CLOSURE_REASON_LABELS[reason] ?? reason;
}

// Admin Portal Fix Plan, Task 5.3, Step 3: time_to_triage_hours is already on
// admin_incident_analytics (l42) but was never rendered anywhere. Sub-hour
// triage rounds to "<1h" rather than a misleadingly precise-looking "0.1h" or
// a false "0h".
function formatTriageHours(hours: IncidentRow["time_to_triage_hours"]): string {
  if (hours === null || hours === undefined) return "—";
  if (hours < 1) return "<1h";
  return `${Math.round(hours * 10) / 10}h`;
}

function filterRows(rows: IncidentRow[], tab: (typeof STATUS_TABS)[number]["value"]): IncidentRow[] {
  if (tab === "all") return rows;
  return rows.filter((row) => row.status === tab);
}

export function IssueReportsPage() {
  const [preset, setPreset] = useState<DateFilterPreset>("Month");
  // Seeded from the current Manila month rather than from literals written
  // the day this page was authored — see the yellow-card page for the same
  // note. Lazy initialisers, so presetDateRange runs once on mount.
  const [customStart, setCustomStart] = useState(() => presetDateRange("Month").from);
  const [customEnd, setCustomEnd] = useState(() => presetDateRange("Month").to);
  const [dateBasis, setDateBasis] = useState<IssueDateBasis>("report");
  const [compare, setCompare] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof STATUS_TABS)[number]["value"]>("all");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<PortalError | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [categories, setCategories] = useState<IncidentCategoryRow[]>([]);
  // null means "not read" — NOT "no SLA". This currently has no visible
  // effect either way: the Open Backlog tile's backlogPastSla note below is
  // unconditionally "SLA breach count unavailable" (Admin Portal Fix Plan,
  // Task 1.3 — issueRangeStats' backlogPastSla ignores `slaHours` entirely,
  // see its own doc comment in src/portals/admin/lib/aggregate.ts), not gated on this
  // being non-null. Fetched and kept anyway, not deleted, so a future Phase
  // 6-backed rewrite of backlogPastSla does not have to re-wire this
  // plumbing from scratch (Phase 1 final review, finding 4).
  const [incidentConfig, setIncidentConfig] = useState<IncidentConfigRow | null>(null);
  // Set only inside the fetch effect's success path below, never on every
  // render — this is what lets the "Updated {time} (Asia/Manila)" stamp near
  // the title show only after data has actually loaded at least once, not
  // during the initial load or after a failed fetch (Admin Portal Fix Plan,
  // Task 4.3).
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  // Bumped only by handleRetry below so the fetch effect's dependency array
  // can name it without the effect itself ever writing to it — clicking
  // Retry re-runs this exact effect rather than duplicating the fetch logic
  // into a second function. Nothing else in this component changes it, so
  // this cannot turn into a second fetch on an ordinary render.
  const [retryCount, setRetryCount] = useState(0);

  // A fresh AbortController per effect run (mount, or a Retry click bumping
  // `retryCount`) whose signal is threaded into listIncidents() — the same
  // pattern Dashboard/SLA Reports use (Admin Portal Fix Plan Task 4.2).
  // Before this fix this effect used only the `active` boolean-flag pattern:
  // correctness-safe (a stale response was still discarded), but not
  // load-safe — a Retry click or navigating away mid-fetch left
  // fetchAllRows' pagination loop running to completion with nothing to
  // actually cancel the in-flight HTTP requests, undercutting the point of
  // this phase (Phase 4 final review, finding 2). listIncidents already
  // accepted an optional `signal` before this fix; this page just never
  // passed one.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting loading/error state at the start of a data fetch is the standard fetch-in-effect shape; there is no external system to synchronize with instead.
    setIsLoading(true);
    setError(null);

    listIncidents(controller.signal)
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

    // Department labels are a display nicety, not a load gate: public_departments
    // is public reference data with its own failure mode, and a caller who
    // cannot fetch it should still see the incident list with raw
    // assigned_department_code values rather than an error blocking the page.
    listDepartments()
      .then((data) => {
        if (!active) return;
        setDepartments(data);
      })
      .catch(() => {
        // Swallowed on purpose — see comment above.
      });

    // Same "display nicety, not a load gate" reasoning as listDepartments
    // above: public_incident_categories is public reference data, and a
    // caller who can't fetch it should still see the category mix and
    // barangay hotspot panels with raw category_code values rather than an
    // error blocking the page.
    listIncidentCategories()
      .then((data) => {
        if (!active) return;
        setCategories(data);
      })
      .catch(() => {
        // Swallowed on purpose — see comment above.
      });

    // Same "display nicety, not a load gate" reasoning again: a caller who
    // cannot read public_incident_config should still see the report list.
    // As of Task 1.3, though, this fetch's result has no effect on anything
    // rendered right now (see the comment on `incidentConfig` and on
    // `slaHours` below) — it is kept fetched anyway, not removed, for the
    // same future-revival reason.
    getIncidentConfig()
      .then((data) => {
        if (!active) return;
        setIncidentConfig(data);
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
    // fetch. No other state this component holds is in this array, so a
    // filter change recomputes via the useMemo derivations below with zero
    // additional requests.
  }, [retryCount]);

  // Re-runs the fetch effect above on demand by bumping its `retryCount`
  // dependency, rather than duplicating the fetch logic into a second
  // function.
  function handleRetry() {
    setRetryCount((count) => count + 1);
  }

  // The city's per-level response targets (critical/high/medium/low), read
  // from public_incident_config rather than hardcoded: Super Staff can change
  // any of them through save_incident_config, and they differ from each other
  // by more than an order of magnitude, so no single literal is right for all
  // four. As of Task 1.3, issueRangeStats' own backlogPastSla ignores this
  // parameter unconditionally (see its doc comment in src/portals/admin/lib/aggregate.ts)
  // — computed and passed through anyway, at negligible cost, so a future
  // Phase 6-backed rewrite of backlogPastSla has the targets ready without
  // this wiring needing to be re-added (Phase 1 final review, finding 4).
  const slaHours = useMemo(() => incidentSlaHours(incidentConfig), [incidentConfig]);

  const departmentLabel = useMemo(() => {
    const byCode = new Map(departments.map((dept) => [dept.code, dept.label]));
    return (code: string | null): string => {
      if (!code) return "—";
      return byCode.get(code) ?? code;
    };
  }, [departments]);

  // Fix round 1, item 3: categoryMix/barangayIncidentRows return the raw
  // category_code (there's no label on admin_incident_analytics itself);
  // this joins it to the human label from the catalog, falling back to the
  // raw code — same fallback shape as departmentLabel above — rather than
  // rendering blank when the catalog has no match (or hasn't loaded yet).
  const categoryLabel = useMemo(() => {
    const byCode = new Map(categories.map((category) => [category.code, category.label]));
    return (code: string): string => byCode.get(code) ?? code;
  }, [categories]);

  // The table, KPI tiles and CSV export must all describe the same date
  // range: every DateFilterPreset value (including "Custom") resolves to
  // concrete from/to bounds, so the table is never silently unfiltered.
  const dateRange = useMemo(
    () => (preset === "Custom" ? { from: customStart, to: customEnd } : presetDateRange(preset)),
    [preset, customStart, customEnd]
  );
  // "report" reads submitted_at; "resolution" reads resolved_at — an
  // unresolved incident has no resolved_at and drops out of every KPI tile
  // under that basis, the same way filterByDateRange already drops any row
  // whose accessor returns null.
  const statsDateAccessor = useMemo(
    () => (dateBasis === "resolution" ? (row: IncidentRow) => row.resolved_at : (row: IncidentRow) => row.submitted_at),
    [dateBasis]
  );
  const rangeLabel = useMemo(() => formatManilaRangeLabel(dateRange), [dateRange]);
  const stats = useMemo(
    () => issueRangeStats(rows, dateRange, statsDateAccessor, slaHours),
    [rows, dateRange, statsDateAccessor, slaHours]
  );
  const filtered = useMemo(
    () => filterByDateRange(filterRows(rows, activeTab), (row) => row.submitted_at, dateRange),
    [rows, activeTab, dateRange]
  );

  // categoryMix/barangayIncidentRows read `filtered`, not raw `rows`, so
  // these panels agree with the status tab and date preset the table/CSV
  // export below already reflect (Fix round 1, item 2) — a mix panel that
  // silently ignored the active filter would be worse than a stale KPI
  // number, since a stale chart doesn't visually look wrong the way a stale
  // number does.
  const categoryMixSlices = useMemo(() => categoryMix(filtered), [filtered]);
  const barangayRows = useMemo(() => barangayIncidentRows(filtered), [filtered]);
  // Unlike the two panels above, monthlyCounts stays on the raw, unfiltered
  // `rows` — not `filtered` — on purpose: it exists to show a multi-month
  // trend, and feeding it an already date-preset-narrowed array would
  // collapse most presets to a single bucket, defeating the chart. Do not
  // "fix" this to match the panels above.
  //
  // MonthlyBarCard's title promises "Last 6 months"; monthlyCounts itself
  // returns every Manila month present in `rows` (oldest-first, no fixed
  // window), so the page slices the trailing 6 itself.
  const monthlyReports = useMemo(
    () => monthlyCounts(rows, (row) => row.submitted_at).slice(-6),
    [rows]
  );
  const barangayRowsWithLabels = useMemo(
    () => barangayRows.map((row) => ({ ...row, topCategory: categoryLabel(row.topCategory) })),
    [barangayRows, categoryLabel]
  );

  // Derived from the same real, already-filtered rows the table above shows
  // — not a fixed caption. When nothing matches the current filters, the
  // panel says so rather than repeating a stale figure.
  const hotspotInsight = useMemo(() => {
    if (barangayRowsWithLabels.length === 0) {
      return { emphasis: "No hotspots", text: "in this range — no reports match the current filters." };
    }
    const top = [...barangayRowsWithLabels].sort((a, b) => b.reports - a.reports).slice(0, 2);
    const names = top.map((row) => row.barangay).join(" and ");
    const verb = top.length > 1 ? "are" : "is";
    const noun = top.length > 1 ? "hotspots" : "hotspot";
    return {
      emphasis: names,
      text: `${verb} the top ${noun} in this range, led by ${top[0].topCategory} reports.`,
    };
  }, [barangayRowsWithLabels]);

  // The CSV carries no reporter PII — every column here also appears in the
  // visible table — so it reads the already-filtered `rows` state directly
  // rather than going through an audited RPC (contrast with Yellow Card's
  // exportApplications, which releases applicant identity and must be audited).
  function handleExportReports() {
    downloadCsv(
      "issue-reports.csv",
      [
        "Reference",
        "Type",
        "Level",
        "Barangay",
        "Department",
        "Submitted",
        "Status",
        "Closure Reason",
        "Reopened",
        "Time to Triage",
      ],
      filtered.map((row) => [
        row.reference_number ?? "—",
        row.incident_type_label ?? "—",
        levelLabel(row.incident_level),
        row.barangay_name ?? row.barangay_code ?? "—",
        departmentLabel(row.assigned_department_code),
        formatManilaDate(row.submitted_at),
        statusLabel(row.status),
        closureReasonLabel(row.closure_reason),
        row.reopened_count ?? 0,
        formatTriageHours(row.time_to_triage_hours),
      ])
    );
  }

  return (
    <div className="space-y-4">
      <PageHero title="Incident Reports" subtitle="Hotspots and category breakdown by barangay" image="/perez-park.webp">
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
      {/* The KPI tiles and the Recent reports table below both render
          Skeleton placeholders while `isLoading` — Skeleton is aria-hidden (a
          purely visual block), so without this a screen reader gets no
          signal any of that is loading, unlike the plain "Loading reports…"
          DOM text it replaced. One page-level announcement is enough: both
          regions are driven by this same single `isLoading`, so they start
          and finish loading together. */}
      {isLoading && <LoadingStatus label="Loading reports…" />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Reports"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : error ? "—" : stats.reports.toLocaleString()}
          note={isLoading ? <Skeleton className="h-3 w-24" /> : error || !compare ? undefined : stats.reportsDelta}
          noteTone="positive"
        />
        <KpiTile
          label="Resolution Rate"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : error ? "—" : formatRate(stats.resolutionRatePct)}
          note={isLoading ? <Skeleton className="h-3 w-24" /> : error || !compare ? undefined : stats.resolutionRateDelta}
          noteTone="negative"
        />
        <KpiTile
          label="Avg Response"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : error ? "—" : `${stats.avgResponseDays}d`}
          note={isLoading ? <Skeleton className="h-3 w-24" /> : error || !compare ? undefined : stats.avgResponseDelta}
          noteTone="positive"
        />
        {/* backlogPastSla is always null (Admin Portal Fix Plan, Task 1.3):
            computing it from submitted_at age vs. today's config target
            counted never-armed (unverified) incidents as breached, charged
            routing/verification delay against the department, and re-judged
            old incidents against a target that may have since changed — see
            backlogPastSla's doc comment in src/portals/admin/lib/aggregate.ts. It stays
            unavailable, the same "unknown, not zero" rule the Yellow Card
            page's Pending Review tile already applies to pendingPastSla,
            until a Phase 6 migration adds a real armed due date to
            admin_incident_analytics. */}
        <KpiTile
          label="Open Backlog"
          value={isLoading ? <Skeleton className="h-7 w-16" /> : error ? "—" : stats.openBacklog}
          note={
            isLoading ? (
              <Skeleton className="h-3 w-24" />
            ) : error ? undefined : stats.backlogPastSla === null ? (
              "SLA breach count unavailable — pending DB support"
            ) : (
              `${stats.backlogPastSla} past their level's SLA target`
            )
          }
          noteTone={stats.backlogPastSla === null ? "neutral" : "negative"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* The subtitle names the ACTIVE range. It used to read a fixed
            "this month" while the panel below it was fed `filtered` — the
            rows for whatever preset is selected — so an Annual or Custom
            range described itself as a month. */}
        <MixBarCard
          title="Category mix"
          subtitle={`Share of reports · ${rangeLabel}`}
          slices={categoryMixSlices.map((slice) => {
            const label = categoryLabel(slice.category);
            return {
              label,
              count: slice.count,
              chipClass: getCategoryChipClasses(label),
              // Keyed on slice.category (the raw category_code), not on the
              // joined label — the label is editable catalog data, the code
              // is the stable identity. See src/portals/admin/lib/status-colors.ts.
              barClass: getCategoryBarClass(slice.category),
            };
          })}
        />
        <MonthlyBarCard
          title="Reports by month"
          subtitle="Last 6 months"
          months={monthlyReports}
        />
      </div>

      <BarangayReportsTable rows={barangayRowsWithLabels} insight={hotspotInsight} />

      <section className="rounded-none border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent reports</h2>
          <Button variant="secondary" onClick={handleExportReports}>
            ↓ Export
          </Button>
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
                ? "You do not have permission to view Incident Reports."
                : `Unable to load reports: ${error.message}`}
            </p>
            <Button variant="secondary" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">No reports match this filter.</p>
        ) : (
          <DataTable
            columns={[
              { header: "Reference", render: (row: IncidentRow) => row.reference_number ?? "—" },
              { header: "Type", render: (row: IncidentRow) => row.incident_type_label ?? "—" },
              {
                header: "Level",
                render: (row: IncidentRow) => (
                  <Badge status={levelLabel(row.incident_level)} variant={levelVariant(row.incident_level)} />
                ),
              },
              {
                header: "Barangay",
                render: (row: IncidentRow) => row.barangay_name ?? row.barangay_code ?? "—",
              },
              {
                header: "Department",
                render: (row: IncidentRow) => departmentLabel(row.assigned_department_code),
              },
              { header: "Submitted", render: (row: IncidentRow) => formatManilaDate(row.submitted_at) },
              {
                header: "Status",
                render: (row: IncidentRow) => (
                  <Badge status={statusLabel(row.status)} variant={statusVariant(row.status)} />
                ),
              },
              {
                header: "Closure Reason",
                render: (row: IncidentRow) => closureReasonLabel(row.closure_reason),
              },
              {
                // Only rendered where reopened_count > 0 — the common
                // reopened_count === 0 case is a plain "—", matching every
                // other absent-value cell in this table, rather than an
                // always-visible badge/icon column that would be near-empty
                // on the typical row (Admin Portal Fix Plan, Task 5.3, Step 2).
                header: "Reopened",
                render: (row: IncidentRow) =>
                  row.reopened_count && row.reopened_count > 0 ? (
                    <Badge status={`Reopened ×${row.reopened_count}`} variant="warning" />
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Time to Triage",
                render: (row: IncidentRow) => formatTriageHours(row.time_to_triage_hours),
              },
              {
                header: "Review",
                render: (row: IncidentRow) =>
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

      <IssueReportReviewModal incidentId={reviewingId} onClose={() => setReviewingId(null)} />
    </div>
  );
}
