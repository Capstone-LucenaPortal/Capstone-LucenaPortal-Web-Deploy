"use client";

import { claimIncident } from "@/portals/responder/features/incidents/actions";
import { SubmitButton } from "@/portals/responder/components/ui/submit-button";
import { useSingleFlight } from "@/portals/responder/lib/use-single-flight";

/**
 * A Claim button is a one-field form, so the card around it stays a server
 * component. The button is the client edge, and only for the double-submit
 * guard (ISO-9). A repeat claim is already harmless -- claim_incident answers
 * it `already_yours` -- so this spares a slow connection the second round trip
 * and holds Claim to the same rule as the other incident actions.
 *
 * Gated, it disables *and* states the reason: a disabled control that still
 * says "Claim" is a mystery, and one that says why answers the question at the
 * point where it is asked. This matches how `pool/page.tsx` already disables
 * the barangay filter.
 */

export const GATED_CLAIM_LABEL = "Finish your ticket first";

export type ClaimVariant = "card" | "card-outline" | "detail";

const VARIANT: Record<ClaimVariant, string> = {
  card: "h-12 bg-lucena-blue text-[15.5px] text-white",
  "card-outline":
    "h-11.5 border border-gray-300 bg-white text-[15px] text-gray-900",
  detail: "h-13 bg-lucena-blue text-[16px] text-white",
};

export function ClaimButton({
  incidentId,
  label,
  gated,
  variant,
}: {
  incidentId: string;
  label: string;
  gated: boolean;
  variant: ClaimVariant;
}) {
  const claim = useSingleFlight(claimIncident);

  return (
    <form action={claim}>
      <input type="hidden" name="incidentId" value={incidentId} />
      <SubmitButton
        disabled={gated}
        className={`w-full rounded-lg font-semibold ${VARIANT[variant]} disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400`}
      >
        {gated ? GATED_CLAIM_LABEL : label}
      </SubmitButton>
    </form>
  );
}
