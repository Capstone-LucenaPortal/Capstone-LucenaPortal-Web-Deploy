// Domain types for the issue-report slice.

import type { Delta } from "@/portals/admin/lib/aggregate";

export type IssueDateBasis = "report" | "resolution";

export interface IssueRangeStats {
  reports: number;
  reportsDelta: Delta;
  // Resolved ÷ reports in range, leaving out those closed as invalid,
  // duplicate or expired (metrics sheet I2). null when nothing is left to
  // divide by. A range with real reports but none yet resolved still gets a
  // real 0%, which is honest; only the empty-denominator case is null.
  // Render via formatRate (src/portals/admin/lib/aggregate.ts), never `${value}%`.
  resolutionRatePct: number | null;
  resolutionRateDelta: Delta;
  // Of the Resolution Rate's denominator, the reports not yet resolved.
  resolutionStillOpen: number;
  // Unrounded mean days from filing to resolution, across all levels: the
  // Admin glossary's "Time to resolve", not the clock. null when no incident
  // in range has resolved. Render via formatDuration
  // (src/portals/admin/lib/aggregate.ts), never `${value}d`.
  avgTimeToResolveDays: number | null;
  avgTimeToResolveDelta: Delta;
  // Unrounded mean days from filing to routing, over reports routed and never
  // reopened: the wait before the clock starts (metrics sheet I10). null when
  // none qualify. Render via formatDuration, like avgTimeToResolveDays.
  avgTimeToTriageDays: number | null;
  avgTimeToTriageDelta: Delta;
  openBacklog: number;
  // Of openBacklog, those past their own due time, and those the view flags
  // at risk (l112). A report with no due time is neither. See issueRangeStats.
  backlogPastDue: number;
  backlogAtRisk: number;
}

export interface IssueCategorySlice {
  category: string;
  count: number;
}

export interface BarangayIssueRow {
  barangay: string;
  reports: number;
  topCategory: string;
  topCategoryCount: number;
}
