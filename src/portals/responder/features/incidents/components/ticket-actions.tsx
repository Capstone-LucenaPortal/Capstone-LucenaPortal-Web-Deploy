"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { resolveTicket } from "@/portals/responder/features/incidents/actions";
import { SubmitButton } from "@/portals/responder/components/ui/submit-button";
import { useSingleFlight } from "@/portals/responder/lib/use-single-flight";
import { cn } from "@/portals/responder/lib/utils";

const SECONDARY =
  "flex h-10 flex-1 items-center justify-center rounded-md border border-gray-200 bg-white text-[13px] font-semibold text-gray-500";

/**
 * The three ways out (PRD §4.5).
 *
 * Resolve stays pressable with no photo — pressing it opens the Add-photo
 * sheet. This differs deliberately from the claim gate, which disables its
 * buttons: there the blocker is a different ticket on a different screen and
 * there is nothing to do about it here, while here the remedy is one tap away
 * and on the same screen.
 *
 * `ready` is a HINT, not the gate. `resolve_incident` refuses without a
 * confirmed after photo and the refusal comes back as `?notice=needs_photo`
 * with the sheet already open — so pressing it while unready is a route to the
 * fix rather than an error.
 *
 * A client component only for the double-submit guard (ISO-9): a second tap
 * on a slow connection must not send a second resolve.
 */
export function TicketActions({
  incidentId,
  ready,
}: {
  incidentId: string;
  ready: boolean;
}) {
  const resolve = useSingleFlight(resolveTicket);

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white px-3.5 pt-2.75 pb-3.5 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <div className="mx-auto max-w-2xl">
        <form action={resolve}>
          <input type="hidden" name="incidentId" value={incidentId} />
          <SubmitButton
            className={cn(
              "flex h-13 w-full items-center justify-center gap-2 rounded-lg text-[16px] font-semibold disabled:opacity-60",
              ready ? "bg-green-800 text-white" : "bg-gray-100 text-gray-600",
            )}
          >
            <Check size={19} strokeWidth={2.4} aria-hidden />
            {ready ? "Resolve this incident" : "Resolve · needs an after photo"}
          </SubmitButton>
        </form>

        <div className="mt-2.25 flex gap-2">
          <Link href="/responder/my-ticket?sheet=release" className={SECONDARY}>
            Release to pool
          </Link>
          <Link href="/responder/my-ticket?sheet=reject" className={SECONDARY}>
            Wrong department
          </Link>
        </div>
      </div>
    </div>
  );
}
