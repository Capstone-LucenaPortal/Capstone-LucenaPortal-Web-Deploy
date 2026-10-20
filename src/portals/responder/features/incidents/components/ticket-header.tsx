import { Navigation, Phone, PhoneOff } from "lucide-react";
import { levelLabel, levelTone } from "@/portals/responder/features/incidents/lib/tone";
import type { Incident } from "@/portals/responder/features/incidents/types";

/**
 * Who and where, then the two things you do before you touch anything.
 *
 * Navigate and Call are plain links, no JavaScript. PRD §4.3 is explicit that
 * the free-text address is handed to the phone's map app and that no
 * coordinates are stored, so the destination is a search query, not a pin.
 */
const PILL = "rounded-full px-2.25 py-0.5 text-[11px] font-semibold";
const ACTION =
  "flex h-11 flex-1 items-center justify-center gap-1.75 rounded-md text-[14px] font-semibold";

export function TicketHeader({ incident }: { incident: Incident }) {
  const query = encodeURIComponent(
    `${incident.address}, ${incident.barangay_name}, Lucena City`,
  );

  return (
    <header className="border-b border-gray-200 bg-white px-4 pt-3.75 pb-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <span className={`${PILL} ${levelTone(incident.incident_level)}`}>
          {levelLabel(incident.incident_level)}
        </span>
        <span className={`${PILL} bg-blue-100 text-blue-800`}>In progress</span>
        <span className="ml-auto text-[11.5px] tabular-nums text-gray-500">
          {incident.reference_number}
        </span>
      </div>

      <h1 className="text-[19px] leading-tight font-bold text-pretty text-gray-900">
        {incident.type_label}
      </h1>
      {incident.description && (
        <p className="mt-1 text-[13.5px] leading-snug text-pretty text-gray-600">
          {incident.description}
        </p>
      )}
      <p className="mt-1 text-[12.5px] text-gray-500">
        Brgy. {incident.barangay_name} · {incident.address}
      </p>

      <div className="mt-3.25 flex gap-2">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${query}`}
          className={`${ACTION} bg-lucena-blue text-white`}
        >
          <Navigation size={17} aria-hidden />
          Navigate
        </a>
        <CallAction
          phone={incident.reporter_phone}
          reporter={incident.reporter_first_name}
        />
      </div>
    </header>
  );
}

/**
 * ⚠️ `reporter_phone` IS NULLABLE, and a null is not a missing field — it is a
 * MASK. l32 nulls the number on an anonymous report as a security fix, so the
 * app can no longer assume there is a callback number.
 *
 * Decision C5 and story 12: the absence must be SHOWN as an absence. A dead
 * `tel:` link would dial nothing and read as a broken app; an omitted button
 * would read as a page that failed to load. A disabled control with its own
 * words says the thing that is actually true — the citizen chose not to leave a
 * number.
 */
function CallAction({
  phone,
  reporter,
}: {
  phone: string | null;
  reporter: string | null;
}) {
  if (!phone) {
    return (
      <span
        aria-disabled="true"
        title="This citizen reported anonymously and left no callback number."
        className={`${ACTION} cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-600`}
      >
        <PhoneOff size={17} aria-hidden />
        No callback number
      </span>
    );
  }

  // `tel:` wants digits and a leading +, not the spaces the number is stored with.
  const dial = phone.replace(/[^+\d]/g, "");
  const label =
    !reporter || reporter === "Anonymous"
      ? "Call the reporter"
      : `Call ${reporter}`;

  return (
    <a
      href={`tel:${dial}`}
      className={`${ACTION} border border-gray-300 bg-white text-gray-900`}
    >
      <Phone size={17} aria-hidden />
      {label}
    </a>
  );
}
