import { MapPin, TriangleAlert } from "lucide-react";
import {
  PhotoGrid,
  type GridPhoto,
} from "@/portals/responder/features/incidents/components/photo-grid";
import { slaProgress } from "@/portals/responder/features/incidents/lib/sla";
import type { Incident } from "@/portals/responder/features/incidents/types";

/**
 * The read-only half of a report — photos, description, location, details.
 * Shared by the pool's detail pane and by the ticket you hold, so the two can
 * never drift apart.
 *
 * `inPoolValue` is passed in rather than derived: a claimed ticket is not
 * "unclaimed", and no component should have to infer which surface it is on.
 */

const SECTION = "border-b border-gray-200 bg-white px-4 py-3.5";
const LABEL =
  "text-[11px] font-bold tracking-[0.07em] uppercase text-gray-500";

export function ReportBody({
  incident,
  now,
  inPoolValue,
  routedTo,
  photos,
}: {
  incident: Incident;
  now: Date;
  inPoolValue: string;
  /** The department this report was routed to, from the reader's session. */
  routedTo: string;
  /**
   * The citizen's evidence, already signed by the page. Visible BEFORE
   * claiming — that is the whole point of l56c widening the read gate, and it
   * is what lets a responder judge whether a job is theirs before taking it.
   */
  photos: GridPhoto[];
}) {
  const sla = slaProgress(incident, now);
  const photoCount = incident.before_photo_count ?? 0;

  return (
    <>
      <section className={SECTION}>
        <h3 className={`${LABEL} mb-2.25`}>
          {incident.is_verified
            ? `Citizen photos (${photoCount})`
            : "Citizen photos"}
        </h3>
        {/* ⚠️ TWO DIFFERENT ABSENCES, AND ONLY ONE OF THEM IS A WARNING.
            "No photo" and "no clock" are independent: a report can be verified,
            clocked and photoless all at once. Keyed to photoCount alone, this
            told a responder the clock was paused on a card whose own header
            read "6h 15m past the 4h promise" (issue #7).

            ⚠️ IT KEYS ON `sla`, NOT is_verified -- sla.ts: "Keying off
            is_verified instead would let the two disagree about whether there
            is a deadline". A verified row whose SLA never armed (null
            sla_armed_at, or a non-positive window) would claim a running clock
            here while the Details row below renders "Paused until verified":
            the same contradiction, inverted. `sla` is the one answer to "is
            there a deadline", and line 113 already asks it that way.
            PRD §5 suspends the clock while unverified; §6 arms it at
            max(route, verify). */}
        {photoCount > 0 ? (
          <PhotoGrid photos={photos} alt="Citizen photo" />
        ) : sla ? (
          <p className="rounded-md bg-gray-50 px-3 py-2.75 text-[12.5px] text-gray-500">
            No citizen photo on this report. Staff verified it from the
            description, and its SLA clock is running.
          </p>
        ) : (
          <p className="flex gap-2.25 rounded-md bg-yellow-50 px-3 py-2.75 text-[12.5px] text-amber-800">
            <TriangleAlert size={17} className="mt-px shrink-0" aria-hidden />
            No citizen photo. This report is unverified — the SLA clock is
            paused and it may not be real.
          </p>
        )}
      </section>

      <section className={SECTION}>
        <h3 className={`${LABEL} mb-1.75`}>Description</h3>
        <p className="text-[14.5px] leading-relaxed text-pretty text-gray-900">
          {incident.description}
        </p>
      </section>

      <section className={SECTION}>
        <h3 className={`${LABEL} mb-2.25`}>Location</h3>
        <div className="flex gap-2.5">
          <MapPin
            size={19}
            className="mt-0.5 shrink-0 text-lucena-blue"
            aria-hidden
          />
          <div>
            <p className="text-[14.5px] font-semibold text-gray-900">
              {incident.address}
            </p>
            <p className="mt-0.5 text-[12.5px] text-gray-500">
              {/* C6 — "Brgy." belongs to the component, not to the column. */}
              Brgy. {incident.barangay_name}, Lucena City
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-3.5">
        <h3 className={`${LABEL} mb-2.75`}>Details</h3>
        <dl className="flex flex-col gap-2.75">
          <Fact label="Reporter" value={incident.reporter_first_name} />
          <Fact label="Category" value={incident.category_label} />
          <Fact label="Routed to" value={routedTo} />
          <Fact
            label="SLA target"
            // Armed at routing, not at claim, and it survives a release
            // (PRD §6, §4.5).
            value={sla ? `${sla.window} from routing` : "Paused until verified"}
          />
          {/* The row label stays "In pool" on both surfaces; only its value
              differs, per spec §7.4. */}
          <Fact label="In pool" value={inPoolValue} />
        </dl>
      </section>
    </>
  );
}

/**
 * A null value renders an em dash rather than an empty cell: every column on a
 * view row is nullable in the generated types, and a blank `dd` reads as a
 * failure to load rather than as an absence.
 */
function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-[12.5px] text-gray-500">{label}</dt>
      <dd className="text-[13.5px] font-medium text-gray-900">
        {value ?? "—"}
      </dd>
    </div>
  );
}
