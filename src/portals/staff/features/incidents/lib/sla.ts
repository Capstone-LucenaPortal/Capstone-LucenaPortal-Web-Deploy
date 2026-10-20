import type { IncidentQueueItem } from "../types";

export type SlaState =
  | "suspended"
  | "not_armed"
  | "healthy"
  | "at_risk"
  | "breached"
  | "met";

export const SLA_STATE_LABELS: Record<SlaState, string> = {
  suspended: "SLA not armed · unverified",
  not_armed: "SLA arms on routing",
  healthy: "On track",
  at_risk: "At risk",
  breached: "Breached",
  met: "Met",
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
    "is_verified" | "status" | "sla_armed_at" | "sla_due_at" | "resolved_at" | "closed_at"
  >,
  now: Date,
  threshold: number,
): SlaState {
  // No proof, no clock — the citizen has not verified the report yet.
  if (!row.is_verified) return "suspended";
  // Verified, but nobody has routed it, so the promise has not started.
  if (!row.sla_due_at || !row.sla_armed_at) return "not_armed";

  const due = new Date(row.sla_due_at).getTime();

  if (row.status === "resolved" || row.status === "closed") {
    // An expired report closes without ever being resolved. Falling back to
    // sla_due_at here — as the mock did — would score it as exactly on time.
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
