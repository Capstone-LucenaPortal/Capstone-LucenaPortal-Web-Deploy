import type { YellowCardStatus } from "../types";

/**
 * Fails the annotation below when the tuple misses a status, with an error that
 * names the one left out. Still an array in that branch on purpose, so a
 * missing status is one error rather than a page of fallout from every reader
 * of STATUS_ORDER.
 */
type CoversEveryStatus<T extends readonly YellowCardStatus[]> = [
  Exclude<YellowCardStatus, T[number]>,
] extends [never]
  ? readonly YellowCardStatus[]
  : ReadonlyArray<YellowCardStatus> & {
      readonly __statusWithNoQueuePosition: Exclude<YellowCardStatus, T[number]>;
    };

const QUEUE_ORDER = [
  "pending",
  "resubmitted",
  "revision_requested",
  "approved",
  "rejected",
  "withdrawn",
] as const;

/**
 * Queue order: work to do first, outcomes after, withdrawn last. This is the
 * left-to-right order of the queue's stat tiles and tabs.
 *
 * Written out as a tuple rather than derived from the key order of a Record,
 * because staff see this order. It should be legible as an ordering and
 * reviewable as one, not an emergent property of how a Record literal happens
 * to be laid out. CoversEveryStatus is what keeps the written-out tuple honest.
 */
export const STATUS_ORDER: CoversEveryStatus<typeof QUEUE_ORDER> = QUEUE_ORDER;

export const STATUS_LABELS: Record<YellowCardStatus, string> = {
  pending: "Pending Review",
  resubmitted: "Resubmitted",
  revision_requested: "Revision Requested",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const STATUS_BADGE_VARIANT: Record<
  YellowCardStatus,
  "default" | "info" | "warning" | "success" | "destructive"
> = {
  pending: "default",
  resubmitted: "info",
  revision_requested: "warning",
  approved: "success",
  rejected: "destructive",
  // Withdrawn is the citizen's own doing, not a refusal — grey, not red.
  withdrawn: "default",
};

/**
 * Which statuses review_yellow_card_application accepts. Anything else raises
 * 22023, so rendering a decision button for another status ships a guaranteed
 * error — which is why every status has to answer here, rather than the yeses
 * being listed and the rest left to inference.
 */
const AWAITS_REVIEW: Record<YellowCardStatus, boolean> = {
  pending: true,
  resubmitted: true,
  // Waiting on the citizen, not on staff. Comes back as `resubmitted` when
  // they act, and that is the point at which it becomes staff's again.
  revision_requested: false,
  approved: false,
  rejected: false,
  withdrawn: false,
};

/**
 * The awaiting-review set, in queue order.
 *
 * The dashboard card's figure, the background poll and the queue's activity
 * badge call this set **awaiting review** — a claim about staff workload rather
 * than about what the RPC will accept. The two names could legitimately come
 * apart one day; until they do, all three read the set from here, so this is
 * the line a search for either phrase should land on. What is *in* the set is
 * decided one status at a time, in AWAITS_REVIEW above.
 *
 * Filtering STATUS_ORDER rather than reading the Record's keys keeps the module
 * to a single written-down ordering. It is also what makes the `in.()` filter
 * this feeds to PostgREST stable: the bytes change only when a reviewer moves a
 * tab, never when someone tidies the Record above.
 */
export const REVIEWABLE_STATUSES: readonly YellowCardStatus[] =
  STATUS_ORDER.filter((status) => AWAITS_REVIEW[status]);

export function isReviewable(status: YellowCardStatus): boolean {
  return AWAITS_REVIEW[status];
}

/**
 * How much of the queue is awaiting review, out of the per-status tallies the
 * queue already has.
 *
 * Folds the set rather than adding pending and resubmitted together: the sum
 * is invisible to a grep for the constant, and would go on quietly excluding
 * any status added to the set while still type-checking.
 */
export function awaitingReviewCount(
  counts: Record<YellowCardStatus, number>,
): number {
  return REVIEWABLE_STATUSES.reduce((sum, status) => sum + counts[status], 0);
}
