"use client";

import { useCallback, useState } from "react";
import type { TimelineItem } from "@/portals/super-staff/components/ui/history-timeline";
import { listAuditEntriesForTarget } from "../lib/queries";
import { toTimelineItems } from "../lib/timeline";

/**
 * The edit history for one record, as the three content editors show it.
 *
 * All three carried this identically: the same state, the same fetch, the same
 * mapping. Only this much is shared — the rest of those editors (loading a
 * record, validating it, saving it) diverges enough that a common hook would
 * need a flag for every difference, which is worse than the repetition.
 *
 * `refresh` is deliberately caller-driven rather than an effect on an id: the
 * editors call it after a save as well as after a load, and a save does not
 * change the id it would key on.
 */
export function useAuditHistory(): {
  history: TimelineItem[];
  refresh: (targetId: string) => Promise<void>;
} {
  const [history, setHistory] = useState<TimelineItem[]>([]);

  const refresh = useCallback(async (targetId: string) => {
    setHistory(toTimelineItems(await listAuditEntriesForTarget(targetId)));
  }, []);

  return { history, refresh };
}
