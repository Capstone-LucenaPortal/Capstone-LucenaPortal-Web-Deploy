// Domain types for the executive dashboard slice.

export interface ExecutiveRangeStats {
  citizensEngaged: number;
  citizensDelta: string;
  serviceBacklog: number;
  backlogDelta: string;
  // null when there are zero SLA-scoreable requests (decided applications +
  // resolved/scoreable incidents) pooled across both clocks in range — e.g. a
  // quiet "Today" preset. Render via formatRate (src/portals/admin/lib/aggregate.ts),
  // never `${value}%`, so this can never misread as "0% compliance". slaNote
  // is a plain "no scoreable requests" caption in that case, not a pts-below-
  // target gap computed against a null baseline.
  slaCompliancePct: number | null;
  slaNote: string;
  lccUtilizationPct: number;
  lccDelta: string;
}

export interface AttentionItem {
  icon: "alert" | "trend" | "clock" | "info";
  tone: "red" | "amber" | "yellow" | "blue";
  title: string;
  detail: string;
  href: string;
}
