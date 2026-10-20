"use client";

import { useEffect, useState } from "react";
import { slaProgress } from "@/portals/responder/features/incidents/lib/sla";
import { SLA_TONE, type SlaTone } from "@/portals/responder/features/incidents/lib/tone";
import type { Incident } from "@/portals/responder/features/incidents/types";

/**
 * The clock on the ticket you hold, design L303–312. Tone comes from the same
 * `SLA_TONE` map the pool card uses, so at-risk and late look the same here as
 * they do there.
 *
 * The paused variant keeps the block's shape rather than removing it: the
 * screen reads the same whichever ticket you hold, and PRD §4.1's *no proof,
 * no clock* is stated rather than implied by an absent element.
 *
 * A client component only so it can TICK (SCRUM-191): rendered on the server it
 * moved only when the page did, and the demo read 23h 57m through three minutes
 * of taps. The first paint uses the page's `now`, so server and client agree
 * and there is no hydration mismatch; after that it keeps its own time.
 */

/** The display is whole minutes; 15s keeps it at most a quarter-minute stale. */
const TICK_MS = 15_000;

/** The soft surface behind the numerals, mirroring `report-detail`'s banner. */
const SURFACE: Record<SlaTone, string> = {
  running: "border-blue-100 bg-blue-50",
  at_risk: "border-yellow-100 bg-yellow-50",
  late: "border-red-100 bg-red-50",
};

const LABEL = "text-[11px] font-bold tracking-[0.07em] uppercase";

export function TicketClock({
  incident,
  now,
}: {
  incident: Incident;
  /** The page's instant, used for the first paint. */
  now: Date;
}) {
  const [current, setCurrent] = useState(now);

  useEffect(() => {
    const id = setInterval(() => setCurrent(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const sla = slaProgress(incident, current);

  if (!sla) {
    return (
      <div className="border-b border-gray-200 bg-gray-100 px-4 py-3.5">
        <p className={`${LABEL} text-gray-500`}>SLA paused</p>
        <p className="mt-1 text-[17px] leading-snug font-bold text-pretty text-gray-600">
          Unverified — no clock is running on this one
        </p>
        <p className="mt-1.5 text-[12.5px] text-gray-500">
          Verify on site before you spend the shift on it.
        </p>
      </div>
    );
  }

  const tone = SLA_TONE[sla.tone];

  return (
    <div className={`border-b px-4 py-3.5 ${SURFACE[sla.tone]}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`${LABEL} ${tone.text}`}>
          {sla.overdue ? "Overdue by" : "Time left on the citizen promise"}
        </span>
        <span className={`shrink-0 text-[11.5px] opacity-80 ${tone.text}`}>
          of {sla.window}
        </span>
      </div>

      <p
        className={`mt-0.5 text-[30px] leading-none font-bold tracking-tight tabular-nums ${tone.text}`}
      >
        {sla.remaining}
      </p>

      {/* Decorative — the line above already states the time in words. */}
      <div
        className="mt-2.25 h-1.25 overflow-hidden rounded-full bg-black/8"
        aria-hidden
      >
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${Math.min(sla.percentElapsed, 100)}%` }}
        />
      </div>
    </div>
  );
}
