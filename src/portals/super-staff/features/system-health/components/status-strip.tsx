import { cn } from "@/portals/super-staff/lib/utils";
import { formatManilaHourMinute } from "../lib/format";
import type { HealthSample, HealthStatus, SnapshotSectionKey } from "../types";
import { Panel, STATUS_WORD, TONE_STYLE } from "./panel";

const ORDER: HealthStatus[] = ["ok", "warning", "critical"];

/** "1 OK, 1 Warning, 1 not sampled": the strip in words, for a screen reader. */
function stripSummary(statuses: Array<HealthStatus | null>): string {
  const parts = ORDER.flatMap((s) => {
    const n = statuses.filter((x) => x === s).length;
    return n > 0 ? [`${n} ${STATUS_WORD[s]}`] : [];
  });
  const unsampled = statuses.filter((x) => x === null).length;
  if (unsampled > 0) parts.push(`${unsampled} not sampled`);
  return parts.join(", ");
}

/**
 * One section's status over the last 24 h, one cell per 5-minute sample, from
 * that section's own sample column. A sample taken before the sections were
 * sampled (l92) has no status for it, and reads "not sampled".
 */
export function StatusStrip({
  section,
  label,
  samples,
}: {
  section: SnapshotSectionKey;
  label: string;
  samples: HealthSample[];
}) {
  const statuses = samples.map((s) => s.sections[section]);
  return (
    <Panel title="Status, last 24 h">
      {samples.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-gray-500">
          No samples in the last 24 h yet. One is taken every 5 minutes.
        </p>
      ) : (
        <div className="px-5 pb-4">
          <div
            role="img"
            aria-label={`${label}, last 24 h: ${stripSummary(statuses)}`}
            className="flex h-5 gap-px overflow-hidden rounded"
          >
            {samples.map((s, i) => (
              <div
                key={s.sampledAt}
                className={cn("flex-1", TONE_STYLE[statuses[i] ?? "muted"].fill)}
                title={`${formatManilaHourMinute(s.sampledAt)} (Asia/Manila): ${
                  statuses[i] === null ? "not sampled" : STATUS_WORD[statuses[i]]
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">One cell per 5-minute sample, oldest first.</p>
        </div>
      )}
    </Panel>
  );
}
