import type { HealthCheck, HealthStatus } from "../types";
import { RANK } from "./status";

/**
 * One check's grade, for a panel that colours a figure the check grades. An
 * ungraded or absent check is `muted`, never a stand-in `ok`.
 */
export function checkStatus(checks: HealthCheck[], key: string): HealthStatus | "muted" {
  const check = checks.find((c) => c.key === key);
  return check?.graded ? check.status : "muted";
}

type GradedCheck = Extract<HealthCheck, { graded: true }>;

/**
 * The check behind a section's bad grade, for its tile on General: the worst
 * graded one, the first in table order on a tie. null when every check is ok.
 */
export function worstCheck(checks: HealthCheck[]): GradedCheck | null {
  let worst: GradedCheck | null = null;
  for (const c of checks) {
    if (c.graded && c.status !== "ok" && (worst === null || RANK[c.status] > RANK[worst.status])) worst = c;
  }
  return worst;
}
