// src/portals/admin/features/sla/lib/sla-links.ts
//
// SLA Reports' Finished late and Past due now link, per service, to the
// Yellow Card and Incident Reports pages, whose Recent tables then narrow to
// exactly the requests the tile counted (#127, metrics sheet S2 and S4). The
// filter travels in the query string, so the link can be reloaded or shared.
import type { DateFilterPreset } from "@/portals/admin/components/ui/date-filter-bar";
import { customRangeError, type DateRangeKey } from "@/portals/admin/lib/dates";

export const YELLOW_CARD_PATH = "/admin/yellow-card";
export const INCIDENT_REPORTS_PATH = "/admin/issue-reports";

/** "late": finished late in the range. "past-due": past due now, whatever the range. */
export type SlaRowFilter = "late" | "past-due";

const PRESET_KEYS: readonly DateRangeKey[] = ["Today", "Week", "Month", "Quarter", "Annual"];

/**
 * Finished late's link: the target page opens on the same range, either the
 * same named preset or the same custom dates, and on `basis`, the target
 * page's own name for the date type SLA Reports was on.
 */
export function finishedLateHref(
  path: string,
  preset: DateFilterPreset,
  range: { from: string; to: string },
  basis: string
): string {
  const params = new URLSearchParams({ sla: "late" });
  if (preset === "Custom") {
    params.set("from", range.from);
    params.set("to", range.to);
  } else {
    params.set("range", preset);
  }
  params.set("basis", basis);
  return `${path}?${params}`;
}

/** Past due now's link carries no range: past due describes right now. */
export function pastDueHref(path: string): string {
  return `${path}?sla=past-due`;
}

/** What a target page reads from a link. A null field keeps the page's default. */
export interface SlaLink<B extends string> {
  filter: SlaRowFilter;
  preset: DateFilterPreset | null;
  from: string | null;
  to: string | null;
  basis: B | null;
}

/**
 * Reads a link built above. Anything it doesn't recognise is ignored rather
 * than guessed: an unknown `sla` means no filter at all, and an unknown range
 * or date type leaves the page's default in place.
 */
export function readSlaLink<B extends string>(
  params: { get(name: string): string | null } | null,
  bases: readonly B[]
): SlaLink<B> | null {
  const filter = params?.get("sla");
  if (filter !== "late" && filter !== "past-due") return null;
  if (filter === "past-due") return { filter, preset: null, from: null, to: null, basis: null };

  const range = params?.get("range") ?? null;
  const from = params?.get("from") ?? null;
  const to = params?.get("to") ?? null;
  const basis = params?.get("basis") ?? null;
  const known = <T extends string>(values: readonly T[], value: string | null): value is T =>
    value !== null && (values as readonly string[]).includes(value);

  let preset: DateFilterPreset | null = null;
  let customFrom: string | null = null;
  let customTo: string | null = null;
  if (known(PRESET_KEYS, range)) {
    preset = range;
  } else if (from !== null && to !== null && customRangeError(from, to) === null) {
    preset = "Custom";
    customFrom = from;
    customTo = to;
  }
  return { filter, preset, from: customFrom, to: customTo, basis: known(bases, basis) ? basis : null };
}
