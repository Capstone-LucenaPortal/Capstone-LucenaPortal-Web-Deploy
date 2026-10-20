import Link from "next/link";
import { Camera, Check, ImageOff, MapPin } from "lucide-react";
import { ClaimButton } from "@/portals/responder/features/incidents/components/claim-button";
import {
  levelLabel,
  levelTone,
  SLA_TONE,
  UNVERIFIED_TONE,
  VERIFIED_TONE,
} from "@/portals/responder/features/incidents/lib/tone";
import { relativeTime, slaProgress } from "@/portals/responder/features/incidents/lib/sla";
import type { Incident } from "@/portals/responder/features/incidents/types";

/**
 * One incident in the pool. The two variants are far enough apart — different
 * border, different pills, clock vs. no clock — that branching inside one JSX
 * tree would read worse than two small components.
 *
 * The Claim button sits outside the card's link rather than inside it: a form
 * nested in an anchor cannot be submitted.
 *
 * ⚠️ THE HEADLINE IS `type_label` AND THE DESCRIPTION SITS UNDER IT (C2).
 * There is no title column and there will not be one — the citizen submission
 * RPC takes a type code and free text, so nothing could write one. The type
 * label alone produces three "Damaged road" cards distinguishable only by
 * barangay, and the headline stops being what a responder reads. The card is
 * therefore TALLER than the approved mockup; that is the accepted cost, and the
 * sandbox seed has a deliberate same-type pair to prove it.
 *
 * The age in the corner is time in THIS pool (`pooled_at`), not since the
 * citizen filed it — staff triage is not the responder's wait, and a released
 * ticket starts over (SCRUM-200). It agrees with the report pane's "In pool".
 * No `pooled_at`, no age: falling back to `submitted_at` is the bug.
 */
export function PoolCard({
  incident,
  now,
  gated,
}: {
  incident: Incident;
  now: Date;
  gated: boolean;
}) {
  return incident.is_verified ? (
    <VerifiedCard incident={incident} now={now} gated={gated} />
  ) : (
    <UnverifiedCard incident={incident} now={now} gated={gated} />
  );
}

const PILL =
  "rounded-full px-2.25 py-0.5 text-[11px] font-semibold whitespace-nowrap";

function VerifiedCard({
  incident,
  now,
  gated,
}: {
  incident: Incident;
  now: Date;
  gated: boolean;
}) {
  const sla = slaProgress(incident, now);
  const photos = incident.before_photo_count ?? 0;

  return (
    <article className="mx-3 mb-2.5 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <Link href={`/responder/pool?report=${incident.id}`} className="block px-3.5 pt-3.25">
        <div className="mb-2.25 flex items-center gap-1.5">
          <span className={`${PILL} ${levelTone(incident.incident_level)}`}>
            {levelLabel(incident.incident_level)}
          </span>
          <span
            className={`${PILL} inline-flex items-center gap-1 font-medium ${VERIFIED_TONE}`}
          >
            <Check size={11} strokeWidth={3} aria-hidden />
            Verified
          </span>
          {incident.pooled_at && (
            <span className="ml-auto text-[11px] tabular-nums text-gray-500">
              {relativeTime(incident.pooled_at, now)}
            </span>
          )}
        </div>

        <h3 className="text-[16px] leading-snug font-semibold text-pretty text-gray-900">
          {incident.type_label}
        </h3>

        {/* C2 — what makes two same-type cards tellable apart. */}
        {incident.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-pretty text-gray-600">
            {incident.description}
          </p>
        )}

        <p className="mt-1.25 flex items-center gap-1.5 text-gray-500">
          <MapPin size={14} className="shrink-0" aria-hidden />
          {/* C6 — "Brgy." is the component's word, not the database's. */}
          <span className="truncate text-[12.5px]">
            Brgy. {incident.barangay_name} · {incident.address}
          </span>
        </p>

        {/* A chip, not an image-sized box: the card shows no photo, and a grey
            box with an image icon read as one that had failed to load
            (SCRUM-193). The photos themselves are in the report pane. */}
        {photos > 0 && (
          <p className="mt-2.5">
            <span
              className={`${PILL} inline-flex items-center gap-1 bg-gray-100 font-medium text-gray-700`}
            >
              <Camera size={12} strokeWidth={2.2} aria-hidden />
              {photos === 1 ? "1 photo" : `${photos} photos`}
            </span>
          </p>
        )}

        {sla && (
          <div className="pt-2.75">
            <div className="mb-1.25 flex items-center justify-between">
              <span
                className={`text-[11.5px] font-semibold tabular-nums ${SLA_TONE[sla.tone].text}`}
              >
                {sla.remaining} {sla.overdue ? "overdue" : "left"}
              </span>
              <span className="text-[11px] text-gray-500">
                {sla.window} target
              </span>
            </div>
            {/* Decorative — the line above already states the time in words. */}
            <div
              className="h-1 overflow-hidden rounded-full bg-gray-100"
              aria-hidden
            >
              <div
                className={`h-full rounded-full ${SLA_TONE[sla.tone].bar}`}
                style={{ width: `${Math.min(sla.percentElapsed, 100)}%` }}
              />
            </div>
          </div>
        )}
      </Link>

      <div className="px-3.5 pt-3 pb-3.25">
        <ClaimButton
          incidentId={incident.id ?? ""}
          label="Claim"
          gated={gated}
          variant="card"
        />
      </div>
    </article>
  );
}

function UnverifiedCard({
  incident,
  now,
  gated,
}: {
  incident: Incident;
  now: Date;
  gated: boolean;
}) {
  return (
    <article className="mx-3 mb-2.5 overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white">
      <Link href={`/responder/pool?report=${incident.id}`} className="block px-3.5 pt-3.25">
        <div className="mb-2.25 flex items-center gap-1.5">
          <span className={`${PILL} bg-gray-100 text-gray-800`}>Reported</span>
          <span
            className={`${PILL} inline-flex items-center gap-1 font-medium ${UNVERIFIED_TONE}`}
          >
            <ImageOff size={11} aria-hidden />
            No photo
          </span>
          {incident.pooled_at && (
            <span className="ml-auto text-[11px] tabular-nums text-gray-500">
              {relativeTime(incident.pooled_at, now)}
            </span>
          )}
        </div>

        <h3 className="text-[16px] leading-snug font-semibold text-pretty text-gray-500">
          {incident.type_label}
        </h3>

        {incident.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-pretty text-gray-500">
            {incident.description}
          </p>
        )}

        <p className="mt-1.25 flex items-center gap-1.5 text-gray-500">
          <MapPin size={14} className="shrink-0" aria-hidden />
          <span className="truncate text-[12.5px]">
            Brgy. {incident.barangay_name} · {incident.address}
          </span>
        </p>

        <p className="mt-2.5 text-[11.5px] text-gray-500">
          No clock running — verify on site before you spend the shift on it.
        </p>
      </Link>

      <div className="px-3.5 pt-3 pb-3.25">
        <ClaimButton
          incidentId={incident.id ?? ""}
          label="Claim anyway"
          gated={gated}
          variant="card-outline"
        />
      </div>
    </article>
  );
}
