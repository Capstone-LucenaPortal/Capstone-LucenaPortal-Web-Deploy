// Domain types for the monitoring feature: the four service-number tiles
// shown as System Health's Service impact (read-only config-impact lens).

export type TrendDirection = "up" | "down" | "flat";

export type StatTile = {
  label: string;
  value: string; // pre-formatted display value, e.g. "88%"
  /** Absent when the prior period is not honestly reconstructible. Render no
   *  delta at all — never "0 vs prev", which asserts no change. */
  deltaLabel?: string;
  direction: TrendDirection;
};

/** The eight columns super_metrics exposes. Any of them can be null: the view
 *  divides by nullif(count(*), 0), so a period with no resolved incidents
 *  returns null rather than dividing by zero. `at_risk_prev` is PERMANENTLY
 *  null — "at risk seven days ago" depends on a threshold and an SLA target
 *  that are not versioned, so it cannot be honestly reconstructed. */
export type Metrics = {
  slaCompliancePct: number | null;
  slaCompliancePctPrev: number | null;
  atRiskNow: number | null;
  atRiskPrev: number | null;
  openBacklog: number | null;
  openBacklogPrev: number | null;
  bookings7d: number | null;
  bookings7dPrev: number | null;
};
