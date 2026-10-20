import { Badge } from "@/portals/staff/components/ui/badge";
import { deriveSlaState, SLA_STATE_LABELS, SLA_STATE_VARIANT } from "../lib/sla";
import type { IncidentQueueItem } from "../types";

/**
 * `now` and `threshold` are props, not module state. One clock is created per
 * page render and passed down, so every row on a page agrees what time it is —
 * and a test can render any moment it likes without mocking a timer.
 */
export function SlaIndicator({
  incident,
  now,
  threshold,
}: {
  incident: Pick<
    IncidentQueueItem,
    "is_verified" | "status" | "sla_armed_at" | "sla_due_at" | "resolved_at" | "closed_at"
  >;
  now: Date;
  threshold: number;
}) {
  const state = deriveSlaState(incident, now, threshold);
  return <Badge variant={SLA_STATE_VARIANT[state]}>{SLA_STATE_LABELS[state]}</Badge>;
}
