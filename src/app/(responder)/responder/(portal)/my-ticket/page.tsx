import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/portals/responder/components/ui/empty-state";
import { AddPhotoSheet } from "@/portals/responder/features/incidents/components/add-photo-sheet";
import { AfterPhotos } from "@/portals/responder/features/incidents/components/after-photos";
import { NoteForm } from "@/portals/responder/features/incidents/components/note-form";
import { NoticeBanner } from "@/portals/responder/features/incidents/components/notice-banner";
import { RejectSheet } from "@/portals/responder/features/incidents/components/reject-sheet";
import { ReleaseSheet } from "@/portals/responder/features/incidents/components/release-sheet";
import { StageTracker } from "@/portals/responder/features/incidents/components/stage-tracker";
import { TicketActions } from "@/portals/responder/features/incidents/components/ticket-actions";
import { TicketClock } from "@/portals/responder/features/incidents/components/ticket-clock";
import { TicketHeader } from "@/portals/responder/features/incidents/components/ticket-header";
import { TicketTimeline } from "@/portals/responder/features/incidents/components/ticket-timeline";
import type { GridPhoto } from "@/portals/responder/features/incidents/components/photo-grid";
import {
  getHeldTicket,
  getIncidentConfig,
  getPhotos,
  getPhotoUrl,
  getTimeline,
} from "@/portals/responder/features/incidents/lib/data";
import { slaProgress } from "@/portals/responder/features/incidents/lib/sla";
import { buildTimeline } from "@/portals/responder/features/incidents/lib/work";

export const metadata = { title: "My ticket · LucenaPortal Responder" };

/**
 * The one ticket a responder may hold at a time (PRD §4.2), and the place the
 * work on it happens (§4.3–§4.5).
 *
 * A server component throughout. Every tap below is a form post that calls one
 * RPC and re-renders — a round trip per tap, which is the honest model: every
 * one of them lands on `incident_events`, which the Staff portal reads, so
 * nothing here should feel like local state.
 *
 * The sheets are driven by `?sheet=`, extending the `?report=` convention the
 * pool already uses, so no client state holds one open.
 */
export default async function MyTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ sheet?: string; notice?: string }>;
}) {
  const { sheet, notice } = await searchParams;

  // One clock for the whole page.
  const now = new Date();
  const incident = await getHeldTicket();

  if (!incident?.id) {
    return (
      // ⚠️ THE EMPTY STATE RENDERS THE NOTICE TOO — decision E3, and this is the
      // specific mistake it names. The case that drives it: a supervisor
      // force-releases the ticket, so by the time the responder's next tap
      // lands there is nothing to render the notice ON. Attaching the banner
      // only to the ticket screen below would show a blank empty state
      // mid-shift with no explanation of where the ticket went.
      //
      // No `heldRef` here — there is no held row. That is also what silences
      // `blocked` on this branch, in notice.ts rather than in a test here
      // (issue #9).
      <div className="flex h-full flex-col">
        <NoticeBanner code={notice} />
        <EmptyState
          icon={ClipboardList}
          tone="info"
          title="No active ticket"
          description="You can hold one claim at a time. Pick one up from the pool and it lands here."
          className="py-20"
          action={
            <Link
              href="/responder/pool"
              className="inline-flex h-11 items-center rounded-md bg-lucena-blue px-5 text-[14.5px] font-semibold text-white hover:bg-lucena-blue-dark"
            >
              Open the pool
            </Link>
          }
        />
      </div>
    );
  }

  const [events, photoRows, config] = await Promise.all([
    getTimeline(incident.id),
    getPhotos(incident.id, "after"),
    getIncidentConfig(),
  ]);

  // Signed here, not in the component — Seam 2. 60-second URLs, so there is
  // nothing worth caching.
  const photos: GridPhoto[] = await Promise.all(
    photoRows.map(async (row) => ({
      id: row.id ?? "",
      url: row.id ? await getPhotoUrl(row.id) : null,
    })),
  );

  const entries = buildTimeline(events);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl">
          {/* The held reference is read off the row, not the URL — issue #8. A
              refused claim has to say WHICH ticket is in the way, and the page
              that renders the refusal is the page holding the answer. */}
          <NoticeBanner code={notice} heldRef={incident.reference_number} />
          <TicketClock incident={incident} now={now} />
          <TicketHeader incident={incident} />

          <section className="border-b border-gray-200 bg-white px-4 py-3.75">
            <h2 className="mb-2.75 text-[11px] font-bold tracking-[0.07em] uppercase text-gray-500">
              Progress · tap as you go
            </h2>
            <StageTracker events={events} incidentId={incident.id} />
            <NoteForm incidentId={incident.id} />
          </section>

          <AfterPhotos
            photos={photos}
            // Story 34, and D1's one readable limit: 3, not the 6 the app used
            // to allow. The grid is one row now.
            maxPhotos={config.max_photos_per_cycle ?? 3}
            incidentId={incident.id}
          />
          <TicketTimeline entries={entries} />
          <div className="h-3" />
        </div>
      </div>

      <TicketActions incidentId={incident.id} ready={photos.length > 0} />

      {sheet === "photo" && (
        <AddPhotoSheet closeHref="/responder/my-ticket" incidentId={incident.id} />
      )}
      {sheet === "release" && (
        <ReleaseSheet
          closeHref="/responder/my-ticket"
          remaining={slaProgress(incident, now)?.remaining ?? null}
          incidentId={incident.id}
        />
      )}
      {sheet === "reject" && (
        <RejectSheet closeHref="/responder/my-ticket" incidentId={incident.id} />
      )}
    </div>
  );
}
