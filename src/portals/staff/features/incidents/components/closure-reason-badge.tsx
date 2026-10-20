import { Badge } from "@/portals/staff/components/ui/badge";
import { CLOSURE_REASON_LABELS } from "../lib/status";
import type { ClosureReason } from "../types";

/**
 * Why a closed incident closed.
 *
 * The mock modelled expiry as a sixth status and knew nothing about the other
 * four reasons, so a report the citizen confirmed and one thrown out as a
 * duplicate rendered identically. `invalid` and `duplicate` read as destructive
 * because they mean the report was rejected, not served.
 */
const VARIANT: Record<ClosureReason, "default" | "success" | "destructive"> = {
  citizen_confirmed: "success",
  auto_confirmed: "success",
  invalid: "destructive",
  duplicate: "destructive",
  expired_unverified: "default",
};

export function ClosureReasonBadge({ reason }: { reason: ClosureReason | null }) {
  if (!reason) return null;
  return <Badge variant={VARIANT[reason]}>{CLOSURE_REASON_LABELS[reason]}</Badge>;
}
