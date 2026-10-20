"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/portals/staff/components/ui/button";
import { quoteBooking } from "../lib/actions";
import { formatCurrency, splitMoney } from "../lib/money";
import type { FeeReference } from "../lib/fee-reference";

/**
 * The Quote screen. Decision 2.
 *
 * A free numeric input, NEVER prefilled. The booking that most needs this
 * screen is a Full Facility discounted one, which the rate card deliberately
 * marks `requires_quote` — there is no published rate to prefill, and putting
 * the commercial figure in the box would turn "price this" into "confirm this".
 *
 * A rate picker was rejected and stays rejected: it would mean publishing a
 * discounted Full Facility rate and deleting the quote concept, which is a
 * decision for the city rather than for this UI.
 */
export function QuoteForm({
  bookingId,
  reference,
  downpaymentPct,
  paymentWindowHours,
}: {
  bookingId: string;
  /** The same booking priced at the commercial tier, for anchoring. */
  reference: FeeReference;
  downpaymentPct: number;
  paymentWindowHours: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");

  const typed = Number.parseFloat(value);
  const preview = Number.isFinite(typed) && typed > 0 ? typed : null;
  const split = splitMoney(preview, downpaymentPct);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await quoteBooking({ bookingId, totalFee: typed });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setValue("");
      router.refresh();
    });
  }

  return (
    <div>
      <label
        htmlFor="quote-total-fee"
        className="block text-xs font-medium uppercase tracking-wide text-gray-500"
      >
        Total fee (₱)
      </label>
      <input
        id="quote-total-fee"
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-1 w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
      />

      {/* When the reference is `unknown`, show nothing rather than a zero —
          booking_price raises 23503 rather than issuing a free booking, and
          the display equivalent is silence. */}
      {reference.amount !== null && (
        <p className="mt-2 text-sm text-gray-600">
          For reference, this booking at the commercial tier costs{" "}
          <span className="font-medium text-gray-900">
            {formatCurrency(reference.amount)}
          </span>
          .
        </p>
      )}
      {reference.requiresQuote && (
        <p className="mt-2 text-sm text-gray-600">
          The rate card has no published rate for this venue and tier — that is
          why this booking needs a quote.
        </p>
      )}

      {preview !== null && (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <p className="text-gray-700">
            Downpayment due now ({downpaymentPct}%):{" "}
            <span className="font-medium text-gray-900">
              {formatCurrency(split.downpaymentAmount)}
            </span>
          </p>
          <p className="text-gray-700">
            Balance payable in person:{" "}
            <span className="font-medium text-gray-900">
              {formatCurrency(split.balanceAmount)}
            </span>
          </p>
        </div>
      )}

      {/* quote_booking sets hold_expires_at = now() + payment_window_hours.
          The hours come from config; hardcoding 72 would be a lie the day
          somebody changes it. */}
      <p className="mt-3 text-xs text-gray-500">
        Issuing this quote restarts the {paymentWindowHours}-hour payment
        window. The organiser will be notified of the amount.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <Button
        className="mt-4"
        onClick={handleSubmit}
        disabled={pending || preview === null}
      >
        {pending ? "Saving…" : "Issue quote"}
      </Button>
    </div>
  );
}
