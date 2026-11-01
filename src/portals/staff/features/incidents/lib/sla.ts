import type { ClosureReason, IncidentQueueItem } from "../types";

export type SlaState =
  | "suspended"
  | "not_armed"
  | "healthy"
  | "at_risk"
  | "breached"
  | "met"
  | "not_scored";

export const SLA_STATE_LABELS: Record<SlaState, string> = {
  suspended: "SLA not armed · unverified",
  not_armed: "SLA arms on routing",
  healthy: "On track",
  at_risk: "At risk",
  breached: "Breached",
  met: "Met",
  not_scored: "Not scored",
};

export const SLA_STATE_VARIANT: Record<
  SlaState,
  "default" | "success" | "warning" | "destructive" | "info"
> = {
  suspended: "default",
  not_armed: "default",
  healthy: "info",
  at_risk: "warning",
  breached: "destructive",
  met: "success",
  not_scored: "default",
};

/**
 * Whether a closure ends a report somebody worked. A refusal (`invalid`,
 * `duplicate`) or an expiry does not, so there is no service to score and the
 * row gets no verdict at all. The Admin Portal's NON_SCOREABLE_CLOSURE_REASONS
 * (admin/features/sla/lib/sla.ts) leaves the same three out of its figures; the
 * two must agree. Staff never imports from Admin, hence the copy. A Record, not
 * a Set, so a new closure_reason value fails tsc here until someone decides.
 */
const CLOSURE_IS_SCOREABLE: Record<ClosureReason, boolean> = {
  citizen_confirmed: true,
  auto_confirmed: true,
  invalid: false,
  duplicate: false,
  expired_unverified: false,
};

/**
 * Used only when `public_incident_config` cannot be read. It matches the value
 * stored in the sandbox, so a failed config read degrades to today's behaviour
 * rather than to nonsense.
 */
export const DEFAULT_AT_RISK_THRESHOLD = 0.5;

/**
 * Where an incident stands against its promise.
 *
 * Nothing here computes a deadline. `trg_arm_sla` stamps `sla_armed_at`,
 * `sla_target_hours` and `sla_due_at` on the row the moment an incident is both
 * verified and routed, snapshotting the hours from config so a later config edit
 * does not rewrite history. The old `SLA_HOURS` table in this file was a second,
 * drifting copy of that rule.
 *
 * `threshold` is a fraction of the window, from `at_risk_threshold_pct / 100`.
 */
export function deriveSlaState(
  row: Pick<
    IncidentQueueItem,
    | "is_verified"
    | "status"
    | "closure_reason"
    | "sla_armed_at"
    | "sla_due_at"
    | "resolved_at"
    | "closed_at"
  >,
  now: Date,
  threshold: number,
): SlaState {
  // No proof, no clock — the citizen has not verified the report yet.
  if (!row.is_verified) return "suspended";
  // Verified, but nobody has routed it, so the promise has not started.
  if (!row.sla_due_at || !row.sla_armed_at) return "not_armed";
  // Armed, then refused or expired. The reason wins over any timestamp on the
  // row, a resolved_at included: nobody earned a Met, nobody missed a Breached.
  if (row.closure_reason !== null && !CLOSURE_IS_SCOREABLE[row.closure_reason]) {
    return "not_scored";
  }

  const due = new Date(row.sla_due_at).getTime();

  if (row.status === "resolved" || row.status === "closed") {
    // Refusals and expiry have left above, so a closure here is a confirmed
    // one. Should it lack a resolved_at, closed_at stands in; falling back to
    // sla_due_at, as the mock did, would score it as exactly on time.
    const doneAt = row.resolved_at ?? row.closed_at;
    if (!doneAt) return "breached";
    return new Date(doneAt).getTime() <= due ? "met" : "breached";
  }

  const nowMs = now.getTime();
  if (nowMs >= due) return "breached";

  const armed = new Date(row.sla_armed_at).getTime();
  const window = due - armed;
  if (window <= 0) return "breached";

  return (nowMs - armed) / window >= threshold ? "at_risk" : "healthy";
}
