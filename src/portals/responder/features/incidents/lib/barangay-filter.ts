import type { Incident } from "@/portals/responder/features/incidents/types";

/**
 * The pool's barangay filter (issue #196). PRD §4.1: barangay is a filter
 * dimension, never a routing axis — this narrows what the list SHOWS and
 * nothing else. The nav badge, Phone alerts and the Inbox never see it.
 */

/**
 * `?brgy=` as the page receives it; absent or blank means no filter.
 *
 * ⚠️ A repeated key (`?brgy=a&brgy=b`) arrives as an ARRAY, and calling
 * `.trim()` on it would take the page down — so the first value wins.
 */
export function readBarangay(
  param: string | string[] | undefined,
): string | null {
  const value = (Array.isArray(param) ? param[0] : param)?.trim();
  return value ? value : null;
}

export function filterByBarangay(
  pool: Incident[],
  brgy: string | null,
): Incident[] {
  if (brgy === null) return pool;
  // ⚠️ No fallback for a barangay nothing matches: a stale or made-up choice
  // returns [], so the page can say so instead of showing the whole pool under
  // a button that still names it.
  return pool.filter((i) => i.barangay_name === brgy);
}

/**
 * A link back into the pool that keeps the responder's barangay. Used by the
 * card links, "Back to pool" and the sheet's rows; server-action redirects
 * deliberately do NOT carry it (issue #196) — they land on a bare pool.
 */
export function poolHref({
  report,
  brgy,
}: {
  report?: string | null;
  brgy?: string | null;
}): string {
  const params = new URLSearchParams();
  if (report) params.set("report", report);
  if (brgy) params.set("brgy", brgy);
  const query = params.toString();
  return query ? `/responder/pool?${query}` : "/responder/pool";
}

export type BarangayCount = { name: string; count: number };

/**
 * The sheet's rows: every barangay with a report in the pool right now, and
 * how many. Only barangays present are offered — a list of all of Lucena's
 * would be a long scroll of zeros. Alphabetical, so a responder finds their
 * area by name and rows don't reorder as counts change.
 */
export function barangayCounts(pool: Incident[]): BarangayCount[] {
  const counts = new Map<string, number>();
  for (const { barangay_name: name } of pool) {
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
