import type { QueueSort } from "@/portals/staff/lib/queue-sort";
import { STATUS_ORDER } from "./status";
import type { IncidentStatus } from "../types";

export type StatusFilter = IncidentStatus | "all";

/**
 * Search params are user input — someone can type anything into the address
 * bar. An unrecognised value falls back to "all" rather than reaching the query,
 * so the filter can never be a vector and never 500s the page. `assigned` and
 * `expired_unverified` land here too: they are bookmarks from the mock.
 */
export function parseStatusFilter(raw: string | undefined): StatusFilter {
  return STATUS_ORDER.includes(raw as IncidentStatus)
    ? (raw as IncidentStatus)
    : "all";
}

/**
 * Tab links must carry the current search term and sort, or clicking a status
 * throws away what the user typed and picked.
 */
export function buildQueueHref({
  status,
  search,
  sort = "default",
}: {
  status: StatusFilter;
  search?: string;
  sort?: QueueSort;
}): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (search?.trim()) params.set("q", search.trim());
  if (sort !== "default") params.set("sort", sort);

  const query = params.toString();
  return query ? `/staff/incidents?${query}` : "/staff/incidents";
}
