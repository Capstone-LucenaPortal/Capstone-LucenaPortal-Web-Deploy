import Link from "next/link";
import { Check } from "lucide-react";
import { RouteModal } from "@/portals/responder/components/ui/modal";
import { resolvedHeadline } from "@/portals/responder/features/incidents/lib/work";

/**
 * URL-driven like the lost-race dialog, so no client state holds it open and
 * dismissing it is a plain link.
 *
 * Takes the margin rather than a stored record: `responder_history` is the
 * record now, and the page computes the margin from the row it already read.
 *
 * `RouteModal` takes focus to the dialog, keeps Tab inside it and makes
 * Escape follow the same link (SCRUM-223).
 */
export function ResolvedDialog({
  marginMs,
  confirmDays,
}: {
  marginMs: number | null;
  /**
   * incident_config.auto_close_day: how long an unconfirmed resolve waits
   * before l57's sweeper closes it. NOT confirmation_window_days, which is
   * how long an UNVERIFIED report waits before it expires. The copy used to
   * say 3, which is that other number (SCRUM-191).
   */
  confirmDays: number;
}) {
  return (
    <RouteModal
      closeHref="/responder/pool"
      className="fixed inset-0 z-80 flex items-center justify-center p-3.5"
    >
      <Link
        href="/responder/pool"
        aria-label="Close"
        data-scrim
        className="animate-scrim-in absolute inset-0 bg-gray-900/50"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="resolved-title"
        tabIndex={-1}
        className="animate-sheet-up relative w-full max-w-sm rounded-xl bg-white px-5 py-5.5 text-center shadow-xl"
      >
        <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-800">
          <Check size={28} strokeWidth={2.6} aria-hidden />
        </div>

        <h2 id="resolved-title" className="text-[19px] font-bold text-gray-900">
          {resolvedHeadline(marginMs)}
        </h2>
        {/* "Notified" is true since DB l78 (SCRUM-180): resolve_incident writes
            the citizen a resolution_submitted notice (in-app and email) that
            quotes the same auto_close_day this dialog shows. SCRUM-191 kept
            the word out until it was. */}
        <p className="mt-1.75 text-[13.5px] text-pretty text-gray-500">
          The reporter has been notified and has {confirmDays} days to confirm
          before it closes on its own. If they reject it, the ticket returns to
          the pool with the SLA re-armed.
        </p>

        <Link
          href="/responder/pool"
          className="mt-4.25 flex h-12 w-full items-center justify-center rounded-md bg-lucena-blue text-[15px] font-semibold text-white"
        >
          Back to the pool
        </Link>
      </div>
    </RouteModal>
  );
}
