/**
 * Deciding one GCash downpayment: the rule behind the verifyPayment server
 * action.
 *
 * It takes the client rather than constructing it, which is what lets a test
 * observe the request it builds. It lives here rather than in ./actions.ts
 * because that module is `"use server"`: a client parameter there would widen
 * a network-reachable endpoint for the benefit of a test. The shell in
 * actions.ts supplies the real client and owns revalidation.
 *
 * See docs/adr/0001-supabase-recording-fetch-seam.md (actions module, #9).
 */

import type { Db } from "@/shared/supabase/server";
import {
  toActionFailure,
  type ActionFailure,
  type ActionResult,
  type ErrorMessages,
} from "@/portals/staff/lib/supabase/errors";
import type { Database } from "@/shared/supabase/types";
import type { StaffVerificationDecision } from "../types";

/** See the note on the Args aliases at the top of ./actions.ts. */
type VerifyArgs = Database["public"]["Functions"]["verify_payment"]["Args"];

const MESSAGES: ErrorMessages = {
  forbidden:
    "You do not have permission to verify payments. Ask an administrator to check your module assignment.",
  conflict:
    "This payment can no longer be decided — it may already have been verified or rejected. The page has been refreshed.",
  missing: "This payment no longer exists. The page has been refreshed.",
  duplicate:
    "That official receipt number is already recorded against another payment.",
  fallback: "The decision could not be saved. Please try again.",
};

/**
 * ⚠️ verify_payment raises its missing-OR refusal as 22023, the same code as
 * its stale-page guards, so the shared translation would call it "already
 * decided — refreshed". That sentence is false here, so this one is said
 * instead, and the page is left alone.
 */
const RECEIPT_REQUIRED: ActionFailure = {
  ok: false,
  message: "Enter the official receipt number to accept this payment.",
  stale: false,
};

/**
 * The RPC's wording for that refusal, from the DB repo's
 * 20260923042009_l68_or_at_gcash_verification.sql. The errcode alone cannot
 * tell it from a stale page, so the message is read — here and in the two
 * l71 refusals below, and nowhere else.
 */
const RECEIPT_REQUIRED_RAISE = /official receipt number is required/;

/**
 * l71's two accept refusals (SCRUM-186), from the DB repo's
 * 20261001053845_l71_discount_review_before_confirm.sql. Also 22023, and also
 * read by message for the same reason: the shared "already decided" sentence
 * is false for both, since nothing happened to the payment.
 *
 * The desk holds Verify on both (`PaymentAccept` in ./desk-moves.ts), so the
 * RPC saying either means the page was out of date — these stay `stale` and
 * the page is refreshed, unlike the receipt refusal above.
 */
const STALE_ACCEPT_REFUSALS: [RegExp, ActionFailure][] = [
  [
    /organisation document has not been decided/,
    {
      ok: false,
      message:
        "Accept or reject the organisation document before accepting this payment — the booking is on the discounted rate and its claim has not been decided. The page has been refreshed.",
      stale: true,
    },
  ],
  [
    /now needs a downpayment of/,
    {
      ok: false,
      message:
        "This payment is not for the booking's current downpayment — the booking was repriced after it was sent. Reject it so the organiser can pay the right amount. The page has been refreshed.",
      stale: true,
    },
  ],
];

export interface PaymentVerificationInput {
  paymentId: string;
  decision: StaffVerificationDecision;
  reason?: string;
  officialReceiptNo?: string;
}

/**
 * ⚠️ The RPC takes a PAYMENT id. Getting it the wrong way round with the
 * booking id produces a P0002 that looks like a missing booking.
 *
 * Accept needs the cashier's official receipt number (l68, RA 11032 §21(g));
 * reject must not carry one, because a rejected payment is not receipted. So
 * the number is sent on accept only, whatever the caller passes, and a blank
 * one never reaches the wire.
 */
export async function writePaymentVerification(
  db: Db,
  { paymentId, decision, reason, officialReceiptNo }: PaymentVerificationInput,
): Promise<ActionResult> {
  const receiptNo = officialReceiptNo?.trim();
  if (decision === "accept" && !receiptNo) return RECEIPT_REQUIRED;

  const args: VerifyArgs = {
    p_payment_id: paymentId,
    p_decision: decision,
    p_reason: reason?.trim() || undefined,
    p_official_receipt_no: decision === "accept" ? receiptNo : undefined,
  };

  const { error } = await db.rpc("verify_payment", args);

  if (!error) return { ok: true };
  // Unreachable past the guard above — JS trims a superset of what btrim
  // does — but the translation must not lie if the database ever says it.
  if (error.code === "22023" && RECEIPT_REQUIRED_RAISE.test(error.message)) {
    return RECEIPT_REQUIRED;
  }
  if (error.code === "22023") {
    for (const [raise, failure] of STALE_ACCEPT_REFUSALS) {
      if (raise.test(error.message)) return failure;
    }
  }
  return toActionFailure(error, MESSAGES);
}
