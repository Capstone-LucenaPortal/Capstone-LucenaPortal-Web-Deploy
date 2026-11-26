import { PRIORITIES, isLive, type IssuePriority, type SystemIssue } from "../types";

export type QueueTab = "attention" | "resolved" | "closed" | "all";

// All comes first (PO, 2026-11-26); the queue still opens on Needs attention.
export const TABS: { key: QueueTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

/** Needs attention is Open and In progress: the issues Super-staff can still change. */
export function inTab(issue: SystemIssue, tab: QueueTab): boolean {
  switch (tab) {
    case "attention":
      return isLive(issue);
    case "all":
      return true;
    default:
      return issue.status === tab;
  }
}

/** Not prioritised ranks 0, ahead of High (1). */
const rank = (p: IssuePriority | null) => (p === null ? 0 : PRIORITIES.indexOf(p) + 1);

/**
 * The triage rule: not yet prioritised first (it needs a look before anything
 * else), then High → Medium → Low, oldest first within each.
 */
export function triageOrder(a: SystemIssue, b: SystemIssue): number {
  return rank(a.priority) - rank(b.priority) || Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

export function queue(issues: SystemIssue[], tab: QueueTab): SystemIssue[] {
  return issues.filter((i) => inTab(i, tab)).sort(triageOrder);
}
