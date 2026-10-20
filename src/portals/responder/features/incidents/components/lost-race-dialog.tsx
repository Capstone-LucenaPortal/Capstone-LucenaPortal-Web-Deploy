import Link from "next/link";
import { X } from "lucide-react";
import { RouteModal } from "@/portals/responder/components/ui/modal";

/**
 * The lost race, design L604–613. Server-rendered from `?lost=<name>`, so no
 * client state holds a modal open and dismissing it is a plain link.
 *
 * The winner's NAME travels in the URL rather than an id, because the app has
 * no lawful way to resolve a responder id to a name — deliberately. Putting the
 * assigned responder on `responder_incidents` would expose a standing roster of
 * every colleague's workload; `claim_incident` hands the name over only in the
 * moment you lost to that person. It is a FULL name here: the first-name rule
 * in the persona PRD governs what the CITIZEN sees, and the approved design
 * names the rival in full.
 *
 * `RouteModal` takes focus to the dialog, keeps Tab inside it and makes
 * Escape follow the same link (SCRUM-223).
 */
export function LostRaceDialog({ rivalName }: { rivalName: string }) {
  return (
    <RouteModal
      closeHref="/responder/pool"
      className="absolute inset-0 z-80 flex flex-col items-center justify-end"
    >
      <Link
        href="/responder/pool"
        aria-label="Dismiss"
        data-scrim
        className="absolute inset-0 bg-gray-900/50"
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lost-race-title"
        tabIndex={-1}
        className="relative mx-3.5 mb-15 w-full max-w-88 rounded-xl bg-white p-5 shadow-2xl"
      >
        <div className="mb-3.25 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-800">
          <X size={22} aria-hidden />
        </div>

        <h2
          id="lost-race-title"
          className="text-[18px] font-bold text-gray-900"
        >
          Already claimed by {rivalName}
        </h2>
        {/* The mockup says "He tapped Claim"; nothing records the rival's
            pronouns, so the name stands in. */}
        <p className="mt-1.5 text-[13.5px] text-pretty text-gray-500">
          {rivalName} tapped Claim a second before you. First claim wins — the
          ticket has left your pool.
        </p>

        <Link
          href="/responder/pool"
          className="mt-4 flex h-11.5 w-full items-center justify-center rounded-md bg-lucena-blue text-[15px] font-semibold text-white"
        >
          Back to pool
        </Link>
      </div>
    </RouteModal>
  );
}
