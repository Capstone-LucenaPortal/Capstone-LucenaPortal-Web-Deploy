import { formatDuration } from "@/portals/responder/features/incidents/lib/sla";
import type {
  Incident,
  IncidentEvent,
  IncidentEventType,
  ProgressStage,
} from "@/portals/responder/features/incidents/types";

/**
 * What is LEFT of the ticket module after the cutover: presentation, and
 * nothing else. `now` is always a parameter — the page reads the clock once and
 * hands the instant in, exactly as `sla.ts` does.
 *
 * WHAT LEFT, and where it went, so nobody re-adds it here:
 *   advanceStage        -> trg_stage_monotonic
 *   addNote's two caps  -> add_incident_note (l22)
 *   addPhoto's cap      -> request_incident_photo_upload's per-cycle limit
 *   canResolve          -> resolve_incident's confirmed-after-photo gate
 *   pushFinished        -> responder_history
 *   WorkState           -> incident_events rows
 *
 * Every one of those was a rule this app could only pretend to enforce. They
 * are now enforced where two responders and the Staff portal can all see them.
 */

/** The order is the rule: you may skip ahead, never back (trg_stage_monotonic). */
export const STAGE_ORDER: ProgressStage[] = [
  "stage_en_route",
  "stage_on_site",
  "stage_working",
];

export const STAGE_LABEL: Record<ProgressStage, string> = {
  stage_en_route: "En route",
  stage_on_site: "On site",
  stage_working: "Working",
};

/**
 * A timeline note is a fact, not a report.
 *
 * ⚠️ THESE MIRROR add_incident_note BY AGREEMENT, NOT BY READING. Both caps are
 * hardcoded INSIDE that function (l22) — they are not in incident_config and not
 * on any view, so there is nothing a responder could read. If the RPC's limits
 * change, these must be changed by hand, and the RPC is the one that wins: it
 * raises, and notice.ts maps the raise to `note_limit`.
 */
export const NOTE_MAX_LENGTH = 140;
export const MAX_NOTES = 20;

/**
 * Index into `STAGE_ORDER` of the furthest stage reached, or -1 for none.
 *
 * Successor to currentStageIndex. Its one surviving job is telling StageTracker
 * which pills are done; the monotonicity it used to enforce is a trigger now.
 */
export function furthestStage(events: IncidentEvent[]): number {
  let index = -1;
  events.forEach((e) => {
    const at = STAGE_ORDER.indexOf(e.event_type as ProgressStage);
    if (at > index) index = at;
  });
  return index;
}

export interface TimelineEntry {
  at: string;
  title: string;
  meta: string;
}

/**
 * Lucena is UTC+8 and the Philippines has never observed DST, so the wall clock
 * is a fixed offset. Hand-rolled rather than `Intl` on purpose: the output must
 * not change with the machine's timezone or with an ICU version that swaps the
 * space before AM/PM for U+202F.
 */
const MANILA_OFFSET_MS = 8 * 60 * 60_000;

export function timeOfDay(iso: string): string {
  const local = new Date(Date.parse(iso) + MANILA_OFFSET_MS);
  const hours24 = local.getUTCHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(local.getUTCMinutes()).padStart(2, "0");

  return `${hours12}:${minutes} ${hours24 < 12 ? "AM" : "PM"}`;
}

/**
 * Every event the shared timeline can carry, not only the ones this app writes.
 * A responder sees the citizen's submission and staff's routing on the same
 * thread as their own taps — that shared thread is the point of the cutover.
 */
const EVENT_LABEL: Record<IncidentEventType, string> = {
  submitted: "Reported by the citizen",
  verified: "Verified by staff",
  routed: "Routed to your department",
  rerouted: "Re-routed by staff",
  claimed: "Claimed",
  stage_en_route: "En route",
  stage_on_site: "On site",
  stage_working: "Working",
  note: "Note",
  photo_added: "After photo added",
  released: "Released back to the pool",
  force_released: "Returned to the pool by a supervisor",
  rejected: "Sent back to staff",
  resolved: "Resolved",
  confirmed: "Confirmed by the citizen",
  reopened: "Reopened by the citizen",
  closed: "Closed",
  expired: "Confirmation window expired",
  nudged: "Citizen nudged",
};

/**
 * The timeline, straight from `responder_incident_events`.
 *
 * READ, not derived. `claimed` is a real row now, so nothing is synthesised —
 * which is what makes this the same thread the Staff portal reads. The old
 * version built it from a cookie and had to invent the claim entry; that entry
 * existed on exactly one screen, for one person, and vanished on sign-out.
 *
 * `actor_name` comes from the row rather than from the session, so a supervisor's
 * force-release and a colleague's earlier work name the person who did it.
 *
 * Ordered by the query (created_at ascending). Chronological, oldest first: the
 * screen above it is a forward narrative ("Progress · tap as you go") and the
 * connector line reads as the job proceeding, not as a feed.
 */
export function buildTimeline(events: IncidentEvent[]): TimelineEntry[] {
  return events
    .filter((event) => event.created_at !== null)
    .map((event) => {
      const at = event.created_at!;
      const label = event.event_type
        ? EVENT_LABEL[event.event_type]
        : "Updated";

      // A note IS its text — the label would push the only content it carries
      // into the meta line, where the design renders it at 11.5px grey.
      const isNote = event.event_type === "note" && event.note;

      return {
        at,
        title: isNote ? event.note! : label,
        // PRD §5: the audit trail always names one accountable person.
        meta: [
          timeOfDay(at),
          event.actor_name,
          isNote ? "Note" : (!isNote && event.note) || null,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    });
}

/** Milliseconds left on the promise. Negative when late, null when unverified. */
export function slaMarginMs(incident: Incident, now: Date): number | null {
  if (incident.sla_due_at === null) return null;

  return Date.parse(incident.sla_due_at) - now.getTime();
}

/** The resolved dialog's headline, in its early, late, and unverified forms. */
export function resolvedHeadline(marginMs: number | null): string {
  if (marginMs === null) return "Resolved — no SLA was running";
  if (marginMs < 0) return `Resolved ${formatDuration(-marginMs)} over`;

  return `Resolved with ${formatDuration(marginMs)} to spare`;
}
