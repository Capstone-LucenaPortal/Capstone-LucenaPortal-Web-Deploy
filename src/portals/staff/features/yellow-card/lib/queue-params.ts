import { STATUS_ORDER } from "./status";
import type { YellowCardStatus } from "../types";

export type StatusFilter = YellowCardStatus | "all";

/**
 * Search params are user input — someone can type anything into the address
 * bar. An unrecognised value falls back to "all" rather than reaching the
 * query, so the filter can never be a vector and never 500s the page.
 */
export function parseStatusFilter(raw: string | undefined): StatusFilter {
  return STATUS_ORDER.includes(raw as YellowCardStatus)
    ? (raw as YellowCardStatus)
    : "all";
}

/**
 * Tab links must carry the current search term, or clicking a status throws
 * away what the user typed.
 */
export function buildQueueHref({
  status,
  search,
}: {
  status: StatusFilter;
  search?: string;
}): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (search?.trim()) params.set("q", search.trim());

  const query = params.toString();
  return query ? `/staff/yellow-card?${query}` : "/staff/yellow-card";
}
