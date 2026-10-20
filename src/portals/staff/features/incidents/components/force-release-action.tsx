"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/portals/staff/components/ui/modal";
import { Button } from "@/portals/staff/components/ui/button";
import { forceReleaseIncident } from "../lib/actions";
import type { Incident } from "../types";

/**
 * There is no local success banner. The Server Action revalidates and the page
 * re-reads, so the incident's new state is shown by the page itself rather than
 * described by a component that only thinks it knows what happened.
 */
export function ForceReleaseAction({ incident }: { incident: Incident }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (!reason.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await forceReleaseIncident({
        incidentId: incident.id,
        reason,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setOpen(false);
      // Same reason as the routing dialog: a stale reason must not ride along
      // with a later release.
      setReason("");
      router.refresh();
    });
  }

  return (
    <div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Force-release claim
      </Button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h2 className="text-lg font-bold text-gray-900">Force-release claim</h2>
        <p className="mt-1 text-sm text-gray-500">
          {incident.assigned_responder_name
            ? `This returns ${incident.assigned_responder_name}'s claim to the pool. `
            : "This returns the claim to the pool. "}
          The override is logged with your name and reason.
        </p>

        <label
          htmlFor="force-release-reason"
          className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          Reason (required)
        </label>
        <textarea
          id="force-release-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for the force-release..."
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lucena-blue"
          rows={3}
        />

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending || !reason.trim()}
            onClick={handleConfirm}
          >
            {pending ? "Releasing…" : "Confirm force-release"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
