import { Badge } from "@/portals/staff/components/ui/badge";
import { deriveSlaState, SLA_STATE_LABELS, SLA_STATE_VARIANT } from "../lib/sla";

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
  incident: Parameters<typeof deriveSlaState>[0];
  now: Date;
  threshold: number;
}) {
  const state = deriveSlaState(incident, now, threshold);
  return <Badge variant={SLA_STATE_VARIANT[state]}>{SLA_STATE_LABELS[state]}</Badge>;
}
