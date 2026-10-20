import Link from "next/link";
import { ArrowLeft, Filter, Inbox } from "lucide-react";
import { EmptyState } from "@/portals/responder/components/ui/empty-state";
import { PhoneAlertsBanner } from "@/portals/responder/features/alerts/components/phone-alerts";
import { getCurrentResponder } from "@/portals/responder/features/auth/lib/session";
import { ActiveClaimBanner } from "@/portals/responder/features/incidents/components/active-claim-banner";
import { LostRaceDialog } from "@/portals/responder/features/incidents/components/lost-race-dialog";
import { MarkArrivalRead } from "@/portals/responder/features/incidents/components/mark-arrival-read";
import { NoticeBanner } from "@/portals/responder/features/incidents/components/notice-banner";
import { OffDutyBanner } from "@/portals/responder/features/incidents/components/off-duty-banner";
import { PoolList, sortPool } from "@/portals/responder/features/incidents/components/pool-list";
import { RefreshButton } from "@/portals/responder/features/incidents/components/refresh-button";
import { ReportDetail } from "@/portals/responder/features/incidents/components/report-detail";
import { ResolvedDialog } from "@/portals/responder/features/incidents/components/resolved-dialog";
import type { GridPhoto } from "@/portals/responder/features/incidents/components/photo-grid";
import {
  getHistory,
  getHeldTicket,
  getIncident,
  getIncidentConfig,
  getPhotos,
  getPhotoUrl,
  getPool,
} from "@/portals/responder/features/incidents/lib/data";
import { cn } from "@/portals/responder/lib/utils";

export const metadata = { title: "Pool · LucenaPortal Responder" };

/**
 * The department pool — unclaimed incidents routed to my department, verified
 * and higher-Level first (PRD §4.1).
 *
 * Selection lives in the URL (`?report=<id>`) rather than in state, so the
 * detail pane is linkable and the page stays a server component. `?lost=<name>`
 * and `?notice=<code>` extend the same convention: an outcome is a URL, not
 * client state holding a modal open.
 *
 * ⚠️ NO DEPARTMENT FILTER IS APPLIED HERE. `responder_incidents` self-scopes to
 * the caller's department through `staff_accounts`. Adding `.eq()` on a column
 * whose name has changed would silently return nothing.
 */
export default async function PoolPage({
  searchParams,
}: {
  searchParams: Promise<{
    report?: string;
    lost?: string;
    resolved?: string;
    notice?: string;
  }>;
}) {
  const { report, lost, resolved, notice } = await searchParams;

  // One clock for the whole page, so every card agrees what time it is.
  const now = new Date();
  const [pool, held, responder] = await Promise.all([
    getPool(),
    getHeldTicket(),
    getCurrentResponder(),
  ]);

  // C7: presentation, not schema.
  const incidents = sortPool(pool);

  // ⚠️ getIncident(), not a lookup in `pool`. A responder must be able to open a
  // report they have just LOST, and the incident they HOLD is not in the pool at
  // all — looking either up in the list would 404 both.
  const selected = report ? await getIncident(report) : null;

  // The citizen's evidence, BEFORE claiming. This is the whole point of l56c:
  // responder_incident_photos admits an incident in my department even when I
  // have no event on it, so a responder can judge whether a job is theirs
  // before taking it.
  const photos = selected?.id ? await signedPhotos(selected.id) : [];

  const [finished, config] = resolved
    ? await Promise.all([mostRecentlyResolved(), getIncidentConfig()])
    : [null, null];

  return (
    <div className="relative flex h-full">
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col md:max-w-100 md:flex-none md:border-r md:border-gray-200",
          selected && "hidden md:flex",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2.75">
          <h1 className="text-sm font-semibold text-gray-900">
            {incidents.length} waiting in pool
          </h1>
          <div className="flex items-center gap-1.5">
            <RefreshButton />
            <button
              type="button"
              disabled /* ← later: barangay filter */
              className="flex h-7.5 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.75 text-xs font-medium text-gray-900 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
            >
              <Filter size={14} aria-hidden />
              Barangay
            </button>
          </div>
        </div>

        <NoticeBanner code={notice} />
        {held?.reference_number && (
          <ActiveClaimBanner heldRef={held.reference_number} />
        )}
        <OffDutyBanner />
        <PhoneAlertsBanner />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <PoolList incidents={incidents} now={now} gated={held !== null} />
        </div>
      </div>

      <div
        className={cn(
          "min-w-0 flex-1 flex-col bg-gray-50",
          selected ? "flex" : "hidden md:flex",
        )}
      >
        {selected ? (
          <>
            {selected.id && <MarkArrivalRead incidentId={selected.id} />}
            <div className="shrink-0 border-b border-gray-200 bg-white px-2 py-2 md:hidden">
              <Link
                href="/responder/pool"
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-gray-900"
              >
                <ArrowLeft size={17} aria-hidden />
                Back to pool
              </Link>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ReportDetail
                incident={selected}
                now={now}
                gated={held !== null}
                heldRef={held?.reference_number ?? null}
                routedTo={responder.department_label}
                photos={photos}
              />
            </div>
          </>
        ) : (
          <EmptyState
            icon={Inbox}
            title="Pick a report from the pool"
            description="Open one to see the citizen's photos, the full address, and how much of its SLA is left."
            className="m-auto"
          />
        )}
      </div>

      {/* The winner's name comes straight from the URL — an unrecognised value
          renders a dialog naming whoever the RPC said, and an empty one renders
          nothing rather than a dialog naming nobody. */}
      {lost && <LostRaceDialog rivalName={lost} />}
      {finished && (
        <ResolvedDialog
          marginMs={finished.marginMs}
          // l09's default. Read from config rather than written into the copy,
          // which is how the dialog came to say 3 (SCRUM-191).
          confirmDays={config?.auto_close_day ?? 7}
        />
      )}
    </div>
  );
}

/**
 * The citizen's photos for one incident, signed.
 *
 * Two hops per photo, both of which re-check entitlement — the view hands over
 * ids only, never a storage path, because a raw path would be a second,
 * unaudited route to the object (l34/l52/l53).
 *
 * Signed URLs last 60 seconds, which is fine for a server-rendered page and is
 * why they are not cached. Resolved in parallel: three round trips in sequence
 * would be visible on a field worker's connection.
 */
async function signedPhotos(incidentId: string): Promise<GridPhoto[]> {
  const rows = await getPhotos(incidentId, "before");

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id ?? "",
      url: row.id ? await getPhotoUrl(row.id) : null,
    })),
  );
}

/**
 * The margin on the ticket just resolved, for the dialog's headline.
 *
 * Read from `responder_history` rather than carried in the URL: the database
 * owns both timestamps, and a margin in a query string is a number a responder
 * could edit to claim they made a window they missed. Only read when
 * `?resolved=` is present, so the ordinary pool render is unaffected.
 *
 * ⚠️ The two nulls are DIFFERENT and must not collapse into one. An outer null
 * means "no such row, render no dialog"; an inner `marginMs: null` means "the
 * ticket carried no clock", which is a headline of its own ("Resolved — no SLA
 * was running"). Returning a bare number|null would silently drop the dialog on
 * every unverified resolve.
 */
async function mostRecentlyResolved(): Promise<{
  marginMs: number | null;
} | null> {
  const row = (await getHistory()).find(
    (r) => r.my_last_outcome === "resolved" && r.resolved_at !== null,
  );
  if (!row) return null;

  return {
    marginMs: row.sla_due_at
      ? Date.parse(row.sla_due_at) - Date.parse(row.resolved_at!)
      : null,
  };
}
