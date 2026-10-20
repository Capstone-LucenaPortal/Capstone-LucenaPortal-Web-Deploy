// Domain types for the issue-report slice.

export type IssueDateBasis = "report" | "resolution";

export interface IssueRangeStats {
  reports: number;
  reportsDelta: string;
  // null when there are zero incidents in range at all — there is no
  // resolution rate to compute. A range with incidents but none yet resolved
  // still gets a real 0%, which is honest; only the empty-denominator case is
  // null. Render via formatRate (src/portals/admin/lib/aggregate.ts), never `${value}%`.
  resolutionRatePct: number | null;
  resolutionRateDelta: string;
  avgResponseDays: number;
  avgResponseDelta: string;
  openBacklog: number;
  // Always null (Admin Portal Fix Plan, Task 1.3) — not merely when
  // public_incident_config could not be read. Computing this from
  // `submitted_at` age vs. today's config target counts never-armed
  // (unverified) incidents as breached, charges routing/verification delay
  // against the department, and re-judges old incidents against a target
  // that may have since changed, none of which is honest. It stays
  // unavailable until a Phase 6 migration adds `sla_due_at`/`sla_armed_at`/
  // `is_verified` to admin_incident_analytics. See the doc comment above
  // backlogPastSla's assignment in issueRangeStats (src/portals/admin/lib/aggregate.ts)
  // for the full explanation, and incidentMet's "KNOWN LIMITATION" comment
  // in src/portals/admin/features/sla/lib/sla.ts for the same gap as it affects Task 1.2.
  backlogPastSla: number | null;
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
