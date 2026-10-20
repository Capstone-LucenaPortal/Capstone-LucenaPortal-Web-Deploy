"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { BottomSheet } from "@/portals/responder/components/ui/bottom-sheet";
import { SubmitButton } from "@/portals/responder/components/ui/submit-button";
import { useOnlinePush } from "@/portals/responder/lib/use-online";
import { useSingleFlight } from "@/portals/responder/lib/use-single-flight";
import { releaseTicket } from "@/portals/responder/features/incidents/actions";
import { cn } from "@/portals/responder/lib/utils";

/**
 * PRD §4.5's sharpest rule, stated at the moment it matters: the SLA keeps
 * running. The incident goes back to the pool pinned to the instant it was
 * reported, so it can sit there visibly at risk or already late.
 *
 * ⚠️ THE REASON IS NOW MANDATORY (ruled 2026-08-12), on release as well as on
 * reject. The design styled Release unconditionally, but `release_incident`
 * writes an event row and that row is the ONLY record that reaches the next
 * responder — a hand-back with no reason tells them nothing. `releaseTicket`
 * enforces the same rule, because a disabled button is a courtesy.
 *
 * Collected as radios so the choice survives without a controlled input per
 * chip.
 */
export const RELEASE_REASONS = [
  "Shift ending",
  "Site blocked",
  "Need equipment",
  "Need more people",
];

export function ReleaseSheet({
  closeHref,
  remaining,
  incidentId,
}: {
  closeHref: string;
  remaining: string | null;
  incidentId: string;
}) {
  // Closing navigates; offline it is held, so the sheet stays (issue #7).
  const push = useOnlinePush();
  const [reason, setReason] = useState("");
  // One release per tap, however slow the connection (ISO-9).
  const release = useSingleFlight(releaseTicket);

  return (
    <BottomSheet
      open
      onClose={() => push(closeHref)}
      title="Release back to the pool"
    >
      <div className="mt-3 flex gap-2.25 rounded-md bg-yellow-50 px-3 py-2.75 text-[12.5px] text-pretty text-amber-800">
        <Clock size={17} className="mt-px shrink-0" aria-hidden />
        {remaining ? (
          <span>
            The SLA keeps running — <b>{remaining}</b> stays on the clock. The
            promise is to the citizen, not to you.
          </span>
        ) : (
          <span>
            No clock is running on this one. It goes back to the pool exactly as
            it came.
          </span>
        )}
      </div>

      <form action={release}>
        <input type="hidden" name="incidentId" value={incidentId} />
        <fieldset className="mt-4">
          <legend className="mb-2.25 text-[11px] font-bold tracking-[0.07em] uppercase text-gray-500">
            Reason
          </legend>
          <div className="flex flex-wrap gap-1.75">
            {RELEASE_REASONS.map((label) => (
              <label
                key={label}
                className={cn(
                  "flex h-9 cursor-pointer items-center rounded-full border px-3.5 text-[13px] font-medium",
                  reason === label
                    ? "border-lucena-blue bg-blue-50 text-blue-800"
                    : "border-gray-300 bg-white text-gray-500",
                )}
              >
                <input
                  type="radio"
                  name="reason"
                  value={label}
                  checked={reason === label}
                  onChange={() => setReason(label)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4.5 flex gap-2.25">
          <Link
            href={closeHref}
            className="flex h-12 flex-1 items-center justify-center rounded-md border border-gray-300 bg-white text-[15px] font-semibold text-gray-900"
          >
            Keep working
          </Link>
          <SubmitButton
            disabled={reason.trim().length === 0}
            className="h-12 flex-1 rounded-md bg-red-600 text-[15px] font-semibold text-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            Release
          </SubmitButton>
        </div>
      </form>
    </BottomSheet>
  );
}
