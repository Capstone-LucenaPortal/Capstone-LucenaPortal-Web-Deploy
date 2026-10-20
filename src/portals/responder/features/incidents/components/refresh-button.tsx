import { RefreshCw } from "lucide-react";
import { refreshPool } from "@/portals/responder/features/incidents/actions";

/**
 * Decision F3: no polling and no Realtime — an explicit refresh instead.
 *
 * A stale pool is the PREMISE, not a defect. First-claim-wins means the list is
 * always a guess and the atomic UPDATE inside `claim_incident` is what is true;
 * a manual control is honest about that in a way silent polling is not. Polling
 * would also spend a field worker's mobile data redrawing a list they are not
 * looking at.
 *
 * A form posting a server action, so it stays a server component.
 */
export function RefreshButton() {
  return (
    <form action={refreshPool}>
      <button
        type="submit"
        className="flex h-7.5 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.75 text-xs font-medium text-gray-900 hover:bg-gray-50"
      >
        <RefreshCw size={13} aria-hidden />
        Refresh
      </button>
    </form>
  );
}
