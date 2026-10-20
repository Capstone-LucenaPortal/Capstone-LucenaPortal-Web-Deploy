import Link from "next/link";
import { Clock } from "lucide-react";

/**
 * The one-active-claim gate, said out loud. Design L131–137: amber, clock
 * icon, the held reference, and a way straight back to it. Sits above
 * `OffDutyBanner`, as drawn.
 */
export function ActiveClaimBanner({ heldRef }: { heldRef: string }) {
  return (
    <Link
      href="/responder/my-ticket"
      className="flex shrink-0 items-center gap-2.5 border-b border-yellow-100 bg-yellow-50 px-4 py-2.75 text-amber-800"
    >
      <Clock size={17} className="shrink-0" aria-hidden />
      <span className="flex-1 text-[13px] font-semibold">
        Finish your current ticket first — {heldRef}
      </span>
      <span className="text-[12px] font-semibold">Open</span>
    </Link>
  );
}
