"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/portals/staff/components/ui/badge";
import { Button } from "@/portals/staff/components/ui/button";
import { Modal } from "@/portals/staff/components/ui/modal";
import { Toast } from "@/portals/staff/components/ui/toast";
import { formatDate } from "@/portals/staff/lib/utils";
import { revokeCard } from "../lib/actions";
import { getFullName } from "../lib/get-full-name";
import type {
  SupersedingCorrection,
  YellowCardApplication,
  YellowCardCardStatus,
  YellowCardIssuedCard,
} from "../types";

const STATUS_BADGE: Record<
  YellowCardCardStatus,
  { label: string; variant: "success" | "destructive" | "default" }
> = {
  active: { label: "Active", variant: "success" },
  revoked: { label: "Revoked", variant: "destructive" },
  superseded: { label: "Superseded", variant: "default" },
};

/**
 * A reason the Citizen can read. revoke_yellow_card refuses a blank one, and
 * one of nothing but full stops (DB l85, l119b); the button waits for the same.
 */
function isReadableReason(reason: string): boolean {
  return /[^.\s]/.test(reason);
}

/**
 * The name as the card face prints it, "DELA CRUZ, JUAN DIZON". Read from the
 * application that issued the card, as the Citizen's digital card does: both
 * are frozen at issuance, so they agree.
 */
function printedName(application: YellowCardApplication): string {
  const given = [application.first_name, application.middle_name, application.suffix]
    .filter((part) => part && part.trim())
    .join(" ");
  return `${application.last_name}, ${given}`.toUpperCase();
}

/**
 * The Yellow Card an approved application issued, and its Revocation
 * (Central-System-Documents ADR 0011).
 *
 * Only an Active card can be revoked. A Superseded card's successor is
 * revoked from its own Correction's page, which issued it, so this one links
 * there instead. The application's own status stays `approved` throughout:
 * the decision was made, and only the card changed.
 */
export function IssuedCardSection({
  application,
  card,
  actorName,
  supersedingCorrection,
}: {
  application: YellowCardApplication;
  card: YellowCardIssuedCard;
  actorName: string;
  supersedingCorrection: SupersedingCorrection | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const badge = STATUS_BADGE[card.status];

  function openDialog() {
    setReason("");
    setError(null);
    setOpen(true);
  }

  function confirm() {
    if (!isReadableReason(reason)) return;

    startTransition(async () => {
      const result = await revokeCard({
        applicationId: application.id,
        cardId: card.id,
        reason: reason.trim(),
      });

      setOpen(false);
      // On success the action revalidates and the page re-renders with the
      // card Revoked, so there is no local success state to keep in sync.
      setError(result.ok ? null : result.message);
    });
  }

  return (
    <section
      aria-label="Yellow Card"
      className="rounded-md border border-gray-200 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Yellow Card
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {card.card_number}
            <Badge variant={badge.variant} className="ml-2">
              {badge.label}
            </Badge>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Printed as {printedName(application)} · issued {formatDate(card.issued_on)}
          </p>
        </div>

        {card.status === "active" && (
          <Button
            variant="ghost"
            disabled={isPending}
            onClick={openDialog}
            className="border border-red-300 bg-white text-red-700 hover:bg-red-50"
          >
            Revoke card
          </Button>
        )}
      </div>

      {card.status === "revoked" && card.revocation && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Revoked by {card.revocation.revoked_by_name}
          {card.revocation.revoked_at && ` on ${formatDate(card.revocation.revoked_at)}`}.
          <blockquote className="mt-2 border-l-2 border-current/30 pl-3 italic">
            {card.revocation.reason}
          </blockquote>
        </div>
      )}

      {card.status === "superseded" && card.superseded_by && (
        <SupersededNotice
          successor={card.superseded_by}
          correction={supersedingCorrection}
        />
      )}

      {error && <Toast message={error} variant="error" className="mt-3" />}

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-bold text-gray-900">
          Revoke Yellow Card {card.card_number}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          The card stops being valid now: a Verifier who scans it is told not to
          accept it. This cannot be undone. {getFullName(application)} is told the
          reason and may apply again. Recorded under {actorName}.
        </p>
        <label
          htmlFor="revoke-reason"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Reason (required, shown to the Citizen)
        </label>
        <textarea
          id="revoke-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why this card is being revoked..."
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
          rows={3}
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!isReadableReason(reason) || isPending}
            onClick={confirm}
          >
            {isPending ? "Saving…" : "Confirm revocation"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}

/**
 * "Replaced by <card> on <date>, when Correction <ref> was approved." The
 * date and the link come from the Correction's own row; when that could not
 * be read, the sentence still names both, unlinked and undated.
 */
function SupersededNotice({
  successor,
  correction,
}: {
  successor: NonNullable<YellowCardIssuedCard["superseded_by"]>;
  correction: SupersedingCorrection | null;
}) {
  const on = correction?.decided_at ? ` on ${formatDate(correction.decided_at)},` : "";

  return (
    <p className="mt-2 text-sm text-gray-700">
      Replaced by <span className="font-medium">{successor.card_number}</span>
      {on} when Correction{" "}
      {correction ? (
        <Link
          href={`/staff/yellow-card/${correction.id}`}
          className="font-medium text-lucena-blue underline"
        >
          {successor.correction_reference}
        </Link>
      ) : (
        <span className="font-medium">{successor.correction_reference}</span>
      )}{" "}
      was approved.
    </p>
  );
}
