/**
 * The Booking module's vocabulary: what each status, reason, kind and event is
 * CALLED, plus the one derived set — the backlog — that several screens count.
 *
 * What a status lets the desk DO is not here. The five transition predicates
 * that used to sit at the bottom of this file moved into `./desk-moves.ts` at
 * #52, where they are private to the one record that answers the whole
 * question; four of the six gates need more than a status anyway. Nothing in
 * this file gates a control.
 */

import type {
  BookingCancellationReason,
  BookingDocKind,
  BookingStatus,
  PaymentKind,
  PaymentMethod,
} from "../types";

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "info";

/** The pipeline, in the order it is walked. `cancelled` is the exit, so it sits last. */
export const STATUS_ORDER: BookingStatus[] = [
  "pending",
  "awaiting_tier_review",
  "awaiting_resubmission",
  "awaiting_quote",
  "awaiting_payment",
  "payment_verification",
  "confirmed",
  "fully_paid",
  "completed",
  "cancelled",
];

/**
 * `pending` is where a discounted booking waits between submit and its
 * Organisation Document upload (l77b). Before l77b nothing ever left a row
 * there.
 *
 * The two Tier Review statuses say whose turn it is: `awaiting_tier_review` is
 * this desk's, `awaiting_resubmission` the organiser's (SCRUM-198).
 *
 * "Confirmed" rather than "Downpayment verified": from the citizen's side the
 * event is now going to happen, and the outstanding balance is a detail of it.
 */
export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  awaiting_tier_review: "Tier Review",
  awaiting_resubmission: "Awaiting Resubmission",
  awaiting_quote: "Awaiting Quote",
  awaiting_payment: "Awaiting Payment",
  payment_verification: "Payment Under Review",
  confirmed: "Confirmed",
  fully_paid: "Fully Paid",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_BADGE_VARIANT: Record<BookingStatus, BadgeVariant> = {
  pending: "default",
  // Styled as the other two waiting-on-us and waiting-on-them statuses are:
  // warning for this desk's turn, info for the organiser's.
  awaiting_tier_review: "warning",
  awaiting_resubmission: "info",
  awaiting_quote: "warning",
  awaiting_payment: "info",
  payment_verification: "warning",
  confirmed: "success",
  fully_paid: "success",
  completed: "default",
  cancelled: "destructive",
};

/**
 * Whether a booking in this status is waiting on a person in this building.
 *
 * Every status answers, rather than the yeses being listed and the rest left to
 * inference. The call is a judgement per status and `awaiting_payment` is the
 * one it is easiest to get wrong: money is outstanding, but nobody here can do
 * anything until the organiser sends it, so it is the citizen's to move.
 */
const NEEDS_STAFF_ACTION: Record<BookingStatus, boolean> = {
  /** The organiser has yet to upload the Organisation Document. */
  pending: false,
  /** Somebody must decide a Tier Claim. It holds its slot with no Hold, so
   * only this desk moves it on (ADR 0002). */
  awaiting_tier_review: true,
  /** The organiser owes a Resubmission; the Hold is running on them. */
  awaiting_resubmission: false,
  /** Somebody must set a price. */
  awaiting_quote: true,
  awaiting_payment: false,
  /** Somebody must look at a GCash account. */
  payment_verification: true,
  /** A supervisor must record the in-person balance. */
  confirmed: true,
  fully_paid: false,
  completed: false,
  cancelled: false,
};

/**
 * Needs Action: the Booking module's **backlog** — every booking currently
 * waiting on a member of staff, however long it has been there.
 *
 * Three readers, which is why it is one constant: the queue's sentinel tab
 * folds it out of the per-status counts, the activity badge's background poll
 * filters on it, and the dashboard card counts it. A booking joins this set
 * when a colleague verifies a payment across the room, so it is not an arrival
 * set — see CONTEXT.md, and the badge's noun in ./components/booking-queue.tsx.
 *
 * The three are not adjacent in the pipeline, which is exactly why the queue
 * leads with a sentinel tab rather than an ordering. Decision 3.
 *
 * Derived and `readonly` rather than written out: with three readers, a set
 * anyone can push onto is a set that can be wrong for two of them. Filtering
 * STATUS_ORDER also keeps the module to one written-down ordering, and keeps
 * the bytes of the `in.()` filter it feeds to PostgREST stable.
 */
export const NEEDS_ACTION_STATUSES: readonly BookingStatus[] =
  STATUS_ORDER.filter((status) => NEEDS_STAFF_ACTION[status]);

/**
 * How much of the queue is waiting on this office, out of the per-status
 * tallies the queue page already has. Saves the page a second read of a set it
 * has already counted, and keeps the sentinel tab and the count above it from
 * disagreeing about the same three statuses.
 *
 * Folds the set rather than adding the three fields together by hand: the sum
 * is invisible to a grep for the constant, and would go on quietly excluding
 * any status added to the set while still type-checking.
 *
 * Line-for-line the same `reduce` as Yellow Card's `awaitingReviewCount` and
 * Incidents' `awaitingTriageCount`, and deliberately not hoisted into a shared
 * `sumOver`: what this function is for is naming the set in this module's
 * vocabulary, next to the set. See ADR-0002, "Considered options".
 */
export function needsActionCount(
  counts: Record<BookingStatus, number>,
): number {
  return NEEDS_ACTION_STATUSES.reduce((sum, status) => sum + counts[status], 0);
}

/**
 * Why a booking ended. `no_show` is permanently unreachable — it applies only
 * to a cancelled booking, and decision 6 makes a confirmed booking
 * uncancellable — but it is a real enum member and is labelled rather than
 * silently dropped.
 */
export const CANCELLATION_REASON_LABELS: Record<
  BookingCancellationReason,
  string
> = {
  rejected_by_staff: "Rejected by staff",
  cancelled_by_citizen: "Cancelled by the organiser",
  expired_unpaid: "Expired — unpaid",
  expired_unrevised: "Expired — Revision Request unanswered",
  no_show: "No show",
};

/**
 * Every value a function body writes today, plus `completed` from l54.
 *
 * Deliberately an OPEN Record<string, string>, unlike the incidents module's
 * exhaustive map. `booking_events.event_type` is `text` with no check
 * constraint and no enum, so this list is only as good as the last prosrc grep
 * and a new RPC can introduce a value without touching this repo.
 */
export const EVENT_LABELS: Record<string, string> = {
  submitted: "Submitted",
  tier_claim_submitted: "Tier Claim submitted",
  tier_claim_resubmitted: "Resubmission received",
  tier_claim_given_up: "Tier Claim given up",
  revision_requested: "Revision Request issued",
  quoted: "Quoted",
  payment_submitted: "Payment submitted",
  document_verified: "Document accepted",
  document_rejected: "Document rejected",
  repriced: "Repriced",
  payment_verified: "Payment verified",
  payment_rejected: "Payment rejected",
  balance_settled: "Balance settled",
  cancelled: "Cancelled",
  completed: "Completed",
};

/**
 * `refund` will never appear in the ledger — decision 7 leaves it unwritten,
 * and reject_booking's notification tells the citizen money is not returned
 * through this system. It is a real enum member, so it is labelled rather than
 * silently rendered blank.
 */
export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  downpayment: "Downpayment",
  balance: "Balance",
  refund: "Refund",
};

/**
 * `gcash` is the downpayment channel. record_balance_payment REFUSES gcash for
 * a balance — decision 6's "the balance is settled in person", said in the
 * schema rather than only in prose.
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  gcash: "GCash",
  cash: "Cash",
  bank_transfer: "Bank transfer",
  check: "Check",
};

export const DOC_KIND_LABELS: Record<BookingDocKind, string> = {
  org_document: "Organisation document",
  gcash_receipt: "GCash receipt",
};

/** Falls back to a humanised form of the raw value rather than a blank cell. */
export function labelForEvent(eventType: string): string {
  const known = EVENT_LABELS[eventType];
  if (known) return known;
  const words = eventType.replace(/_/g, " ").trim();
  if (!words) return "Unknown event";
  return words.charAt(0).toUpperCase() + words.slice(1);
}
