"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/portals/staff/components/ui/modal";
import { Button } from "@/portals/staff/components/ui/button";
import { completeBooking } from "../lib/actions";

/**
 * Close the record on an event that has happened.
 *
 * No reason is asked for — nothing is being decided, only recorded. The caller
 * renders this only while `deskMoves(...).completing` (../lib/desk-moves.ts),
 * which mirrors complete_booking's two guards: fully paid, and an event date
 * before today in Manila. An event happening today has not finished yet.
 *
 * It still confirms first. Completion is terminal: `completed` offers no
 * further action, so the Actions card disappears and there is no un-complete.
 * Every other mutating control in this module asks before it fires, and this
 * one being the exception made the most irreversible click the easiest to make
 * by accident.
 */
export function CompleteBookingAction({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await completeBooking({ bookingId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  return (
    <div>
      <Button onClick={() => setOpen(true)} disabled={pending}>
        Mark as completed
      </Button>

      <Modal open={open} onClose={close}>
        <h2 className="text-lg font-bold text-gray-900">
          Close the record on this event
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          The booking moves to completed and drops out of the active queue.
        </p>
        <p className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          This cannot be undone — a completed booking has no further actions.
          Only complete it once the event has actually taken place.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={pending}>
            Cancel
          </Button>
          {/* Worded apart from the trigger: both are on screen at once. */}
          <Button onClick={confirm} disabled={pending}>
            {pending ? "Saving…" : "Complete this booking"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
