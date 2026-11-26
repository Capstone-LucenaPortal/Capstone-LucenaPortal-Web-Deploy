/**
 * The Sort by dropdown on the three Staff queues (#195): Default is each
 * queue's own order, Newest and Oldest order by submission date alone.
 *
 * The choice is a URL param (`?sort=newest|oldest`, omitted for Default)
 * because the server does the ordering: it has to reach every row that matches
 * the tab and the search, not just the first screenful.
 */
export type QueueSort = "default" | "newest" | "oldest";

export const QUEUE_SORT_OPTIONS: { value: QueueSort; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "newest", label: "Newest submitted" },
  { value: "oldest", label: "Oldest submitted" },
];

/**
 * Search params are user input. Anything but the two literals is Default,
 * so a hand-typed value never errors and never reaches the query.
 */
export function parseQueueSort(raw: string | undefined): QueueSort {
  return raw === "newest" || raw === "oldest" ? raw : "default";
}
