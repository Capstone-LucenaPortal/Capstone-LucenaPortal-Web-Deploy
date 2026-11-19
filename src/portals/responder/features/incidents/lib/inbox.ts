import { cache } from "react";
import {
  getNotifications,
  getUnreadNotifications,
  getVisibleIncidentStatuses,
} from "@/portals/responder/features/incidents/lib/data";
import {
  type ArrivalKey,
  arrivalIncidentIds,
  isStaleArrival,
} from "@/portals/responder/features/incidents/lib/stale-arrival";
import type {
  IncidentStatus,
  InboxEntry,
} from "@/portals/responder/features/incidents/types";

/**
 * The Inbox and its badge, with stale arrivals worked out (#138).
 *
 * Built on data.ts's reads rather than inside data.ts, so the rule runs for
 * real in every test that fakes that seam. Nothing here writes: a stale
 * arrival is labelled at render time and its stored row is left as it is --
 * marking the old department's arrivals read is the database's job (DB#65).
 *
 * A failed lookup throws through both functions. It must never turn into
 * "everything is stale" (rows relabelled, badge zeroed).
 */

async function visibleStatuses(
  rows: readonly ArrivalKey[],
): Promise<Map<string, IncidentStatus>> {
  const visible = await getVisibleIncidentStatuses(arrivalIncidentIds(rows));
  return new Map(visible.map((row) => [row.id, row.status]));
}

/** The Inbox, newest first, each row flagged stale or not. */
export const getInbox = cache(async (): Promise<InboxEntry[]> => {
  const rows = await getNotifications();
  const visible = await visibleStatuses(rows);
  return rows.map((row) => ({ ...row, stale: isStaleArrival(row, visible) }));
});

/** The nav badge: unread rows, leaving out unread stale arrivals. */
export const getUnreadCount = cache(async (): Promise<number> => {
  const rows = await getUnreadNotifications();
  const visible = await visibleStatuses(rows);
  return rows.filter((row) => !isStaleArrival(row, visible)).length;
});
