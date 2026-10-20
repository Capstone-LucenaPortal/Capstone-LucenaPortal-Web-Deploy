import type { IncidentLevel } from "@/portals/responder/features/incidents/types";

/**
 * Semantic colour sets live here rather than in `@theme` so TypeScript can
 * check them: adding a level to `IncidentLevel` without a tone is a compile
 * error, not a silently unstyled badge.
 */

/** Incident Level pill on the pool card, detail pane, and history row. */
export const LEVEL_TONE: Record<IncidentLevel, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-amber-100 text-amber-800",
  medium: "bg-blue-100 text-blue-800",
  low: "bg-gray-100 text-gray-700",
};

export const LEVEL_LABEL: Record<IncidentLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Every column on a view row is nullable in the generated types — Postgres does
 * not carry a base table's NOT NULL through a view. `incident_level` is in fact
 * NOT NULL on `incidents`, so these fall back rather than assert: an
 * unclassified pill is a visible oddity, where a `!` would be a crash on a row
 * the database says cannot exist.
 */
export function levelTone(level: IncidentLevel | null): string {
  return level ? LEVEL_TONE[level] : "bg-gray-100 text-gray-700";
}

export function levelLabel(level: IncidentLevel | null): string {
  return level ? LEVEL_LABEL[level] : "Unclassified";
}

/** Verified / unverified badge. Unverified carries no clock (PRD §4.1). */
export const VERIFIED_TONE = "bg-green-100 text-green-800";
export const UNVERIFIED_TONE = "bg-gray-100 text-gray-500";

/**
 * SLA bar and countdown text, keyed off how much of the promise is spent.
 * The at-risk flag fires at 50% budget while unclaimed (PRD §6).
 */
export type SlaTone = "running" | "at_risk" | "late";

export const SLA_TONE: Record<SlaTone, { text: string; bar: string }> = {
  running: { text: "text-lucena-blue", bar: "bg-lucena-blue" },
  at_risk: { text: "text-amber-600", bar: "bg-amber-600" },
  late: { text: "text-red-600", bar: "bg-red-600" },
};

/**
 * ⚠️ THE 50 IS HARDCODED, AND IT CANNOT BE READ.
 * incident_config.at_risk_threshold_pct is 50 today, so this agrees with the
 * database BY COINCIDENCE -- exactly the defect l53 fixed for the Staff portal.
 * A responder cannot read it: it lives on staff_incident_config (l53), gated
 * `is_active_staff('staff') and has_module('incidents')`, and roles are exact.
 *
 * It is NOT on public_incident_config on purpose -- l23 called it "an internal
 * ops threshold driving the Staff queue's amber state, not a public promise",
 * that view is granted to `anon`, and assert_l23 check 4b FAILS THE WHOLE DB
 * SUITE if anyone adds it. The l53 plan proposed exactly that and was caught.
 *
 * Do not fix this from this repo. If a responder should read the threshold, it
 * needs a new gated view and therefore a decision and a DB layer -- not a
 * widened public one.
 */
export function slaToneFor(percentElapsed: number): SlaTone {
  if (percentElapsed >= 100) return "late";
  if (percentElapsed >= 50) return "at_risk";
  return "running";
}
