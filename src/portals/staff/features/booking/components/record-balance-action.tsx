"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MANILA_TIME_ZONE } from "@/shared/dates/manila";
import { Modal } from "@/portals/staff/components/ui/modal";
import { Button } from "@/portals/staff/components/ui/button";
import { recordBalancePayment } from "../lib/actions";
import { formatCurrency } from "../lib/money";
import { PAYMENT_METHOD_LABELS } from "../lib/status";
import type { PaymentMethod } from "../types";

/**
 * The methods record_balance_payment accepts.
 *
 * `gcash` is deliberately absent — the RPC raises 22023 for it. That
 * restriction and the supervisor gate are the schema saying out loud what
 * decision 6 says in prose: the balance is settled in person.
 */
const METHODS: PaymentMethod[] = ["cash", "bank_transfer", "check"];

/** Today's date in Manila, as the `date` input wants it. */
function todayInManila(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TIME_ZONE }).format(now);
}

export function RecordBalanceAction({
  bookingId,
  balanceAmount,
}: {
  bookingId: string;
  /** The exact figure the RPC demands. Prefilled, because it must match. */
  balanceAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Prefilled with the outstanding balance because record_balance_payment
  // refuses anything that is not an exact match — no partial and no
  // over-payment. It stays editable so a mismatch is the operator's decision
  // to make and the RPC's to refuse, not something this form hides.
  const [amount, setAmount] = useState(String(balanceAmount));
  const [receiptNo, setReceiptNo] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  // Exempt: this is a client component seeding form state on mount. There is
  // no render-top above it to be handed a moment from, and the value is not a
  // moment anything is measured against — it is a default the operator edits,
  // and the RPC judges what they submit.
  // eslint-disable-next-line no-restricted-syntax
  const [paidAt, setPaidAt] = useState(todayInManila(new Date()));

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await recordBalancePayment({
        bookingId,
        amount: Number.parseFloat(amount),
        officialReceiptNo: receiptNo,
        method,
        paidAt,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setReceiptNo("");
      router.refresh();
    });
  }

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Record balance payment</Button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-bold text-gray-900">
          Record the balance payment
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Outstanding balance: {formatCurrency(balanceAmount)}. The amount must
          match exactly — partial and over-payments are refused.
        </p>

        <label
          htmlFor="balance-amount"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Amount (₱)
        </label>
        <input
          id="balance-amount"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        />

        <label
          htmlFor="balance-or"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Official receipt number
        </label>
        <input
          id="balance-or"
          type="text"
          value={receiptNo}
          onChange={(event) => setReceiptNo(event.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        />

        <label
          htmlFor="balance-method"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Method
        </label>
        <select
          id="balance-method"
          value={method}
          onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
        >
          {METHODS.map((value) => (
            <option key={value} value={value}>
              {PAYMENT_METHOD_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          GCash is not accepted for a balance — it is settled in person.
        </p>

        <label
          htmlFor="balance-paid-at"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Paid on
        </label>
        <input
          id="balance-paid-at"
          type="date"
          value={paidAt}
          onChange={(event) => setPaidAt(event.target.value)}
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
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={pending || !receiptNo.trim() || !amount.trim()}
          >
            {pending ? "Saving…" : "Record payment"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
