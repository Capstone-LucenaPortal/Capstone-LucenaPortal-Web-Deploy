"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/portals/staff/components/ui/modal";
import { Button } from "@/portals/staff/components/ui/button";
import { reviewDocument } from "../lib/actions";
import type { TierReview } from "../lib/desk-moves";

/**
 * What the decline button opens, per look. The copy says what each choice
 * DOES, because both move the organiser's money or their date.
 */
const DECLINE: Record<
  TierReview["decline"],
  {
    button: string;
    title: string;
    body: string;
    label: string;
    confirm: string;
  }
> = {
  revise: {
    button: "Request revision",
    title: "Request a revision of the organisation document",
    body:
      "The organiser will read this reason and can upload a corrected document to the same booking. They have until the end of a fresh hold to do it; if they don't, the booking is cancelled and the slot released. This is the claim's only Revision Request — the next review can accept or reject it.",
    label: "Reason (required) — tell the organiser what to fix",
    confirm: "Send Revision Request",
  },
  reject: {
    button: "Reject",
    title: "Reject the Tier Claim",
    body:
      "The booking will be repriced at the commercial rate. The organiser will be notified of the commercial downpayment and asked to pay it or cancel the booking, with a fresh payment window.",
    label: "Reason (required)",
    confirm: "Reject and reprice",
  },
};

/**
 * Tier Review: accept the organisation document behind a discount claim, or
 * decline it — a Revision Request on the first look, a reject on the second
 * (SCRUM-198). Which look this is comes from the server through desk-moves;
 * this control never works it out.
 *
 * When there is no document the controls render DISABLED with the reason
 * beside them, rather than not rendering at all. Decision 4: the claim is
 * visible and unsubstantiated either way.
 *
 * No downpayment can be on file here — the booking is in awaiting_tier_review,
 * and submit_downpayment accepts only awaiting_payment — so nothing is said
 * about setting money aside.
 */
export function ReviewDocumentAction({
  bookingId,
  hasOrgDocument,
  decline,
}: {
  bookingId: string;
} & TierReview) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const copy = DECLINE[decline];

  function run(decision: "accept" | TierReview["decline"]) {
    setError(null);
    startTransition(async () => {
      const result = await reviewDocument({
        bookingId,
        decision,
        reason: decision === "accept" ? undefined : reason,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  const noDocument = hasOrgDocument
    ? undefined
    : "There is no organisation document on file to review.";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => run("accept")}
          disabled={pending || !hasOrgDocument}
          title={noDocument}
        >
          {pending ? "Saving…" : "Accept Tier Claim"}
        </Button>
        <Button
          variant={decline === "reject" ? "destructive" : "secondary"}
          onClick={() => setOpen(true)}
          disabled={pending || !hasOrgDocument}
          title={noDocument}
        >
          {copy.button}
        </Button>
      </div>

      {!hasOrgDocument && (
        <p className="mt-2 text-sm text-gray-600">
          No organisation document has been uploaded, so this discount claim
          cannot be reviewed yet.
        </p>
      )}

      {error && !open && (
        <p
          role="alert"
          className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-bold text-gray-900">{copy.title}</h2>
        <p className="mt-1 text-sm text-gray-600">{copy.body}</p>

        <label
          htmlFor="review-reason"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          {copy.label}
        </label>
        <textarea
          id="review-reason"
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
            variant={decline === "reject" ? "destructive" : "primary"}
            onClick={() => run(decline)}
            disabled={pending || !reason.trim()}
          >
            {pending ? "Saving…" : copy.confirm}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
