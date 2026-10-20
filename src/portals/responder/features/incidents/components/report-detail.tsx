import { Clock } from "lucide-react";
import { ClaimButton } from "@/portals/responder/features/incidents/components/claim-button";
import { ReportBody } from "@/portals/responder/features/incidents/components/report-body";
import type { GridPhoto } from "@/portals/responder/features/incidents/components/photo-grid";
import {
  relativeTime,
  slaProgress,
  type SlaProgress,
} from "@/portals/responder/features/incidents/lib/sla";
import {
  levelLabel,
  levelTone,
  UNVERIFIED_TONE,
  VERIFIED_TONE,
  type SlaTone,
} from "@/portals/responder/features/incidents/lib/tone";
import type { Incident } from "@/portals/responder/features/incidents/types";

/**
 * One report — the right-hand pane of the pool: the promise at the top, who
 * reported it, the shared body, and the way to take it.
 */

const PILL = "rounded-full px-2.25 py-0.5 text-[11px] font-semibold";

export function ReportDetail({
  incident,
  now,
  gated,
  heldRef,
  routedTo,
  photos,
}: {
  incident: Incident;
  now: Date;
  gated: boolean;
  /** Only this surface names the held ticket, in its hint line. */
  heldRef: string | null;
  routedTo: string;
  photos: GridPhoto[];
}) {
  const sla = slaProgress(incident, now);

  return (
    <article className="mx-auto max-w-2xl">
      <SlaBanner incident={incident} sla={sla} />

      <header className="border-b border-gray-200 bg-white px-4 pt-4 pb-3.5">
        <div className="mb-2.25 flex items-center gap-1.5">
          <span className={`${PILL} ${levelTone(incident.incident_level)}`}>
            {levelLabel(incident.incident_level)}
          </span>
          <span
            className={`${PILL} font-medium ${incident.is_verified ? VERIFIED_TONE : UNVERIFIED_TONE}`}
          >
            {incident.is_verified ? "Verified" : "Unverified"}
          </span>
          {/* C4 — the reference renders as issued: fifteen characters, not four. */}
          <span className="ml-auto text-[11.5px] tabular-nums text-gray-500">
            {incident.reference_number}
          </span>
        </div>

        <h2 className="text-[21px] leading-tight font-bold text-pretty text-gray-900">
          {incident.type_label}
        </h2>
        <p className="mt-1.5 text-[12.5px] text-gray-500">
          {incident.submitted_at &&
            `Reported ${relativeTime(incident.submitted_at, now)} `}
          by {incident.reporter_first_name} · routed by staff
        </p>
      </header>

      <ReportBody
        incident={incident}
        now={now}
        // Time in THIS pool, not since the report: the header above already
        // says when the citizen filed it (SCRUM-200).
        inPoolValue={
          incident.pooled_at
            ? `${relativeTime(incident.pooled_at, now)} · unclaimed`
            : "unclaimed"
        }
        routedTo={routedTo}
        photos={photos}
      />

      <div className="bg-white px-4 pb-5">
        <ClaimButton
          incidentId={incident.id ?? ""}
          label={incident.is_verified ? "Claim this incident" : "Claim anyway"}
          gated={gated}
          variant="detail"
        />
        <p className="mt-1.75 text-center text-[11.5px] text-gray-500">
          {gated && heldRef
            ? `You're holding ${heldRef}.`
            : "One tap. First claim wins."}
        </p>
      </div>
    </article>
  );
}

const BANNER_TONE: Record<SlaTone, string> = {
  running: "border-blue-100 bg-blue-50 text-blue-800",
  at_risk: "border-yellow-100 bg-yellow-50 text-amber-800",
  late: "border-red-100 bg-red-50 text-red-800",
};

function SlaBanner({
  incident,
  sla,
}: {
  incident: Incident;
  sla: SlaProgress | null;
}) {
  const text = sla
    ? `${levelLabel(incident.incident_level)} · ${sla.remaining} ${sla.overdue ? "past the" : "of the"} ${sla.window} promise`
    : "Unverified — no clock is running on this one";

  return (
    <div
      className={`flex items-center gap-2 border-b px-4 py-2.5 ${
        sla ? BANNER_TONE[sla.tone] : "border-gray-200 bg-gray-100 text-gray-500"
      }`}
    >
      <Clock size={16} className="shrink-0" aria-hidden />
      <span className="text-[12.5px] font-semibold tabular-nums">{text}</span>
    </div>
  );
}
