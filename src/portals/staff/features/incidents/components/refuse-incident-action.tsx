"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/portals/staff/components/ui/modal";
import { Button } from "@/portals/staff/components/ui/button";
import { refuseIncident } from "../lib/actions";
import { isRefusable } from "../lib/status";
import type { Incident, RefusalReason } from "../types";

/**
 * refuse_incident refuses a longer reason rather than clipping it, because the
 * reason ends the Citizen's notice. The form stops the typing at the same
 * figure so the refusal is never the first the officer hears of the limit.
 */
const REASON_MAX = 500;

const FIELD_LABEL =
  "mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500";
const FIELD_INPUT =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue";

/**
 * Close an open or pooled report as Invalid or as a Duplicate (CONTEXT.md §
 * Reports, DB). Like force-release, no success banner: the Server Action
 * revalidates and the page re-reads, so the closed status, the timeline's
 * `closed` event and the link to the Original are shown by the page itself.
 */
export function RefuseIncidentAction({ incident }: { incident: Incident }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [refusal, setRefusal] = useState<RefusalReason>("invalid");
  const [originalReference, setOriginalReference] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isRefusable(incident.status)) return null;

  const isDuplicate = refusal === "duplicate";
  const ready = reason.trim() !== "" && (!isDuplicate || originalReference.trim() !== "");

  function handleConfirm() {
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      const result = await refuseIncident({
        incidentId: incident.id,
        closureReason: refusal,
        reason,
        // An Invalid refusal sends an explicit null even when a reference was
        // typed before switching back: the RPC refuses an Invalid that names
        // an Original.
        originalReference: isDuplicate ? originalReference : null,
      });

      if (!result.ok) {
        // What was typed stays, so a mistyped reference can be corrected.
        setError(result.message);
        return;
      }

      setOpen(false);
      setRefusal("invalid");
      setOriginalReference("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Refuse report
      </Button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-bold text-gray-900">
          Refuse {incident.reference_number}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          This closes the report for good. The citizen is told in writing, with
          your name, the date and the reason.
        </p>

        <fieldset className="mt-4">
          <legend className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Refuse as
          </legend>
          <div className="mt-2 flex gap-6 text-sm text-gray-900">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="refusal"
                value="invalid"
                checked={refusal === "invalid"}
                onChange={() => setRefusal("invalid")}
              />
              Invalid
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="refusal"
                value="duplicate"
                checked={isDuplicate}
                onChange={() => setRefusal("duplicate")}
              />
              Duplicate
            </label>
          </div>
        </fieldset>

        {isDuplicate && (
          <>
            <label htmlFor="refuse-original" className={FIELD_LABEL}>
              Original&apos;s reference number (required)
            </label>
            <input
              id="refuse-original"
              type="text"
              value={originalReference}
              onChange={(event) => setOriginalReference(event.target.value)}
              placeholder="INC-2026-000000"
              className={FIELD_INPUT}
            />
          </>
        )}

        <label htmlFor="refuse-reason" className={FIELD_LABEL}>
          Reason (required)
        </label>
        <textarea
          id="refuse-reason"
          value={reason}
          maxLength={REASON_MAX}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Sent to the citizen as the last line of the notice..."
          className={FIELD_INPUT}
          rows={3}
        />
        <p className="mt-1 text-right text-xs text-gray-500">
          {reason.length} / {REASON_MAX}
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending || !ready} onClick={handleConfirm}>
            {pending ? "Refusing…" : "Confirm refusal"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
