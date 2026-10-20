"use client";

import { UserMinus } from "lucide-react";
import { useDuty } from "@/portals/responder/features/auth/hooks/use-session";

/**
 * Off duty takes a responder out of the department's headcount but never hides
 * work — the pool stays browsable and claimable (PRD §5). This banner is the
 * only thing that changes about the pool when the switch goes off.
 */
export function OffDutyBanner() {
  const { onDuty } = useDuty();
  if (onDuty) return null;

  return (
    <div className="flex shrink-0 gap-2.5 border-b border-blue-100 bg-blue-50 px-4 py-3 text-blue-800">
      <UserMinus size={17} className="mt-px shrink-0" aria-hidden />
      <p className="text-[13px]">
        {"You're off duty, so your department doesn't count you in this shift. The pool stays browsable and claimable."}
      </p>
    </div>
  );
}
