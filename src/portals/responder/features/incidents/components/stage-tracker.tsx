import { advanceStageAction } from "@/portals/responder/features/incidents/actions";
import {
  furthestStage,
  STAGE_LABEL,
  STAGE_ORDER,
} from "@/portals/responder/features/incidents/lib/work";
import type { IncidentEvent } from "@/portals/responder/features/incidents/types";
import { cn } from "@/portals/responder/lib/utils";

/**
 * Three quick taps, monotonic (PRD §4.3). Tapping ahead jumps straight there —
 * forgiving of arriving on site before you remembered to tap "en route" —
 * while everything at or behind you is inert, so the timeline staff watch can
 * never contradict itself.
 *
 * Each button is its own form post rather than a click handler: a tap lands on
 * the shared incident_events table that staff watch, and nothing here should
 * feel like local state.
 *
 * Monotonicity is `trg_stage_monotonic` now, not this component. The disabled
 * state is the courtesy in front of the trigger — a tap that gets through
 * anyway raises, and notice.ts maps it to `stage_backwards`.
 */
export function StageTracker({
  events,
  incidentId,
}: {
  events: IncidentEvent[];
  incidentId: string;
}) {
  const current = furthestStage(events);

  return (
    <ol className="flex gap-2">
      {STAGE_ORDER.map((stage, index) => {
        const reached = index <= current;
        const isCurrent = index === current;

        return (
          <li key={stage} className="flex-1">
            <form action={advanceStageAction}>
              <input type="hidden" name="incidentId" value={incidentId} />
              <input type="hidden" name="stage" value={stage} />
              <button
                type="submit"
                disabled={reached}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex h-15.5 w-full flex-col items-center justify-center gap-1 rounded-lg border-[1.5px] text-[12.5px] font-semibold",
                  isCurrent
                    ? "border-lucena-blue bg-lucena-blue text-white"
                    : reached
                      ? "border-blue-100 bg-blue-50 text-blue-800"
                      : "border-gray-200 bg-white text-gray-500",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                    isCurrent
                      ? "bg-white/25 text-white"
                      : reached
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-600",
                  )}
                >
                  {index + 1}
                </span>
                {STAGE_LABEL[stage]}
              </button>
            </form>
          </li>
        );
      })}
    </ol>
  );
}
