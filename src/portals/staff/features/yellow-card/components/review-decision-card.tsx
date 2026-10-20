"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/portals/staff/components/ui/card";
import { Modal } from "@/portals/staff/components/ui/modal";
import { Button } from "@/portals/staff/components/ui/button";
import { Toast } from "@/portals/staff/components/ui/toast";
import { formatDate } from "@/portals/staff/lib/utils";
import { reviewApplication } from "../lib/actions";
import { isReviewable } from "../lib/status";
import type {
  YellowCardApplication,
  YellowCardDecision,
  YellowCardReview,
} from "../types";

export function ReviewDecisionCard({
  application,
  actorName,
  latestReview = null,
}: {
  application: YellowCardApplication;
  /** Shown in the confirmation copy so the reviewer sees whose name is recorded. */
  actorName: string;
  /**
   * The most recent decision, from staff_yellow_card_reviews. Optional so the
   * card still renders where no review has been read (or none exists yet).
   */
  latestReview?: YellowCardReview | null;
}) {
  const [openModal, setOpenModal] = useState<YellowCardDecision | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open(decision: YellowCardDecision) {
    setReason("");
    setError(null);
    setOpenModal(decision);
  }

  function confirm(decision: YellowCardDecision) {
    const trimmed = reason.trim();
    if (decision !== "approve" && !trimmed) return;

    startTransition(async () => {
      const result = await reviewApplication({
        applicationId: application.id,
        decision,
        reason: decision === "approve" ? undefined : trimmed,
      });

      setOpenModal(null);
      // On success the action revalidates, the server re-renders with the new
      // status, and these buttons disappear on their own. There is no local
      // success banner to keep in sync with the truth.
      setError(result.ok ? null : result.message);
    });
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Review decision</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ReviewContext application={application} latestReview={latestReview} />

          {error && <Toast message={error} variant="error" />}

          {isReviewable(application.status) && (
            <div className="flex flex-wrap gap-2">
              <Button disabled={isPending} onClick={() => open("approve")}>
                Approve
              </Button>
              <Button
                variant="secondary"
                disabled={isPending}
                onClick={() => open("revise")}
              >
                Request Revision
              </Button>
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => open("reject")}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      <Modal open={openModal === "approve"} onClose={() => setOpenModal(null)}>
        <h2 className="text-lg font-bold text-gray-900">Approve application</h2>
        <p className="mt-1 text-sm text-gray-500">
          Approve this application? The Yellow Card is issued immediately and the
          decision is recorded under {actorName}.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpenModal(null)}>
            Cancel
          </Button>
          <Button disabled={isPending} onClick={() => confirm("approve")}>
            {isPending ? "Saving…" : "Confirm approval"}
          </Button>
        </div>
      </Modal>

      <Modal open={openModal === "revise"} onClose={() => setOpenModal(null)}>
        <h2 className="text-lg font-bold text-gray-900">Request revision</h2>
        <p className="mt-1 text-sm text-gray-500">
          The applicant sees this reason and can resubmit after fixing it. The
          review clock pauses until they do.
        </p>
        <label
          htmlFor="revise-reason"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Reason (required)
        </label>
        <textarea
          id="revise-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain what the applicant needs to fix..."
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
          rows={3}
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpenModal(null)}>
            Cancel
          </Button>
          <Button
            disabled={!reason.trim() || isPending}
            onClick={() => confirm("revise")}
          >
            {isPending ? "Saving…" : "Confirm request"}
          </Button>
        </div>
      </Modal>

      <Modal open={openModal === "reject"} onClose={() => setOpenModal(null)}>
        <h2 className="text-lg font-bold text-gray-900">Reject application</h2>
        <p className="mt-1 text-sm text-gray-500">
          This denies the application. The reason is recorded under {actorName}.
        </p>
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
          placeholder="Reason for rejection..."
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
          rows={3}
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpenModal(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || isPending}
            onClick={() => confirm("reject")}
          >
            {isPending ? "Saving…" : "Confirm rejection"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

/**
 * The reason a previous reviewer gave, quoted verbatim.
 *
 * Rendered as a blockquote rather than folded into the sentence so it reads as
 * someone else's words — the citizen has already been shown this exact text.
 */
function Reason({ review }: { review: YellowCardReview }) {
  if (!review.reason) return null;

  return (
    <blockquote className="mt-2 border-l-2 border-current/30 pl-3 italic">
      {review.reason}
    </blockquote>
  );
}

/** "by Maria Santos on 29 June 2026", with whatever half of it is known. */
function attribution(review: YellowCardReview | null, fallbackDate: string | null) {
  const on = review?.reviewed_at ? formatDate(review.reviewed_at) : fallbackDate;
  const by = review?.reviewed_by_name;

  if (by && on) return ` by ${by} on ${on}`;
  if (on) return ` on ${on}`;
  if (by) return ` by ${by}`;
  return "";
}

/**
 * What state this application is in, when it got there, and — since layer 52
 * exposes staff_yellow_card_reviews — why.
 *
 * `latestReview` is null before anyone has decided, and on the seeded sandbox
 * rows that were inserted directly rather than through the RPC. Every branch
 * degrades to the state-only copy in that case rather than rendering a blank.
 */
function ReviewContext({
  application,
  latestReview,
}: {
  application: YellowCardApplication;
  latestReview: YellowCardReview | null;
}) {
  const decidedOn = application.decided_at ? formatDate(application.decided_at) : null;

  if (application.status === "resubmitted") {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        Resubmitted after a revision request — review cycle {application.review_cycles + 1}.
        {latestReview?.reason && (
          <>
            <span className="mt-2 block font-medium">
              What was asked for{attribution(latestReview, null)}:
            </span>
            <Reason review={latestReview} />
          </>
        )}
      </div>
    );
  }

  if (application.status === "revision_requested") {
    return (
      <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
        Waiting on the applicant to resubmit. The review clock is paused; this
        returns to the queue as Resubmitted when they act.
        {latestReview?.reason && (
          <>
            <span className="mt-2 block font-medium">
              Revision requested{attribution(latestReview, null)}:
            </span>
            <Reason review={latestReview} />
          </>
        )}
      </div>
    );
  }

  if (application.status === "rejected") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        Rejected{attribution(latestReview, decidedOn)}.
        {latestReview && <Reason review={latestReview} />}
      </div>
    );
  }

  if (application.status === "approved") {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        Approved{attribution(latestReview, decidedOn)}.
        {latestReview && <Reason review={latestReview} />}
      </div>
    );
  }

  if (application.status === "withdrawn") {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        Withdrawn by the applicant. No decision is required.
      </div>
    );
  }

  if (application.needs_dedup_review) {
    return (
      <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
        Flagged for duplicate review — this voter ID matches an existing record.
        Check before approving.
      </div>
    );
  }

  return null;
}
