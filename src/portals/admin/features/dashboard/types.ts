// Domain types for the executive dashboard slice.

import type { Delta, EventDays } from "@/portals/admin/lib/aggregate";
import type { ServiceCompliance } from "@/portals/admin/features/sla/types";

// One service's SLA compliance in range, plus its change against the
// previous period (higher is better).
export interface ServiceSla extends ServiceCompliance {
  delta: Delta;
}

export interface ExecutiveRangeStats {
  requestsFiled: number;
  requestsFiledDelta: Delta;
  serviceBacklog: number;
  backlogDelta: Delta;
  // SLA compliance once per service, never pooled: the three clocks make
  // different promises (ADR 0001).
  sla: { yellowCard: ServiceSla; incidents: ServiceSla; bookings: ServiceSla };
  // Days with an event: the same figure as the Convention Center's Event
  // days tile (#117).
  eventDays: EventDays;
}

export interface AttentionItem {
  icon: "alert" | "trend" | "clock" | "info";
  tone: "red" | "amber" | "yellow" | "blue";
  title: string;
  detail: string;
  href: string;
}
