"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/portals/staff/components/ui/modal";
import { Button } from "@/portals/staff/components/ui/button";
import { rejectBooking } from "../lib/actions";
import type { BookingStatus } from "../types";

/**
 * End a booking before it commits.
 *
 * The caller renders this only while `deskMoves(...).rejecting`
 * (../lib/desk-moves.ts) — up to and including `payment_verification`, and
 * never past it. That absence on a
 * `confirmed` booking is decision 6, there is no RPC behind it, and it is the
 * thing most likely to be quietly relaxed later. Do not add one.
 */
export function RejectBookingAction({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await rejectBooking({ bookingId, reason });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Reject booking
      </Button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-bold text-gray-900">Reject this booking</h2>
        <p className="mt-1 text-sm text-gray-600">
          The booking is cancelled, its venue slot is released, and the
          organiser is notified with your reason.
        </p>

        {/* Decision 7. A downpayment may already have been sent even though
            nobody has verified it, and reject_booking decides it on the way
            out rather than leaving it hanging. The operator must know what
            that means for the citizen before clicking. */}
        {status === "payment_verification" && (
          <p className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
            This organiser has already sent a downpayment. Rejecting marks it
            as rejected, and there are no refunds through this system — the
            organiser must contact office customer support.
          </p>
        )}

        <label
          htmlFor="reject-reason"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Reason (required)
        </label>
        <textarea
          id="reject-reason"
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
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending || !reason.trim()}
          >
            {pending ? "Saving…" : "Reject booking"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
