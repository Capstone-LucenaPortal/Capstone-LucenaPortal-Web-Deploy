import { Check } from "lucide-react";
import { EmptyState } from "@/portals/responder/components/ui/empty-state";
import { PoolCard } from "@/portals/responder/features/incidents/components/pool-card";
import type { Incident, IncidentLevel } from "@/portals/responder/features/incidents/types";
import { cn } from "@/portals/responder/lib/utils";

/**
 * The pool, split the way PRD §4.1 asks for it: verified work with a running
 * clock first, proofless reports flagged at the bottom.
 *
 * Sorting lives here rather than in the seed so the seed array stays readable
 * as a table and the ordering rule can be tested on its own.
 */

const LEVEL_RANK: Record<IncidentLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Higher Level first, then longest-waiting first — of two Criticals, the one
 * that has been sitting for five hours is the more urgent.
 *
 * "Waiting" is the CITIZEN's wait, so the tie-break stays on `submitted_at`
 * even though the card's age is `pooled_at` (SCRUM-200). Time in the pool
 * would send a released ticket to the back of its level, punishing the
 * reporter for a responder handing the work back. The cost: a card reading
 * "2m ago" can sit above one reading "5m ago" at the same level.
 *
 * Decision C7 keeps this in the app rather than in the view: it is presentation
 * over a small result set, and an ORDER BY in the view would make the pool's
 * ordering a schema change.
 */
export function sortPool(incidents: Incident[]): Incident[] {
  const rank = (level: Incident["incident_level"]) =>
    level ? LEVEL_RANK[level] : LEVEL_RANK.low;
  const waited = (at: string | null) => (at ? Date.parse(at) : 0);

  return [...incidents].sort(
    (a, b) =>
      rank(a.incident_level) - rank(b.incident_level) ||
      waited(a.submitted_at) - waited(b.submitted_at),
  );
}

export function PoolList({
  incidents,
  now,
  gated,
}: {
  incidents: Incident[];
  now: Date;
  gated: boolean;
}) {
  if (incidents.length === 0) {
    return (
      <EmptyState
        icon={Check}
        tone="positive"
        title="Pool is clear"
        // A phone alert reaches only on-duty responders who turned it on for
        // this device (ADR 0001), so this promises
        // none. A notification still lands in the Inbox.
        description="Nothing routed to your department right now. New reports land in your notifications — refresh to check."
        className="py-16"
      />
    );
  }

  const verified = sortPool(incidents.filter((i) => i.is_verified));
  const unverified = sortPool(incidents.filter((i) => !i.is_verified));

  return (
    <div className="pb-5">
      {verified.length > 0 && (
        <SectionHeader dot="bg-green-800" className="text-gray-500">
          Verified · SLA running
        </SectionHeader>
      )}
      {verified.map((incident) => (
        <PoolCard key={incident.id} incident={incident} now={now} gated={gated} />
      ))}

      {unverified.length > 0 && (
        <SectionHeader
          dot="bg-gray-400"
          className="mt-1.5 border-t border-gray-200 text-gray-500"
        >
          Unverified · no proof, SLA paused
        </SectionHeader>
      )}
      {unverified.map((incident) => (
        <PoolCard key={incident.id} incident={incident} now={now} gated={gated} />
      ))}
    </div>
  );
}

function SectionHeader({
  dot,
  className,
  children,
}: {
  dot: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      className={cn(
        "flex items-center gap-1.75 px-4 pt-3.5 pb-2 text-[11px] font-bold tracking-[0.07em] uppercase",
        className,
      )}
    >
      <span className={cn("h-1.75 w-1.75 rounded-full", dot)} aria-hidden />
      {children}
    </h2>
  );
}
