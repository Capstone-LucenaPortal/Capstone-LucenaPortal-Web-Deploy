// src/portals/admin/features/dashboard/components/dashboard-page.tsx
"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/portals/admin/components/ui/button";
import { KpiTile } from "@/portals/admin/components/ui/kpi-tile";
import { LoadingStatus, Skeleton } from "@/portals/admin/components/ui/skeleton";
import { useAuth } from "@/portals/admin/features/auth/hooks/use-auth";
import { executiveRangeStats } from "@/portals/admin/features/dashboard/lib/dashboard";
import {
  barangayCoverage,
  barangayTotal,
  categoryMix,
  conventionRangeStats,
  eventTypeMix,
  formatRate,
  incidentSlaHours,
  issueRangeStats,
  yellowCardRangeStats,
} from "@/portals/admin/lib/aggregate";
import { getIncidentConfig, IncidentConfigRow, listDepartments, DepartmentRow } from "@/portals/admin/lib/supabase/catalogs";
import { listApplications, YellowCardRow } from "@/portals/admin/features/yellow-card/lib/yellow-card";
import { listIncidents, IncidentRow } from "@/portals/admin/features/incidents/lib/incidents";
import { listBookings, BookingRow } from "@/portals/admin/features/booking/lib/bookings";
import { getSlaByDepartment, getSlaTrend, SLA_NEEDS_ATTENTION_PCT, SLA_TARGET_PCT } from "@/portals/admin/features/sla/lib/sla";
import type { PortalError } from "@/portals/admin/lib/supabase/errors";
import { filterByDateRange, formatManilaTimestamp, presetDateRange } from "@/portals/admin/lib/dates";
import { AttentionItem } from "@/portals/admin/features/dashboard/types";
import { DateRangeKey } from "@/portals/admin/lib/dates";

const PRESETS: DateRangeKey[] = ["Today", "Week", "Month", "Quarter", "Annual"];

const RANGE_PHRASE: Record<DateRangeKey, string> = {
  Today: "today",
  Week: "this week",
  Month: "this month",
  Quarter: "this quarter",
  Annual: "this year",
};

function rangeCaption(noun: string, range: DateRangeKey): string {
  return `${noun} ${RANGE_PHRASE[range]}`;
}

const ATTENTION_ICON_CLASSES: Record<AttentionItem["tone"], string> = {
  red: "bg-red-100 text-red-600",
  amber: "bg-gray-100 text-gray-600",
  yellow: "bg-gray-100 text-gray-600",
  blue: "bg-blue-100 text-blue-700",
};

function AttentionIcon({ icon }: { icon: AttentionItem["icon"] }) {
  const paths: Record<AttentionItem["icon"], string> = {
    alert: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
    trend: "M3 17l6-6 4 4 8-8m0 0h-5m5 0v5",
    clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
      <path d={paths[icon]} />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-gray-500" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ModuleCard({
  href,
  title,
  icon,
  accent,
  value,
  caption,
  footnote,
  children,
}: {
  href: string;
  title: string;
  icon: ReactNode;
  accent: string;
  // ReactNode, not string: the loading state passes a <Skeleton/> placeholder
  // here rather than a real-looking-but-fake "—" (Admin Portal Fix Plan,
  // Task 4.3).
  value: ReactNode;
  caption: ReactNode;
  footnote: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-none border border-gray-200 border-t-2 bg-white p-5 transition-shadow hover:shadow-md ${accent}`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span className="text-gray-500">{icon}</span>
          {title}
        </span>
        <Chevron />
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{caption}</p>
      <div className="mt-3">{children}</div>
      <p className="mt-2 text-xs text-gray-500">{footnote}</p>
    </Link>
  );
}

function displayNameFor(profile: ReturnType<typeof useAuth>["profile"]): string {
  if (profile?.full_name) return profile.full_name;
  if (profile?.email) return profile.email.split("@")[0];
  return "";
}

export function DashboardPage() {
  const { profile } = useAuth();
  const displayName = displayNameFor(profile);

  const [range, setRange] = useState<DateRangeKey>("Month");

  const [yellowCardRows, setYellowCardRows] = useState<YellowCardRow[]>([]);
  const [incidentRows, setIncidentRows] = useState<IncidentRow[]>([]);
  const [bookingRows, setBookingRows] = useState<BookingRow[]>([]);
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
  // writing to it — the same "retry re-runs the exact same effect on demand"
  // shape used on SLA Reports. A plain state setter call is enough to
  // trigger exactly one additional effect run per click; nothing else in
  // this component (a preset click, a re-render) ever changes it, so this
  // cannot reintroduce the duplicate-fetch-per-load problem Task 4.2 fixed.
  const [retryCount, setRetryCount] = useState(0);

  // null means "not read" — NOT "no SLA". This currently has no visible
  // effect either way: the incident-backlog-past-SLA needs-attention item
  // this once fed was removed outright (Admin Portal Fix Plan, Task 1.3 —
  // see the comment inside needsAttention below), not gated on this being
  // non-null. Fetched and kept anyway, not deleted, so a future Phase
  // 6-backed revival of that item does not have to re-wire this plumbing
  // from scratch (Phase 1 final review, finding 4).
  const [incidentConfig, setIncidentConfig] = useState<IncidentConfigRow | null>(null);

  // A SINGLE fetch effect for every analytics table the dashboard reads —
  // Yellow Card, Incidents, Bookings and the department catalog — each read
  // exactly ONCE per page load (Admin Portal Fix Plan, Task 4.2). Before this
  // fix there were two separate effects: this one, and a second effect keyed
  // on `dateRange` that called getSlaByDepartment(dateRange)/
  // getSlaTrend(dateRange), each of which independently re-fetched
  // listIncidents()/listApplications() (and, for getSlaByDepartment,
  // listDepartments()) all over again — meaning listIncidents alone was
  // fetched three times per load (here, and inside each of those two calls),
  // and re-fetched AGAIN in full on every preset click. getSlaByDepartment/
  // getSlaTrend are now pure, synchronous functions over these same fetched
  // arrays (see src/portals/admin/features/sla/lib/sla.ts) — switching `range` below is a client-side
  // recomputation via useMemo, not a new network request, so there is no
  // second effect and nothing to re-fetch (or abort) on a preset change.
  //
  // Runs once per mount (empty deps): an AbortController is still created
  // and threaded through as each list*() call's `signal` so React 18 Strict
  // Mode's dev-only double-invoke (mount → cleanup → mount) — or an
  // unmount before the fetch resolves — actually cancels the in-flight HTTP
  // requests instead of merely discarding their eventual result the way the
  // old `active` boolean flag did.
  useEffect(() => {
    const controller = new AbortController();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting loading/error state at the start of a data fetch is the standard fetch-in-effect shape; there is no external system to synchronize with instead.
    setIsLoading(true);
    setError(null);

    // The city's per-level incident SLA targets. Fetched separately from the
    // analytics lists below, and its failure swallowed — but as of Task 1.3
    // nothing downstream actually branches on this succeeding or failing
    // (see the comment on `incidentConfig` above and on `slaHours` below);
    // kept fetched anyway for the same future-revival reason. Not threaded
    // with the AbortController: getIncidentConfig has no signal parameter
    // (out of this task's scope — see src/portals/admin/lib/supabase/catalogs.ts), and its result
    // is discarded on failure regardless.
    getIncidentConfig()
      .then((data) => {
        if (controller.signal.aborted) return;
        setIncidentConfig(data);
      })
      .catch(() => {
        // Swallowed on purpose — see comment above.
      });

    Promise.all([
      listApplications(controller.signal),
      listIncidents(controller.signal),
      listBookings(controller.signal),
      listDepartments(),
    ])
      .then(([applications, incidents, bookings, departments]) => {
        if (controller.signal.aborted) return;
        setYellowCardRows(applications);
        setIncidentRows(incidents);
        setBookingRows(bookings);
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
    // fetch (new AbortController, fresh listApplications/listIncidents/
    // listBookings/listDepartments calls) rather than duplicating the fetch
    // logic in a second function. No other state this component holds
    // (`range`, etc.) is in this array, so a preset click recomputes via the
    // useMemo derivations below with zero additional requests — Task 4.2's
    // single-fetch-per-load guarantee holds for every render that is not an
    // explicit Retry click.
  }, [retryCount]);

  // Re-runs the fetch effect above on demand by bumping its `retryCount`
  // dependency — the mechanism this page and SLA Reports share for turning a
  // "one fetch per mount" effect into one an error state's Retry button can
  // also trigger, without duplicating the fetch logic into a second
  // function.
  function handleRetry() {
    setRetryCount((count) => count + 1);
  }

  const dateRange = useMemo(() => presetDateRange(range), [range]);

  // A single fetch-status enum for every analytics table above, driving
  // every KPI tile/module card/department-table/needs-attention value below.
  // `isLoading`/`error` already carry this information; this just names the
  // three states so every render site below can gate on ONE condition rather
  // than re-deriving "am I allowed to show a real number here" from two
  // booleans at each call site. Deliberately does not introduce new state:
  // `yellowCardRows`/`incidentRows`/`bookingRows`/`departmentCatalog` (and
  // every value derived from them below) are NOT reset to empty on a
  // re-fetch, so without this gate a KPI tile would keep showing the
  // PREVIOUS successful fetch's numbers while a new one is loading or has
  // failed — the same "stale number posing as live data" failure mode as the
  // zero-denominator bug this task fixes, just via a different path. Every
  // render site below must check `status`, not just whether the underlying
  // data happens to be populated. There is only one status now (not a
  // separate `slaStatus`, as there was before Task 4.2): department/trend
  // figures are derived from the SAME single fetch as the four hero KPI
  // tiles, not a second independent one, so there is no longer a scenario
  // where one half of the page can succeed while the other fails.
  const status: "loading" | "error" | "ready" = isLoading ? "loading" : error ? "error" : "ready";

  // Pure, synchronous derivations over the once-per-load fetched rows — see
  // the fetch effect's own comment above for why these are no longer a
  // second fetch. Recomputes on every `range` change (a preset click) with
  // zero additional network requests.
  const departmentRows = useMemo(
    () => getSlaByDepartment(incidentRows, yellowCardRows, departmentCatalog, dateRange),
    [incidentRows, yellowCardRows, departmentCatalog, dateRange]
  );
  const trendPoints = useMemo(() => getSlaTrend(incidentRows, dateRange), [incidentRows, dateRange]);

  const stats = useMemo(
    () => executiveRangeStats(yellowCardRows, incidentRows, bookingRows, dateRange),
    [yellowCardRows, incidentRows, bookingRows, dateRange]
  );

  // The dashboard reads Yellow Card stats only for the module card's
  // headline figures and the needs-attention items, none of which use the
  // barangay denominator — so it passes null rather than fetching
  // public_barangays for a value it never renders. The Yellow Card page
  // itself fetches the real count for its "Barangays Reached" tile.
  const ycStats = useMemo(
    () => yellowCardRangeStats(yellowCardRows, dateRange, (row) => row.submitted_at, null),
    [yellowCardRows, dateRange]
  );
  // Per-level response targets from public_incident_config — critical/high/
  // medium/low differ by more than an order of magnitude, so measuring the
  // backlog against any single literal understates breaches at every level
  // but the most lenient one. As of Admin Portal Fix Plan Task 1.3,
  // issueRangeStats' own backlogPastSla ignores this parameter
  // unconditionally (see its doc comment in src/portals/admin/lib/aggregate.ts) — it is
  // computed and passed through anyway, at negligible cost, so issueStats'
  // call below keeps the same signature every other page calling
  // issueRangeStats uses, and so a Phase 6-backed rewrite of backlogPastSla
  // has the targets ready without this wiring needing to be re-added
  // (Phase 1 final review, finding 4).
  const slaHours = useMemo(() => incidentSlaHours(incidentConfig), [incidentConfig]);
  const issueStats = useMemo(
    () => issueRangeStats(incidentRows, dateRange, (row) => row.submitted_at, slaHours),
    [incidentRows, dateRange, slaHours]
  );
  const conventionStats = useMemo(
    () => conventionRangeStats(bookingRows, dateRange, (row) => row.submitted_at),
    [bookingRows, dateRange]
  );

  const topBarangay = useMemo(() => {
    const filtered = filterByDateRange(yellowCardRows, (row) => row.submitted_at, dateRange);
    const coverage = barangayCoverage(filtered);
    if (coverage.length === 0) return null;
    return [...coverage].sort((a, b) => barangayTotal(b) - barangayTotal(a))[0];
  }, [yellowCardRows, dateRange]);

  const topCategory = useMemo(() => {
    const filtered = filterByDateRange(incidentRows, (row) => row.submitted_at, dateRange);
    return categoryMix(filtered)[0] ?? null;
  }, [incidentRows, dateRange]);

  const topEventType = useMemo(() => {
    const filtered = filterByDateRange(bookingRows, (row) => row.submitted_at, dateRange);
    return eventTypeMix(filtered)[0] ?? null;
  }, [bookingRows, dateRange]);

  // Only points with a real (non-null) compliancePct are eligible — a
  // bucket with zero scoreable incidents has no figure to average in or
  // crown "best" (see SlaTrendPoint.compliancePct's doc comment in
  // src/portals/admin/lib/types.ts); folding its null in as 0 would drag trendAvgPct down and
  // could even crown a no-data month "worst" (Admin Portal Fix Plan, Phase 1
  // final review, finding 1 — the same fix applied to the SLA Reports page's
  // own monthlySummary).
  const scoredTrendPoints = useMemo(
    () => trendPoints.filter((point): point is typeof point & { compliancePct: number } => point.compliancePct !== null),
    [trendPoints]
  );
  const bestTrendPoint = useMemo(() => {
    if (scoredTrendPoints.length === 0) return null;
    return scoredTrendPoints.reduce((best, point) => (point.compliancePct > best.compliancePct ? point : best));
  }, [scoredTrendPoints]);
  const bestCompliancePct = bestTrendPoint?.compliancePct ?? null;
  const trendAvgPct =
    scoredTrendPoints.length > 0
      ? Math.round(
          (scoredTrendPoints.reduce((sum, point) => sum + point.compliancePct, 0) / scoredTrendPoints.length) * 10
        ) / 10
      : null;

  // Only rendered while a real result exists to describe (Admin Portal Fix
  // Plan, Phase 3 accessibility task): the mini bar chart below is a purely
  // visual `<div>` grid with no text content of its own, so a screen reader
  // gets nothing from it without an explicit alternative. `role="img"` on
  // the wrapping div hands the whole subtree a single accessible name built
  // from this — deliberately NOT per-bar `title` tooltips, since role="img"
  // removes the individual bar `<div>`s from the accessibility tree
  // entirely (a container with role="img" swallows its subtree), so a
  // tooltip on any one of them would never be reachable by assistive tech.
  // Gated on `status`/`visibleTrendPoints`, not the raw `trendPoints` state,
  // for the same reason as everywhere else on this page: `trendPoints` is
  // not reset on a re-fetch, so without this gate a failed or in-flight
  // fetch would announce the PREVIOUS range's numbers as current.
  const visibleTrendPoints = status === "ready" ? trendPoints : [];
  const trendChartLabel =
    visibleTrendPoints.length > 0
      ? `SLA compliance trend: ${visibleTrendPoints
          .map((point) => `${point.label} ${formatRate(point.compliancePct)}`)
          .join(", ")}`
      : "SLA compliance trend: no data in range";

  // Real signals only — an item appears here only if the underlying
  // condition is actually true for the current range, unlike the old mock's
  // fixed four-item list. If nothing currently qualifies, the panel says so
  // rather than showing invented alerts. Depends on `status`, not just
  // `departmentRows.length`: departmentRows is derived from fetched rows
  // that are NOT reset on a re-fetch, so without this gate a failed fetch
  // would leave the PREVIOUS range's worst-department alerts on screen
  // looking live (Admin Portal Fix Plan, Phase 1 final review, finding 5).
  const needsAttention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    if (status !== "ready") return items;

    const worstDepartments = departmentRows
      .filter((row) => row.compliancePct < SLA_NEEDS_ATTENTION_PCT)
      .sort((a, b) => a.compliancePct - b.compliancePct)
      .slice(0, 2);
    for (const dept of worstDepartments) {
      items.push({
        icon: "alert",
        tone: "red",
        title: `${dept.department} SLA at ${dept.compliancePct}% — ${Math.round((SLA_TARGET_PCT - dept.compliancePct) * 10) / 10} pts below target`,
        detail: `${dept.requests} requests in range · below the ${SLA_NEEDS_ATTENTION_PCT}% "Needs attention" threshold`,
        href: "/admin/sla-reports",
      });
    }

    // A Yellow Card past-SLA item used to live here, gated on
    // ycStats.pendingPastSla > 0. It is removed for now, not repointed:
    // admin_yellow_card_analytics.sla_breached is only meaningful for
    // DECIDED applications (see applicationMet's doc comment in
    // src/portals/admin/features/sla/lib/sla.ts) — the counter behind it only accrues on status
    // change, so a pending application's sla_breached reads false no matter
    // how overdue it actually is. yellowCardRangeStats now returns
    // pendingPastSla: null (unavailable) rather than that structurally-
    // always-0 number, and there is no honest way to trigger a "needs
    // attention" alert from it until Phase 6 gives pending applications a
    // real due date. Repointing this item at decided-and-breached counts
    // instead would not serve the same purpose — a decided application is
    // already closed out, not something staff can still act on.

    // An incident-backlog-past-SLA item used to live here too, gated on
    // issueStats.backlogPastSla !== null && > 0. It is removed for now, not
    // repointed, the same call already made for the Yellow Card item just
    // above and for the same underlying reason: as of Admin Portal Fix Plan
    // Task 1.3, backlogPastSla is unconditionally null — computing it from
    // submitted_at age vs. today's config target counted never-armed
    // (unverified) incidents as breached, charged routing/verification
    // delay against the department, and re-judged old incidents against a
    // target that may have since changed (see backlogPastSla's doc comment
    // in src/portals/admin/lib/aggregate.ts). There is no honest way to trigger a "needs
    // attention" alert from it until a Phase 6 migration adds a real armed
    // due date to admin_incident_analytics.

    return items;
  }, [departmentRows, status]);

  return (
    <div className="space-y-4">
      <div aria-hidden className="fixed inset-0 -z-10 bg-slate-100" />

      <div className="relative -mx-8 -mt-8 overflow-hidden bg-blue-950">
        <img
          src="/map.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-[50%_70%] opacity-90 [filter:saturate(1.4)_contrast(1.05)]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/95 via-blue-950/60 to-blue-900/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-3 px-8 pb-20 pt-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-200">
              City Government of Lucena
            </p>
            <h1 className="mt-1 text-3xl font-bold text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-blue-100/80">
              {displayName ? `${displayName} · leadership view` : "Leadership view"}
            </p>
            {/* Only rendered once `lastUpdatedAt` has actually been set by a
                successful fetch — never during the initial load, and never
                after a failed one, so this never claims freshness the page
                does not have. */}
            {lastUpdatedAt && (
              <p className="mt-1 text-xs text-blue-100/60">
                Updated {formatManilaTimestamp(lastUpdatedAt)} (Asia/Manila)
              </p>
            )}
            {/* The KPI tiles, module cards and needs-attention section below
                all render Skeleton placeholders while `status === "loading"`
                — Skeleton is aria-hidden (a purely visual block), so without
                this a screen reader gets no signal any of that is loading,
                unlike the plain "Loading…" DOM text it replaced. One
                page-level announcement is enough: every one of those regions
                is driven by this same single `status`, so they all start and
                finish loading together — a per-tile/per-card announcement
                would just repeat the same cue four-plus times. */}
            {status === "loading" && <LoadingStatus label="Loading dashboard data…" />}
            <div aria-hidden className="mt-3 h-0.5 w-10 bg-amber-400" />
          </div>
          <div className="flex" role="group" aria-label="Date range preset">
            {PRESETS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={`-ml-px h-8 border px-3 text-xs font-medium backdrop-blur-sm first:ml-0 ${
                  range === key
                    ? "z-10 border-white bg-white text-blue-950"
                    : "border-white/40 bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        // relative z-20: the KPI grid immediately below is a positioned
        // element (`relative z-10`) pulled up by `-mt-14` to tuck into the
        // hero's bottom padding when this banner is absent. A positioned
        // element with a z-index is composited above any non-positioned
        // (static) sibling regardless of DOM order, so without its own
        // stacking context this banner's lower portion — where Retry sits —
        // would be painted over by the grid's opaque, elevated
        // (bg-white shadow-lg) KpiTiles and become unclickable. z-20 (higher
        // than the grid's z-10) ensures this banner always wins that overlap
        // (Admin Portal Fix Plan, Phase 4 final review, finding 1).
        <div className="relative z-20 flex flex-col items-center gap-2 rounded-none border border-gray-200 bg-white px-6 py-4 text-center text-sm text-red-700">
          <p>
            {error.kind === "permission"
              ? "You do not have permission to view dashboard data."
              : `Unable to load dashboard data: ${error.message}`}
          </p>
          <Button variant="secondary" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      )}

      <div className="relative z-10 -mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Citizens engaged"
          value={
            status === "ready" ? stats.citizensEngaged.toLocaleString() : status === "loading" ? <Skeleton className="h-7 w-16" /> : "—"
          }
          note={
            status === "ready" ? (
              stats.citizensDelta
            ) : status === "error" ? (
              "Unable to load"
            ) : (
              <Skeleton className="h-3 w-24" />
            )
          }
          noteTone="positive"
          surface="raised"
        />
        <KpiTile
          label="Service backlog"
          value={
            status === "ready" ? stats.serviceBacklog : status === "loading" ? <Skeleton className="h-7 w-16" /> : "—"
          }
          note={
            status === "ready" ? (
              stats.backlogDelta
            ) : status === "error" ? (
              "Unable to load"
            ) : (
              <Skeleton className="h-3 w-24" />
            )
          }
          noteTone="negative"
          surface="raised"
        />
        <KpiTile
          label="SLA compliance"
          value={
            status === "ready" ? formatRate(stats.slaCompliancePct) : status === "loading" ? <Skeleton className="h-7 w-16" /> : "—"
          }
          note={
            status === "ready" ? (
              stats.slaNote
            ) : status === "error" ? (
              "Unable to load"
            ) : (
              <Skeleton className="h-3 w-24" />
            )
          }
          noteTone="negative"
          surface="raised"
        />
        {/* Labeled "Days with an event", not "Utilization": this is the
            share of calendar days in range with a non-cancelled booking, not
            a capacity fill rate — no venue capacity NUMBER exists to divide
            by (see src/portals/admin/features/dashboard/lib/dashboard.ts's occupancyStats doc comment).
            Convention Center's own Utilization tile says "Not tracked" for
            that reason; this tile must not contradict it by implying a
            fill-rate percentage under a similar-sounding label. */}
        <KpiTile
          label="Days with an event"
          value={
            status === "ready" ? `${stats.lccUtilizationPct}%` : status === "loading" ? <Skeleton className="h-7 w-16" /> : "—"
          }
          note={
            status === "ready" ? (
              stats.lccDelta
            ) : status === "error" ? (
              "Unable to load"
            ) : (
              <Skeleton className="h-3 w-24" />
            )
          }
          noteTone="neutral"
          surface="raised"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Module</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ModuleCard
            href="/admin/yellow-card"
            title="Yellow Card"
            accent="border-t-blue-800"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
                <rect x="3" y="5" width="18" height="14" />
                <path d="M7 9h4m-4 3h6m-6 3h3" />
              </svg>
            }
            value={
              status === "ready" ? ycStats.applications.toLocaleString() : status === "loading" ? <Skeleton className="h-6 w-14" /> : "—"
            }
            caption={rangeCaption("Applications", range)}
            footnote={
              status === "loading"
                ? <Skeleton className="h-3 w-40" />
                : status === "error"
                  ? "Unable to load data"
                  : ycStats.approvalRatePct === null
                    ? "No decided applications in range"
                    : `${formatRate(ycStats.approvalRatePct)} approval rate · top: ${topBarangay?.barangay ?? "—"}`
            }
          >
            <div className="h-1.5 w-full bg-gray-100">
              <div className="h-1.5 bg-blue-800" style={{ width: `${ycStats.approvalRatePct ?? 0}%` }} />
            </div>
          </ModuleCard>

          <ModuleCard
            href="/admin/issue-reports"
            title="Incident Reports"
            accent="border-t-blue-800"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            }
            value={
              status === "ready" ? issueStats.reports.toLocaleString() : status === "loading" ? <Skeleton className="h-6 w-14" /> : "—"
            }
            caption={rangeCaption("Reports", range)}
            footnote={
              status === "loading"
                ? <Skeleton className="h-3 w-40" />
                : status === "error"
                  ? "Unable to load data"
                  : issueStats.resolutionRatePct === null
                    ? "No incidents in range"
                    : topCategory
                      ? `${formatRate(issueStats.resolutionRatePct)} resolved · top: ${topCategory.category}`
                      : `${formatRate(issueStats.resolutionRatePct)} resolved · no reports in range`
            }
          >
            <div className="h-1.5 w-full bg-gray-100">
              <div className="h-1.5 bg-blue-800" style={{ width: `${issueStats.resolutionRatePct ?? 0}%` }} />
            </div>
          </ModuleCard>

          <ModuleCard
            href="/admin/convention-center"
            title="Convention Center"
            accent="border-t-blue-800"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
              </svg>
            }
            value={
              status === "ready" ? conventionStats.bookings.toLocaleString() : status === "loading" ? <Skeleton className="h-6 w-14" /> : "—"
            }
            caption={rangeCaption("Bookings", range)}
            footnote={
              status === "loading"
                ? <Skeleton className="h-3 w-40" />
                : status === "error"
                  ? "Unable to load data"
                  : topEventType
                    ? `Top event type: ${topEventType.type} (${topEventType.count})`
                    : "No bookings in range"
            }
          >
            <div className="h-1.5 w-full bg-gray-100">
              <div
                className="h-1.5 bg-blue-800"
                style={{
                  width: `${topEventType && conventionStats.bookings > 0 ? Math.round((topEventType.count / conventionStats.bookings) * 100) : 0}%`,
                }}
              />
            </div>
          </ModuleCard>

          <ModuleCard
            href="/admin/sla-reports"
            title="SLA Reports"
            accent="border-t-blue-800"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            value={
              status === "ready" ? formatRate(stats.slaCompliancePct) : status === "loading" ? <Skeleton className="h-6 w-14" /> : "—"
            }
            // Gated on `status`, the one fetch-status enum this page now
            // has: departmentRows/trendPoints are derived (via useMemo) from
            // the same fetched rows the four hero KPI tiles read, not a
            // second independently-fetched dataset, so without this a failed
            // fetch would leave the PREVIOUS range's trend average/best-month
            // figures on screen looking live, the same bug Task 1.5 already
            // fixed for the four top KPI tiles (Admin Portal Fix Plan,
            // Phase 1 final review, finding 5).
            caption={
              status === "loading"
                ? <Skeleton className="h-3 w-32" />
                : status === "error"
                  ? "Unable to load data"
                  : trendAvgPct !== null
                    ? `Trend avg: ${formatRate(trendAvgPct)}`
                    : "No SLA trend data in range"
            }
            footnote={
              status === "loading"
                ? <Skeleton className="h-3 w-40" />
                : status === "error"
                  ? "Unable to load data"
                  : bestTrendPoint
                    ? `Best: ${bestTrendPoint.label} (${formatRate(bestCompliancePct)})`
                    : "No SLA trend data in range"
            }
          >
            {/* role="img" + a single descriptive aria-label (Admin Portal Fix
                Plan, Phase 3 accessibility task): this bar grid is purely
                visual and has no text content of its own, and role="img"
                removes its child bar `<div>`s from the accessibility tree
                entirely, so the label below is the only alternative a screen
                reader gets — it must carry every point's value, not just a
                generic chart title. */}
            <div className="flex items-end gap-1" role="img" aria-label={trendChartLabel}>
              {visibleTrendPoints.map((point) => (
                <div
                  key={point.label}
                  // point.compliancePct is null for a bucket with zero
                  // scoreable incidents (see SlaTrendPoint's doc comment in
                  // src/portals/admin/lib/types.ts) — render "—" via formatRate, not a
                  // fabricated "0%" (finding 1), and give it a flat neutral
                  // bar rather than pretending it sits at 0% compliance.
                  className={`flex-1 ${
                    point.compliancePct === null
                      ? "bg-gray-200"
                      : point.compliancePct === bestCompliancePct
                        ? "bg-blue-400"
                        : "bg-blue-800"
                  }`}
                  style={{
                    height: `${
                      point.compliancePct === null
                        ? 4
                        : Math.max(4, Math.round(((point.compliancePct - 70) / 30) * 24) + 4)
                    }px`,
                  }}
                />
              ))}
            </div>
          </ModuleCard>
        </div>
      </div>

      <section className="rounded-none border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-gray-500" aria-hidden>
              <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Needs attention · {needsAttention.length}
          </h2>
          <span className="text-xs text-gray-500">Ranked by impact</span>
        </div>
        {/* needsAttention's only signal today (worst-compliance departments)
            comes from departmentRows, derived from the same single fetch as
            everything else on this page, so this section's own load/error
            state mirrors `status` too — without it, a failed fetch would
            fall through to the empty-state message below and read as the
            reassuring "nothing needs attention" rather than "we don't know,"
            which is its own quieter version of the same stale-data-posing-
            as-live problem (Admin Portal Fix Plan, Phase 1 final review,
            finding 5). */}
        {status === "loading" ? (
          <div className="space-y-2 px-6 py-8">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-center text-sm text-red-700">
            <p>Unable to load needs-attention data.</p>
            <Button variant="secondary" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        ) : needsAttention.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">
            No items currently need attention.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {needsAttention.map((item) => (
              <li key={item.title}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-gray-50"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center ${ATTENTION_ICON_CLASSES[item.tone]}`}
                  >
                    <AttentionIcon icon={item.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900">{item.title}</span>
                    <span className="block text-xs text-gray-500">{item.detail}</span>
                  </span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
