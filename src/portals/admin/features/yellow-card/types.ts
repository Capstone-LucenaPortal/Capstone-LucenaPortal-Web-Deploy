// Domain types for the Yellow Card slice.

import type { Delta } from "@/portals/admin/lib/aggregate";

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
  applicationsDelta: Delta;
  // null when there are zero DECIDED (approved + rejected) applications in
  // range — not the same as zero applications: a range full of still-pending
  // rows also has no rate to report yet. Render via formatRate (lib/aggregate.ts)
  // aggregate.ts), never `${value}%`, so an empty denominator can never read
  // as an alarming "0% approval rate". approvalRateDelta is likewise a plain
  // "no comparable data" caption whenever either side is null.
  approvalRatePct: number | null;
  approvalRateDelta: Delta;
  barangaysReached: number;
  // Both null when public_barangays could not be read — "unknown", not
  // "zero barangays exist". See yellowCardRangeStats in src/portals/admin/lib/aggregate.ts.
  barangaysTotal: number | null;
  barangaysWithZero: number | null;
  pendingReview: number;
  // Of pendingReview, those whose deadline_state is overdue and at_risk: the
  // Staff queue's own state (l80, l112). See yellowCardRangeStats.
  pendingPastDue: number;
  pendingAtRisk: number;
}
