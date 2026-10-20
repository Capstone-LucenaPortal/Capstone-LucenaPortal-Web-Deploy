import { Badge } from "@/portals/staff/components/ui/badge";
import {
  DEADLINE_STATE_LABELS,
  DEADLINE_STATE_VARIANT,
  formatDeadline,
  type DeadlineState,
} from "../lib/deadline";

/**
 * The state the database computed, with the deadline it is measured against
 * underneath — "urgent" alone does not tell a reviewer by when. Renders
 * nothing when the clock is not running.
 */
export function DeadlineBadge({
  state,
  dueAt,
}: {
  state: DeadlineState | null;
  dueAt: string | null;
}) {
  if (!state) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={DEADLINE_STATE_VARIANT[state]}>{DEADLINE_STATE_LABELS[state]}</Badge>
      {dueAt && <p className="text-xs text-gray-500">Due {formatDeadline(dueAt)}</p>}
    </div>
  );
}
