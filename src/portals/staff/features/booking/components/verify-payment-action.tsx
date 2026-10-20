"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/portals/staff/components/ui/modal";
import { Button } from "@/portals/staff/components/ui/button";
import { verifyPayment } from "../lib/actions";
import { formatCurrency } from "../lib/money";
import type { PaymentAccept, PaymentHold } from "../lib/desk-moves";
import type { BookingPayment } from "../types";

/** What the operator does about each hold. The reason is desk-moves'; this sentence is the screen's. */
const ACCEPT_HELD: Record<PaymentHold, string> = {
  amount_stale:
    "This payment is not for the booking's current downpayment — the booking was repriced after it was sent. Reject it so the organiser can pay the right amount.",
};

/**
 * Decide one unverified downpayment.
 *
 * Accepting this is the single most consequential click in the module. It is
 * the commit line of decision 6: confirmed_at is stamped, hold_expires_at is
 * nulled, and from that moment neither the citizen nor Staff can cancel the
 * booking. The confirmation says so in those words rather than asking "are you
 * sure?", which tells the operator nothing. It also takes the cashier's
 * official receipt number (l68), so the button stays disabled until one is
 * typed.
 *
 * Rejecting is NOT the same as cancelling. It bounces the receipt back to the
 * organiser and restarts the payment window; use reject-booking to actually end
 * a booking.
 *
 * When `accept` is blocked (l71) Verify renders DISABLED with the reason under
 * it, and Reject stays live: that is how a payment for a stale amount moves
 * forward at all. An undecided Tier Claim no longer reaches this control —
 * since l77b a Tier Claim is decided before any downpayment (SCRUM-198).
 * verify_payment(reject)'s notice names the amount paid and the downpayment
 * owed (l72), so the operator's reason does not have to carry the figure.
 */
export function VerifyPaymentAction({
  payment,
  bookingId,
  accept,
}: {
  payment: BookingPayment;
  bookingId: string;
  accept: PaymentAccept;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"accept" | "reject" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [receiptNo, setReceiptNo] = useState("");

  function run(decision: "accept" | "reject") {
    setError(null);
    startTransition(async () => {
      const result = await verifyPayment({
        paymentId: payment.id,
        bookingId,
        decision,
        reason: decision === "reject" ? reason : undefined,
        officialReceiptNo: decision === "accept" ? receiptNo : undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMode(null);
      setReason("");
      setReceiptNo("");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => setMode("accept")}
          disabled={pending || accept.kind === "blocked"}
        >
          Verify payment
        </Button>
        <Button
          variant="destructive"
          onClick={() => setMode("reject")}
          disabled={pending}
        >
          Reject payment
        </Button>
      </div>

      {accept.kind === "blocked" && (
        <p className="mt-2 text-sm text-gray-600">{ACCEPT_HELD[accept.reason]}</p>
      )}

      {error && mode === null && (
        <p
          role="alert"
          className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <Modal open={mode === "accept"} onClose={() => setMode(null)}>
        <h2 className="text-lg font-bold text-gray-900">
          Confirm you have seen this payment
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {formatCurrency(payment.amount)}
          {payment.gcash_reference && ` · ${payment.gcash_reference}`}
        </p>
        <p className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          Once you confirm you have seen this payment in the GCash account, the
          booking is committed and neither side can cancel it. Check the amount
          and the reference against the account before continuing.
        </p>

        <label
          htmlFor="verify-or"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Official receipt no. (required)
        </label>
        <input
          id="verify-or"
          type="text"
          required
          value={receiptNo}
          onChange={(event) => setReceiptNo(event.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        />

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setMode(null)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => run("accept")}
            disabled={pending || !receiptNo.trim()}
          >
            {pending ? "Saving…" : "I have seen this payment"}
          </Button>
        </div>
      </Modal>

      <Modal open={mode === "reject"} onClose={() => setMode(null)}>
        <h2 className="text-lg font-bold text-gray-900">Reject this payment</h2>
        <p className="mt-1 text-sm text-gray-600">
          The booking returns to awaiting payment and the payment window
          restarts. This does not end the booking — use Reject booking for that.
        </p>

        <label
          htmlFor="verify-reason"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Reason (required)
        </label>
        <textarea
          id="verify-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        />

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setMode(null)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => run("reject")}
            disabled={pending || !reason.trim()}
          >
            {pending ? "Saving…" : "Reject payment"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
