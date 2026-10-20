// Domain types for the SLA-reporting slice.

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
  avgResponseDays: number;
}

export interface SlaRangeStats {
  rangeLabel: string;
  responses: number;
  responsesDelta: string;
  violations: number;
  violationsDelta: string;
  // null when `responses` is 0 — no SLA-scoreable requests (decided
  // applications + resolved/scoreable incidents) pooled in range. Render via
  // formatRate (src/portals/admin/lib/aggregate.ts), never `${value}%` or `?? 0`, so a
  // quiet period can never misread as "0% compliance".
  compliancePct: number | null;
  avgResponseDays: number;
  avgResponseDelta: string;
  trend: SlaTrendPoint[];
  // Every incident + application filed in range, pooled the same way
  // `responses` is, but BEFORE the scoreable-only filter `responses` applies
  // — i.e. `responses` plus every still-pending application and still-open/
  // non-scoreable incident that got excluded from it. Lets the page caption
  // the gap between the two ("12 of 340 scoreable") instead of leaving it
  // unexplained on screen. Always >= `responses`.
  totalInRange: number;
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
  // scoreable" total SlaRangeStats.totalInRange carries citywide, just
  // per-row. Always >= `requests`; equal to it when nothing in this row's
  // group was excluded as not-yet-scoreable.
  totalInRange: number;
}
