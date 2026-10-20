import { AUDIT_AREAS } from "./area";
import type { AuditArea, AuditEntry } from "../types";

export type AreaCounts = Record<AuditArea, number> & { all: number };

/** Per-area counts for the audit-log filter tabs, plus the total. */
export function computeAreaCounts(entries: AuditEntry[]): AreaCounts {
  const counts = Object.fromEntries(AUDIT_AREAS.map((a) => [a, 0])) as Record<
    AuditArea,
    number
  >;
  for (const e of entries) {
    if (e.area in counts) counts[e.area] += 1;
  }
  return { ...counts, all: entries.length };
}
