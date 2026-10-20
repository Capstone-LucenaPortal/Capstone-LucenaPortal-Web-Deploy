"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/portals/responder/components/ui/bottom-sheet";
import { SubmitButton } from "@/portals/responder/components/ui/submit-button";
import { useOnlinePush } from "@/portals/responder/lib/use-online";
import { useSingleFlight } from "@/portals/responder/lib/use-single-flight";
import { rejectTicket } from "@/portals/responder/features/incidents/actions";

/**
 * Send back to staff (PRD §4.5). The reason is required and Send back stays
 * disabled until there is text — the design styles that button conditionally,
 * and staff cannot re-route a misroute nobody explained. `rejectTicket`
 * enforces the same rule, because a disabled button is a courtesy.
 */
export function RejectSheet({
  closeHref,
  incidentId,
}: {
  closeHref: string;
  incidentId: string;
}) {
  // Closing navigates; offline it is held, so the sheet stays (issue #7).
  const push = useOnlinePush();
  const [reason, setReason] = useState("");
  const reasonId = useId();
  // One send-back per tap, however slow the connection (ISO-9).
  const reject = useSingleFlight(rejectTicket);

  return (
    <BottomSheet
      open
      onClose={() => push(closeHref)}
      title="Send back to staff"
      description="Use this only when the job isn't ours. Staff re-route it — you don't pick the department."
    >
      <form action={reject}>
        <input type="hidden" name="incidentId" value={incidentId} />
        <label
          htmlFor={reasonId}
          className="mt-4 mb-2.25 block text-[11px] font-bold tracking-[0.07em] uppercase text-gray-500"
        >
          Why is this a misroute?
        </label>
        <textarea
          id={reasonId}
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Streetlight pole — belongs to Electrical, not Public Works"
          className="min-h-21 w-full resize-none rounded-md border border-gray-300 px-3 py-2.5 text-[13.5px] text-gray-900"
        />

        <div className="mt-3.5 flex gap-2.25">
          <Link
            href={closeHref}
            className="flex h-12 flex-1 items-center justify-center rounded-md border border-gray-300 bg-white text-[15px] font-semibold text-gray-900"
          >
            Cancel
          </Link>
          <SubmitButton
            disabled={reason.trim().length === 0}
            className="h-12 flex-1 rounded-md bg-lucena-blue text-[15px] font-semibold text-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            Send back
          </SubmitButton>
        </div>
      </form>
    </BottomSheet>
  );
}
