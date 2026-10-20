import type { Incident } from "@/portals/responder/features/incidents/types";
import { slaToneFor, type SlaTone } from "@/portals/responder/features/incidents/lib/tone";

/**
 * Time arithmetic for the pool. Every function takes `now` rather than reading
 * the clock, so one page render shares a single instant and a test can pin it.
 *
 * This module produces numbers and duration strings only. What a number *means*
 * — at risk, late — stays in `tone.ts`, which also owns the colours.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now" · "8m ago" · "2h ago" · "3d ago" */
export function relativeTime(iso: string, now: Date): string {
  const elapsed = now.getTime() - Date.parse(iso);

  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  return `${Math.floor(elapsed / DAY)}d ago`;
}

export interface SlaProgress {
  /** May exceed 100 when late. Callers that draw a bar clamp it themselves. */
  percentElapsed: number;
  tone: SlaTone;
  overdue: boolean;
  /** Bare magnitude of time left, or of time past due: "3h 52m", "55m". */
  remaining: string;
  /** The promise itself, always whole hours: "4h", "24h", "72h". */
  window: string;
}

/**
 * `null` means no clock is running.
 *
 * Both timestamps are required. Keying off `is_verified` instead would let the
 * two disagree about whether there is a deadline, and `sla_due_at` alone would
 * leave `total` unknowable.
 */
export function slaProgress(incident: Incident, now: Date): SlaProgress | null {
  if (incident.sla_due_at === null || incident.sla_armed_at === null) {
    return null;
  }

  // ⚠️ ARMED, NOT SUBMITTED. The promise starts at max(routed_at, verified_at)
  // -- inc_arm_sla, l12b. Measuring from submitted_at draws an incident that sat
  // unverified for two days as already breached the moment it is verified.
  const armedAt = Date.parse(incident.sla_armed_at);
  const dueAt = Date.parse(incident.sla_due_at);
  const total = dueAt - armedAt;
  if (total <= 0) return null;

  const remainingMs = dueAt - now.getTime();
  const percentElapsed = Math.round(((now.getTime() - armedAt) / total) * 100);

  return {
    percentElapsed,
    tone: slaToneFor(percentElapsed),
    overdue: remainingMs < 0,
    remaining: formatDuration(Math.abs(remainingMs)),
    window: `${Math.round(total / HOUR)}h`,
  };
}

/**
 * "55m" · "3h 52m" · "4h" · "2d 18h" · "54d" — each unit is dropped once it
 * lands on the next one up.
 *
 * Past a day it counts days and hours and stops counting minutes: a ticket
 * eight weeks late read "1300h 49m overdue", which nobody reads as eight weeks
 * (SCRUM-193). Days are floored, like `relativeTime`'s.
 */
export function formatDuration(ms: number): string {
  if (ms >= DAY) {
    const days = Math.floor(ms / DAY);
    const hours = Math.floor((ms % DAY) / HOUR);
    return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
  }

  const totalMinutes = Math.floor(ms / MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
