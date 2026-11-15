// Domain types for the SLA-reporting slice.

import type { Delta } from "@/portals/admin/lib/aggregate";

export type SlaDateBasis = "request" | "resolution";

export interface SlaTrendPoint {
  label: string;
  // null when the bucket has zero SCOREABLE incidents (incidentMet(row) !==
  // null) — e.g. a month whose incidents are all still open, or all closed
  // via a non-scoreable closure reason (see incidentMet's doc comment in
  // src/portals/admin/features/sla/lib/sla.ts). Distinct from a real 0%, which means scoreable
  // incidents existed in the bucket and none of them met SLA. Render via
  // formatRate (src/portals/admin/lib/aggregate.ts), never `${value}%`, and exclude null
  // points from any aggregate computed across a list of these (an average,
  // a "best month") rather than treating null as 0.
  compliancePct: number | null;
  violations: number;
}

// A sibling of SlaTrendPoint, not a widening of it: SlaTrendPoint stays the
// exact shape ComplianceTrendCard and the CSV export already expect, while
// this carries the fuller per-month breakdown (getSlaTrend's own bucket
// data, which used to be computed and then discarded) that the "Monthly
// compliance history" table needs.
export interface SlaTrendRow extends SlaTrendPoint {
  totalRequests: number;
  onTime: number;
  // Unrounded mean days to resolve the month's incidents; null when none of
  // them resolved. Render via formatDuration (src/portals/admin/lib/aggregate.ts),
  // never `${value} days`.
  avgResponseDays: number | null;
}

// One service's SLA compliance over the rows it was given: how many
// scoreable requests were judged against the clock, how many finished on
// time and how many late. The two services' clocks make different promises
// (ADR 0001), so this is only ever computed per service, never pooled.
export interface ServiceCompliance {
  scored: number;
  onTime: number;
  finishedLate: number;
  // null when nothing was scored. Render via formatRate
  // (src/portals/admin/lib/aggregate.ts), never `${value}%`, so a quiet
  // period can never misread as "0% compliance".
  compliancePct: number | null;
  // compliancePct minus the 85% project target, in percentage points:
  // negative below it, positive above it. null when nothing was scored.
  gapToTargetPts: number | null;
}

export interface SlaCompliance {
  yellowCard: ServiceCompliance;
  incidents: ServiceCompliance;
}

// One service's SLA Reports tiles: its compliance, plus what its scored
// count was out of and how scored and finished late moved since the
// previous period.
export interface ServiceRangeStats extends ServiceCompliance {
  // Every request of this service in range, BEFORE the scoreable-only
  // filter `scored` applies: still-pending applications, withdrawals, open
  // reports and those closed as invalid, duplicate or expired included.
  // Always >= `scored`.
  inRange: number;
  scoredDelta: Delta;
  finishedLateDelta: Delta;
}

export interface SlaRangeStats {
  rangeLabel: string;
  // Each service's own figures in range, never pooled: the two clocks make
  // different promises (ADR 0001, #122).
  yellowCard: ServiceRangeStats;
  incidents: ServiceRangeStats;
  trend: SlaTrendPoint[];
}

// Each service's waiting requests already past their promised time, right
// now and whatever the range (metrics sheet S4, #126).
export interface SlaPastDueNow {
  yellowCard: number;
  incidents: number;
}

// The footer under the Monthly compliance history: on time ÷ scored across
// all the months, so each month weighs as much as its cases (#122), and the
// month with the highest compliance.
export interface SlaMonthlySummary {
  scored: number;
  onTime: number;
  // null when no month scored anything.
  compliancePct: number | null;
  best: { label: string; compliancePct: number } | null;
}

export type SlaDepartmentStatus =
  | "Meeting target"
  | "Near target"
  | "Below target"
  | "Needs attention";

export interface SlaDepartmentRow {
  department: string;
  requests: number;
  compliancePct: number;
  // Every incident/application attributed to this row in range, BEFORE the
  // scoreable-only filter `requests` applies — the same "unscoreable +
  // scoreable" total ServiceRangeStats.inRange carries per service, just
  // per-row. Always >= `requests`; equal to it when nothing in this row's
  // group was excluded as not-yet-scoreable.
  totalInRange: number;
}
