// Domain types for the Yellow Card slice.

// src/portals/admin/lib/types.ts
export interface BarangayCoverage {
  barangay: string;
  approved: number;
  pending: number;
  rejected: number;
}

export type YellowCardDateBasis = "application" | "completion";

export interface YellowCardRangeStats {
  applications: number;
  applicationsDelta: string;
  // null when there are zero DECIDED (approved + rejected) applications in
  // range — not the same as zero applications: a range full of still-pending
  // rows also has no rate to report yet. Render via formatRate (lib/aggregate.ts)
  // aggregate.ts), never `${value}%`, so an empty denominator can never read
  // as an alarming "0% approval rate". approvalRateDelta is likewise a plain
  // "no comparable data" caption whenever either side is null.
  approvalRatePct: number | null;
  approvalRateDelta: string;
  barangaysReached: number;
  // Both null when public_barangays could not be read — "unknown", not
  // "zero barangays exist". See yellowCardRangeStats in src/portals/admin/lib/aggregate.ts.
  barangaysTotal: number | null;
  barangaysWithZero: number | null;
  pendingReview: number;
  // null means "unavailable", not "zero". admin_yellow_card_analytics.sla_breached
  // is only meaningful for DECIDED (terminal-status) applications — see
  // applicationMet's doc comment in src/portals/admin/features/sla/lib/sla.ts — because the counter
  // behind it only accrues on status change, so a pending row's sla_breached
  // stays false no matter how overdue it really is. There is no due_at/
  // armed-clock column yet to compute a real count from, so
  // yellowCardRangeStats always returns null here rather than a number that
  // structurally always reads too low. Revisit once Phase 6 lands a real due
  // date for pending applications.
  pendingPastSla: number | null;
  // The SLA target the pending applications carry (from each row's own
  // sla_target_hours), or null when they do not all share one. Never a
  // hardcoded figure — see sharedSlaTargetHours in src/portals/admin/lib/aggregate.ts.
  pendingSlaTargetHours: number | null;
}
