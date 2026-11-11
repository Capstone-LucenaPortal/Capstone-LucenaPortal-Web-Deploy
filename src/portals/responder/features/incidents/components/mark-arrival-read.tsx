"use client";

import { useEffect } from "react";
import { markArrivalRead } from "@/portals/responder/features/incidents/actions";

/**
 * Mounted in the pool's detail pane: opening an incident marks its pool-arrival
 * Inbox entry read (ADR 0001, decision 7). Renders nothing, and a failure is
 * not the responder's problem — the entry stays unread, with its own button.
 *
 * Issue #106: also mounted beside the pool list when `?report=` names a report
 * that has left the pool (rerouted or rejected). The entry is the caller's own
 * notification row, so marking it read needs no sight of the report.
 */
export function MarkArrivalRead({ incidentId }: { incidentId: string }) {
  useEffect(() => {
    void markArrivalRead(incidentId).catch(() => {});
  }, [incidentId]);

  return null;
}
