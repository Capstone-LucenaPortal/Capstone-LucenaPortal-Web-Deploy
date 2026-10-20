"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/supabase/server";
import {
  toActionFailure,
  type ActionResult,
  type ErrorMessages,
} from "@/portals/staff/lib/supabase/errors";
import type { Database } from "@/shared/supabase/types";
import { readNeedsActionCount } from "./queries";
import {
  writePaymentVerification,
  type PaymentVerificationInput,
} from "./payment-verification";
import type { PaymentMethod, TierReviewDecision } from "../types";

/**
 * The six writes.
 *
 * Every one calls an RPC and does nothing else. Each RPC is SECURITY DEFINER,
 * takes `for update` on the booking row first, and writes its own event and
 * notification — none of which is reimplemented here. verifyPayment's rule has
 * moved to ./payment-verification.ts, behind a required client, so it can be
 * tested; see docs/adr/0001-supabase-recording-fetch-seam.md.
 *
 * The generated Args aliases below keep each argument object honest, and
 * .rpc() checks the object against the function's signature again at the call.
 */

type QuoteArgs = Database["public"]["Functions"]["quote_booking"]["Args"];
type ReviewArgs = Database["public"]["Functions"]["review_booking"]["Args"];
type BalanceArgs =
  Database["public"]["Functions"]["record_balance_payment"]["Args"];
type RejectArgs = Database["public"]["Functions"]["reject_booking"]["Args"];
type CompleteArgs = Database["public"]["Functions"]["complete_booking"]["Args"];

/**
 * How many bookings are waiting on this office right now.
 *
 * Polled by the queue's activity bar to decide whether the backlog has grown
 * since the page rendered. A shell: it builds the real client, hands it to
 * ./queries.ts and adds nothing of its own — no parameter included, so this
 * endpoint reads exactly one set and cannot be told to read another by an
 * argument arriving over the wire. Returns null rather than throwing on
 * failure; see readNeedsActionCount for why.
 */
export async function countNeedsAction(): Promise<number | null> {
  return readNeedsActionCount(await createClient());
}

/** Both the queue and this booking's page, plus the dashboard card. */
function revalidateBooking(bookingId: string) {
  revalidatePath(`/staff/booking/${bookingId}`);
  revalidatePath("/staff/booking");
  revalidatePath("/staff/dashboard");
}

const QUOTE_MESSAGES: ErrorMessages = {
  forbidden:
    "You do not have permission to quote bookings. Ask an administrator to check your module assignment.",
  conflict:
    "This booking is no longer awaiting a quote — someone may have priced it already. The page has been refreshed.",
  missing: "This booking no longer exists. The page has been refreshed.",
  misconfigured:
    "No rate is configured for this venue and tier, so the booking cannot be priced. Ask an administrator to check the rate card.",
  fallback: "The quote could not be saved. Please try again.",
};

/**
 * Sets the fee, splits it through booking_money, and RESTARTS the payment
 * window at now() + payment_window_hours. The screen says so because it is
 * true.
 *
 * The RPC validates `p_total_fee > 0`, so that rule is not duplicated here —
 * but a non-finite number is rejected before it reaches the wire, because NaN
 * serialises to null and would arrive as the wrong complaint.
 */
export async function quoteBooking({
  bookingId,
  totalFee,
}: {
  bookingId: string;
  totalFee: number;
}): Promise<ActionResult> {
  if (!Number.isFinite(totalFee)) {
    return {
      ok: false,
      message: "Enter a fee as a number.",
      stale: false,
    };
  }

  const supabase = await createClient();
  const args: QuoteArgs = {
    p_booking_id: bookingId,
    p_total_fee: totalFee,
  };

  const { error } = await supabase.rpc("quote_booking", args);

  if (error) {
    const failure = toActionFailure(error, QUOTE_MESSAGES);
    if (failure.stale) revalidateBooking(bookingId);
    return failure;
  }

  revalidateBooking(bookingId);
  return { ok: true };
}

const REVIEW_MESSAGES: ErrorMessages = {
  // ⚠️ review_booking raises 42501 for its STATUS guard as well as the module
  // check — since l77b it decides a Tier Claim only in awaiting_tier_review.
  forbidden:
    "You cannot review this Tier Claim. Either you do not have the booking module, or the booking is no longer in Tier Review — it may already have been decided. The page has been refreshed.",
  // 22023: a missing reason, or the wrong decline for this look — revise is
  // the first look's, reject the second's. Both mean the page is stale.
  conflict:
    "That decision does not fit this review. A reason is required, and a Tier Claim gets one Revision Request before it can be rejected. The page has been refreshed.",
  // PT404 here means EITHER no booking OR no uploaded organisation document.
  missing:
    "There is no organisation document on file for this booking to review.",
  fallback: "The decision could not be saved. Please try again.",
};

/**
 * Tier Review, in awaiting_tier_review only (l77b, SCRUM-198).
 *
 * Accept stamps the document, sets tier_verified, and moves the booking to
 * awaiting_payment with a fresh Hold — or to awaiting_quote for Full Facility.
 *
 * Revise (the first look only) issues the one Revision Request: the reason is
 * the organiser's to read, and the booking waits in awaiting_resubmission on a
 * fresh Hold.
 *
 * Reject (the second look only) re-prices to the COMMERCIAL tier through
 * booking_price, writes document_rejected then repriced, starts a fresh Hold,
 * and tells the organiser to pay the commercial downpayment or cancel.
 *
 * The RPC writes every event and notice itself.
 */
export async function reviewDocument({
  bookingId,
  decision,
  reason,
}: {
  bookingId: string;
  decision: TierReviewDecision;
  reason?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const args: ReviewArgs = {
    p_booking_id: bookingId,
    p_decision: decision,
    // The RPC requires a reason for revise and reject and treats blank as
    // absent. Let it enforce that rather than duplicating the rule.
    p_reason: reason?.trim() || undefined,
  };

  const { error } = await supabase.rpc("review_booking", args);

  if (error) {
    const failure = toActionFailure(error, REVIEW_MESSAGES);
    // review_booking's 42501 is usually its status guard — a colleague
    // decided the claim first — so refresh the page to show where the booking
    // is now. Revalidating on the module-check reading of 42501 is harmless.
    if (failure.stale || error.code === "42501") revalidateBooking(bookingId);
    return failure;
  }

  revalidateBooking(bookingId);
  return { ok: true };
}

/**
 * Accept is the commit line of decision 6: confirmed_at is stamped,
 * hold_expires_at is NULLED, and from there neither side can cancel. If
 * balance_amount is zero it goes straight to fully_paid, skipping `confirmed`
 * entirely. Reject only bounces the receipt back and restarts the clock.
 *
 * The rule, including the official receipt number accept needs, lives in
 * ./payment-verification.ts. `bookingId` is here only for revalidatePath.
 */
export async function verifyPayment({
  bookingId,
  ...input
}: PaymentVerificationInput & { bookingId: string }): Promise<ActionResult> {
  const result = await writePaymentVerification(await createClient(), input);
  if (result.ok || result.stale) revalidateBooking(bookingId);
  return result;
}

const BALANCE_MESSAGES: ErrorMessages = {
  forbidden:
    "Only a supervisor with the booking module can record a balance payment.",
  conflict:
    "This balance could not be recorded. The booking may not be confirmed, or the amount may not match the outstanding balance exactly.",
  missing: "This booking no longer exists. The page has been refreshed.",
  duplicate:
    "That official receipt number is already recorded against another payment.",
  fallback: "The payment could not be recorded. Please try again.",
};

/**
 * Exact amounts only — no partial and no over-payment — and never GCash. The
 * method restriction and the supervisor gate are the schema saying out loud
 * what decision 6 says in prose: the balance is settled in person.
 */
export async function recordBalancePayment({
  bookingId,
  amount,
  officialReceiptNo,
  method,
  paidAt,
}: {
  bookingId: string;
  amount: number;
  officialReceiptNo: string;
  method: PaymentMethod;
  paidAt: string;
}): Promise<ActionResult> {
  if (!Number.isFinite(amount)) {
    return { ok: false, message: "Enter an amount as a number.", stale: false };
  }

  const supabase = await createClient();
  const args: BalanceArgs = {
    p_booking_id: bookingId,
    p_amount: amount,
    p_official_receipt_no: officialReceiptNo.trim(),
    p_method: method,
    p_paid_at: paidAt,
  };

  const { error } = await supabase.rpc("record_balance_payment", args);

  if (error) {
    const failure = toActionFailure(error, BALANCE_MESSAGES);
    if (failure.stale) revalidateBooking(bookingId);
    return failure;
  }

  revalidateBooking(bookingId);
  return { ok: true };
}

const REJECT_MESSAGES: ErrorMessages = {
  forbidden:
    "You do not have permission to reject bookings. Ask an administrator to check your module assignment.",
  // ⚠️ reject_booking's status guard raises 22023, unlike review_booking's.
  // So this is the sentence an operator sees when they try to reject a
  // committed booking, and it must read as "this booking is committed", not as
  // "someone else got there first".
  conflict:
    "This booking can no longer be rejected. Once a downpayment has been verified the event is committed and neither side can cancel it.",
  missing: "This booking no longer exists. The page has been refreshed.",
  fallback: "The booking could not be rejected. Please try again.",
};

/**
 * Also decides any undecided downpayment on the way out, so
 * unverified_payment_count returns to zero rather than hanging forever on a
 * booking nobody can act on again. The citizen's notification says money is not
 * returned through this system.
 */
export async function rejectBooking({
  bookingId,
  reason,
}: {
  bookingId: string;
  reason: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const args: RejectArgs = {
    p_booking_id: bookingId,
    p_reason: reason.trim(),
  };

  const { error } = await supabase.rpc("reject_booking", args);

  if (error) {
    const failure = toActionFailure(error, REJECT_MESSAGES);
    if (failure.stale) revalidateBooking(bookingId);
    return failure;
  }

  revalidateBooking(bookingId);
  return { ok: true };
}

const COMPLETE_MESSAGES: ErrorMessages = {
  forbidden:
    "You do not have permission to complete bookings. Ask an administrator to check your module assignment.",
  conflict:
    "This booking cannot be completed yet. It must be fully paid and its event date must have passed.",
  missing: "This booking no longer exists. The page has been refreshed.",
  fallback: "The booking could not be completed. Please try again.",
};

/** Needs a fully_paid booking whose event date is before today in Manila. */
export async function completeBooking({
  bookingId,
}: {
  bookingId: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const args: CompleteArgs = { p_booking_id: bookingId };

  const { error } = await supabase.rpc("complete_booking", args);

  if (error) {
    const failure = toActionFailure(error, COMPLETE_MESSAGES);
    if (failure.stale) revalidateBooking(bookingId);
    return failure;
  }

  revalidateBooking(bookingId);
  return { ok: true };
}
