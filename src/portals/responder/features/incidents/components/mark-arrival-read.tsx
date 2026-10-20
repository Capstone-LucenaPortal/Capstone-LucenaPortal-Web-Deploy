"use client";

import { useEffect } from "react";
import { markArrivalRead } from "@/portals/responder/features/incidents/actions";

/**
 * Mounted in the pool's detail pane: opening an incident marks its pool-arrival
 * Inbox entry read (ADR 0001, decision 7). Renders nothing, and a failure is
 * not the responder's problem — the entry stays unread, with its own button.
 */
export function MarkArrivalRead({ incidentId }: { incidentId: string }) {
  useEffect(() => {
    void markArrivalRead(incidentId).catch(() => {});
  }, [incidentId]);

  return null;
}
