import { describe, expect, it } from "vitest";
import {
  createFailingFetch,
  createRecordingFetch,
  createTestClient,
  parseProcedureName,
} from "@/portals/staff/lib/supabase/testing";
import { writePaymentVerification } from "./payment-verification";

/**
 * The rule behind verifyPayment, on the recording-fetch seam. What is asserted
 * is the request that would have reached verify_payment and the sentence made
 * of its answer. The shell in ./actions.ts is deliberately not tested — see
 * the note at the top of ./payment-verification.ts.
 */

const RECEIPT_REQUIRED = {
  ok: false,
  message: "Enter the official receipt number to accept this payment.",
  stale: false,
};

function failingClient(code: string, message: string) {
  return createTestClient(
    createFailingFetch({ status: 400, code, message }).fetch,
  );
}

describe("writePaymentVerification", () => {
  it("sends the trimmed official receipt number on accept", async () => {
    const { fetch, requests } = createRecordingFetch();

    const result = await writePaymentVerification(createTestClient(fetch), {
      paymentId: "pay-1",
      decision: "accept",
      officialReceiptNo: "  OR-0042  ",
    });

    expect(result).toEqual({ ok: true });
    expect(requests).toHaveLength(1);
    expect(parseProcedureName(requests[0].url)).toBe("verify_payment");
    expect(requests[0].body).toEqual({
      p_payment_id: "pay-1",
      p_decision: "accept",
      p_official_receipt_no: "OR-0042",
    });
  });

  it("never sends an official receipt number on reject", async () => {
    // A rejected payment is not receipted: the RPC raises 22023 if one comes.
    const { fetch, requests } = createRecordingFetch();

    await writePaymentVerification(createTestClient(fetch), {
      paymentId: "pay-1",
      decision: "reject",
      reason: " Screenshot unreadable ",
      officialReceiptNo: "OR-0042",
    });

    expect(requests[0].body).toEqual({
      p_payment_id: "pay-1",
      p_decision: "reject",
      p_reason: "Screenshot unreadable",
    });
  });

  it("refuses a blank official receipt number on accept without calling the RPC", async () => {
    const { fetch, requests } = createRecordingFetch();

    const result = await writePaymentVerification(createTestClient(fetch), {
      paymentId: "pay-1",
      decision: "accept",
      officialReceiptNo: "   ",
    });

    expect(requests).toHaveLength(0);
    expect(result).toEqual(RECEIPT_REQUIRED);
  });

  it("does not present a missing-OR 22023 as a colleague acting first", async () => {
    // Unreachable through the guard above, but if the RPC still raises it, the
    // shared 22023 translation would say "already decided — refreshed", which
    // is false and hides the real cause.
    const db = failingClient(
      "22023",
      "verify_payment: the official receipt number is required to accept a payment",
    );

    const result = await writePaymentVerification(db, {
      paymentId: "pay-1",
      decision: "accept",
      officialReceiptNo: "OR-0042",
    });

    expect(result).toEqual(RECEIPT_REQUIRED);
  });

  it("still reads any other 22023 as a stale page", async () => {
    const db = failingClient(
      "22023",
      "verify_payment: that payment has already been decided",
    );

    const result = await writePaymentVerification(db, {
      paymentId: "pay-1",
      decision: "accept",
      officialReceiptNo: "OR-0042",
    });

    expect(result).toMatchObject({ ok: false, stale: true });
    expect(result.ok === false && result.message).toMatch(
      /already have been verified/,
    );
  });

  it("says the discount claim must be decided first, and refreshes the page", async () => {
    // l71 (SCRUM-186). The desk holds the accept on an undecided claim, so the
    // RPC saying it means the page was out of date — but "already decided" is
    // the wrong sentence: nothing happened to the payment.
    const db = failingClient(
      "22023",
      "verify_payment: BK-2026-000049 is priced at the discounted rate and its organisation document has not been decided. Accept or reject the document before accepting the payment",
    );

    const result = await writePaymentVerification(db, {
      paymentId: "pay-1",
      decision: "accept",
      officialReceiptNo: "OR-0042",
    });

    expect(result).toEqual({
      ok: false,
      message:
        "Accept or reject the organisation document before accepting this payment — the booking is on the discounted rate and its claim has not been decided. The page has been refreshed.",
      stale: true,
    });
  });

  it("says a payment for a repriced booking must be rejected, and refreshes the page", async () => {
    // l71's amount backstop. The booking was repriced after the citizen paid.
    const db = failingClient(
      "22023",
      "verify_payment: this payment is for PHP 10,200.00, but BK-2026-000049 now needs a downpayment of PHP 20,400.00. Reject it so the citizen can pay the right amount",
    );

    const result = await writePaymentVerification(db, {
      paymentId: "pay-1",
      decision: "accept",
      officialReceiptNo: "OR-0042",
    });

    expect(result).toEqual({
      ok: false,
      message:
        "This payment is not for the booking's current downpayment — the booking was repriced after it was sent. Reject it so the organiser can pay the right amount. The page has been refreshed.",
      stale: true,
    });
  });

  it("names a duplicate official receipt number", async () => {
    const db = failingClient(
      "23505",
      "verify_payment: OR number OR-0042 is already recorded against another payment",
    );

    const result = await writePaymentVerification(db, {
      paymentId: "pay-1",
      decision: "accept",
      officialReceiptNo: "OR-0042",
    });

    expect(result).toEqual({
      ok: false,
      message:
        "That official receipt number is already recorded against another payment.",
      stale: false,
    });
  });
});
