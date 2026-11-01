import type { HealthSummary } from "../types";

/**
 * "System healthy X% of samples", never "uptime": app reachability is not
 * sampled, so the figure says nothing about whether the app answered.
 * `healthyPct7d` is null when there are no samples, e.g. right after deploy.
 */
export function healthyLine(summary: HealthSummary): string {
  if (summary.healthyPct7d === null) {
    return "System healthy: no samples yet (last 7 days)";
  }
  return `System healthy ${summary.healthyPct7d}% of samples (last 7 days)`;
}
