import { MANILA_TIME_ZONE } from "@/shared/dates/manila";
import type { StaffUser } from "@/portals/staff/features/auth/types";
import type {
  Booking,
  BookingDocument,
  BookingPayment,
  BookingStatus,
} from "../types";

/**
 * Why the balance gate is not a boolean, and the trap it exists to avoid.
 *
 * `record_balance_payment` is supervisor-gated, and that guard used to be
 * applied one level BELOW the gate: the settleable check was true for everyone
 * looking at a confirmed booking, and the route then chose between the control
 * and a sentence explaining who may use it. Folding the guard in as a plain
 * boolean loses that sentence silently — a clerk on a confirmed booking with
 * nothing else open would have no open gate, so no Actions card, so nowhere
 * for the explanation to live, and nothing on screen would say the balance is
 * anybody's to record.
 *
 * So the gate reports three states rather than two, and `anyOpen` counts
 * `blocked` as open. See ADR-0007.
 */
export type BalanceMove =
  /** Not a move on this booking at all — wrong status, or no quoted balance. */
  | { kind: "none" }
  /** Open, with the figure `record_balance_payment` will demand. */
  | { kind: "open"; amount: number }
  /**
   * A real move on this booking, but not for this viewer. The reason is
   * machine-readable and the sentence shown on screen stays in the route,
   * exactly as ADR-0003 kept the em dash and ADR-0006 "awaiting a quote".
   */
  | { kind: "blocked"; reason: "supervisor_only" };

/**
 * Whether one undecided downpayment can be ACCEPTED. Rejecting it is never
 * held.
 *
 * Two-valued rather than a boolean for the reason `BalanceMove` is three-valued:
 * the control still renders, and the operator is owed a sentence saying why
 * its accept is shut — the component's, not this module's.
 */
export type PaymentAccept =
  | { kind: "open" }
  | { kind: "blocked"; reason: PaymentHold };

/**
 * Why an accept is held. `amount_stale`: the payment is not for the booking's
 * current downpayment — it was repriced after the citizen paid (l71).
 *
 * There is no `discount_undecided` any more. Since l77b (SCRUM-198) a
 * discounted booking reaches awaiting_payment only once its Tier Claim is
 * decided, so payment verification never meets an undecided one.
 * verify_payment keeps refusing that case as a safety net that should be
 * unreachable; this desk does not model it.
 */
export type PaymentHold = "amount_stale";

/** The facts the Tier Review control renders beside its gate. */
export interface TierReview {
  /** Whether a current organisation document is on file to look at. */
  hasOrgDocument: boolean;
  /**
   * What the control offers beside Accept. The first look issues a Revision
   * Request (`revise`); the second, after a Resubmission, may `reject`. The
   * look is the server's (`tier_review_look`), never worked out here.
   */
  decline: "revise" | "reject";
}

/** One undecided downpayment, with what this desk may do about it. */
export interface PaymentDecision {
  payment: BookingPayment;
  accept: PaymentAccept;
}

/**
 * What this desk can do with one booking right now — one member per write the
 * Booking module offers, named for the move rather than for the RPC:
 *
 * | member              | write                    |
 * | ------------------- | ------------------------ |
 * | `quoting`           | `quote_booking`          |
 * | `reviewingDocument` | `review_booking`         |
 * | `verifyingPayment`  | `verify_payment`         |
 * | `recordingBalance`  | `record_balance_payment` |
 * | `rejecting`         | `reject_booking`         |
 * | `completing`        | `complete_booking`       |
 *
 * The gerunds are not decoration. `reviewDocument`, `verifyPayment` and four
 * more are character-for-character the names of the server actions exported
 * from `./actions.ts` — a Next.js convention that cannot move — and a record
 * whose members read as those functions invites the reader to think the gate
 * and the call are the same thing.
 *
 * **A gate that carries nothing is a boolean; a gate that carries something is
 * that something, absent when the gate is shut.** The facts each control needs
 * are derived here and travel with the gate that guarantees them, which is what
 * lets the route render the balance control without asserting that the amount
 * is non-null ninety lines away from the check that makes it safe.
 */
export interface DeskMoves {
  quoting: boolean;
  /**
   * Open exactly in awaiting_tier_review, the one status review_booking
   * accepts since l77b. Carries whether a current organisation document exists
   * and which decline this look offers — Revision Request or reject.
   */
  reviewingDocument: TierReview | null;
  /**
   * The downpayments waiting on a decision, one control each: `verify_payment`
   * takes a payment id and a booking can carry more than one attempt. Empty
   * exactly when the gate is shut. Each carries whether it can be accepted.
   */
  verifyingPayment: PaymentDecision[];
  recordingBalance: BalanceMove;
  rejecting: boolean;
  completing: boolean;
  /**
   * Whether the Actions card has anything to hold. Counts a `blocked` balance
   * as open — see `BalanceMove`, which is the whole reason this is not a fold
   * over six booleans.
   */
  anyOpen: boolean;
}

export interface DeskMovesInput {
  booking: Booking;
  /** The ledger. `verify_payment`'s candidates are picked out of it. */
  payments: BookingPayment[];
  /** Every document, superseded ones included — the current-document rule is here. */
  documents: BookingDocument[];
  /**
   * Who is looking. ADR-0003 holds this out of the DOSSIER, whose job is what
   * is being looked at; a gate table's job is exactly the other thing, and one
   * of `record_balance_payment`'s two guards is the viewer. No I/O crosses the
   * boundary — the user is handed in, never read here, so this stays pure.
   */
  user: StaffUser;
  /** The render-top's one moment, per ADR-0005. This module makes no clock. */
  now: Date;
}

/**
 * Answers "what can this desk do with this booking right now", so the detail
 * route renders a shape instead of assembling six gates out of five predicates
 * and twelve lines of its own rules.
 *
 * Pure, and takes one object argument: every caller has a whole booking, and a
 * narrowed field bag is the thing that goes stale the first time a gate wants a
 * field nobody thought to pass.
 *
 * The six predicates below are private and stay private. Exporting them would
 * leave the module's interface exactly as wide as it found it, which is the
 * half-measure ADR-0003 recorded and #24 exists to have avoided.
 *
 * What is NOT here: the office's booking config. The quote form's defaults stay
 * route-assembled, because pulling the config in would give it a second owner —
 * the refusal ADR-0006 made and this record does not reopen.
 */
export function deskMoves({
  booking,
  payments,
  documents,
  user,
  now,
}: DeskMovesInput): DeskMoves {
  const quoting = isQuotable(booking.status);

  const undecided = undecidedDownpayments(payments);

  const reviewingDocument: TierReview | null = isReviewable(booking.status)
    ? {
        hasOrgDocument: hasCurrentOrgDocument(documents),
        // A missing look falls back to the Revision Request: the RPC refuses
        // the wrong one anyway, and a correction costs the citizen nothing.
        decline: booking.tier_review_look === 2 ? "reject" : "revise",
      }
    : null;

  // The one gate with no named predicate beside it, because there is no status
  // rule to name: verify_payment's guard is the ledger, and the status only
  // says the office has been asked to look. Five predicates, six gates.
  const verifyingPayment =
    booking.status === "payment_verification"
      ? undecided.map((payment) => ({
          payment,
          accept: paymentAccept(booking, payment),
        }))
      : [];

  const recordingBalance = balanceMove(booking, user);

  const rejecting = isRejectable(booking.status);
  const completing = isCompletable(booking.status, booking.event_date, now);

  return {
    quoting,
    reviewingDocument,
    verifyingPayment,
    recordingBalance,
    rejecting,
    completing,
    anyOpen:
      quoting ||
      reviewingDocument !== null ||
      verifyingPayment.length > 0 ||
      recordingBalance.kind !== "none" ||
      rejecting ||
      completing,
  };
}

/**
 * `record_balance_payment`'s two guards, in the order the RPC applies them: the
 * booking has to be settleable at all before who is asking matters.
 *
 * The quoted balance is the second half of "settleable" rather than a fact
 * beside it — a confirmed booking with no `balance_amount` has nothing for the
 * control to record, so the gate is shut rather than blocked, and no sentence
 * about supervisors is owed to anyone.
 */
function balanceMove(booking: Booking, user: StaffUser): BalanceMove {
  if (!isBalanceSettleable(booking.status) || booking.balance_amount === null) {
    return { kind: "none" };
  }
  if (!user.is_supervisor) {
    return { kind: "blocked", reason: "supervisor_only" };
  }
  return { kind: "open", amount: booking.balance_amount };
}

/** `verify_payment(accept)`'s stale-amount refusal (l71). */
function paymentAccept(booking: Booking, payment: BookingPayment): PaymentAccept {
  if (payment.amount !== booking.downpayment_amount) {
    return { kind: "blocked", reason: "amount_stale" };
  }
  return { kind: "open" };
}

/**
 * Undecided: NEITHER verified nor rejected. A bounced receipt is waiting on the
 * citizen to supersede it, not on anybody in this building.
 *
 * Balance payments are not candidates. `verify_payment` is the GCash
 * downpayment's control; a balance is recorded in person by a supervisor and
 * arrives already decided.
 */
function undecidedDownpayments(payments: BookingPayment[]): BookingPayment[] {
  return payments.filter(
    (p) => p.kind === "downpayment" && !p.verified_at && !p.rejected_reason,
  );
}

/**
 * Superseded documents do not count. `readDocuments` deliberately returns them
 * — a superseded document is history the reviewer wants to see — so the "has
 * the citizen given us anything to look at" question has to say `superseded_by`
 * out loud rather than trusting the list to be current.
 */
function hasCurrentOrgDocument(documents: BookingDocument[]): boolean {
  return documents.some((d) => d.kind === "org_document" && !d.superseded_by);
}

/** quote_booking accepts exactly this status. */
function isQuotable(status: BookingStatus): boolean {
  return status === "awaiting_quote";
}

/**
 * review_booking accepts exactly this status (l77b, SCRUM-198). Before it the
 * document is not confirmed and there is nothing to review; after it the price
 * is decided and must not change under a payment. Only a discounted booking
 * can be here — a CHECK on bookings says so — so the tier is not asked.
 */
function isReviewable(status: BookingStatus): boolean {
  return status === "awaiting_tier_review";
}

/**
 * Where the line falls. Decision 6: the downpayment is a slot reservation fee,
 * and the moment a staff member confirms they have seen it in the GCash account
 * the event is committed and neither side can end it. A booking still under
 * review is still droppable — verify_payment(reject) only bounces the receipt
 * back and restarts the clock, so it cannot end a booking that must not go
 * ahead for reasons unrelated to the receipt.
 *
 * The three statuses before a Tier Claim is decided are droppable too (l77b):
 * that is how staff deal with obvious abuse, since an undecided claim
 * otherwise holds its slot indefinitely.
 */
function isRejectable(status: BookingStatus): boolean {
  return (
    status === "pending" ||
    status === "awaiting_tier_review" ||
    status === "awaiting_resubmission" ||
    status === "awaiting_quote" ||
    status === "awaiting_payment" ||
    status === "payment_verification"
  );
}

/** record_balance_payment accepts exactly this status. It is also supervisor-gated. */
function isBalanceSettleable(status: BookingStatus): boolean {
  return status === "confirmed";
}

/**
 * complete_booking needs a fully-paid booking whose event is over. "Over" is
 * the Manila calendar day, matching the RPC — an event happening today has not
 * finished yet, and completing it early would close the record on a night that
 * has not happened.
 */
function isCompletable(
  status: BookingStatus,
  eventDate: string,
  now: Date,
): boolean {
  if (status !== "fully_paid") return false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
  }).format(now);
  return eventDate < today;
}
