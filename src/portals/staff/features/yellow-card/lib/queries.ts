import { createClient, type Db } from "@/shared/supabase/server";
import { buildSearchFilter } from "@/portals/staff/lib/supabase/search-filter";
import { countByStatus, toQueueItem } from "./row-mapper";
import type { StatusFilter } from "./queue-params";
import type { StaffYellowCardQueueRow } from "./row-mapper";
import type { YellowCardQueueItem, YellowCardStatus } from "../types";

/**
 * The queue's interface: the list one screen shows and the tab counts above
 * it. The detail screen's reads are not here — they are private to
 * `review-dossier.ts`, which is the only way in to them. See ADR-0003.
 */

/**
 * The column list is checked against the generated types: a column the
 * view does not have is a compile error. That holds only while it is ONE
 * string literal on ONE source line — split it with `+` or build it with
 * `.join()` and TypeScript widens it to `string`, which postgrest-js cannot
 * parse, so the row type degrades to GenericStringError[].
 *
 * The result is still cast to its row type below. Verified by live
 * query against staff_yellow_card_queue on 2026-08-07. Do not add a column
 * without doing the same.
 */
const QUEUE_COLUMNS = "id, reference_number, first_name, middle_name, last_name, suffix, barangay_name, status, submitted_at, due_at, document_count, deadline_state";

/**
 * The columns the search box looks in. A reviewer looks an application up by
 * whichever detail they happen to have, so this is a list of what they might
 * hold, not a subset of the display columns.
 *
 * Named here rather than inline in the read so the standing instruction above
 * covers both lists at once. Verify an addition against the live view the same
 * way.
 */
const SEARCH_COLUMNS = [
  "reference_number",
  "first_name",
  "last_name",
  "barangay_name",
] as const;

/**
 * One screenful. The queue is ordered by urgency, so the rows past this limit
 * are by construction the least urgent. Raise it when someone asks for paging,
 * not before.
 */
const QUEUE_LIMIT = 100;

export interface QueueOptions {
  status?: StatusFilter;
  search?: string;
}

/**
 * Ordering: soonest SLA deadline first. due_at is NULL while the clock is
 * paused (the ball is with the citizen), so those sort last and then by most
 * recently submitted.
 */
export async function getYellowCardQueue(
  options: QueueOptions = {},
  db?: Db,
): Promise<YellowCardQueueItem[]> {
  const supabase = db ?? await createClient();

  let query = supabase
    .from("staff_yellow_card_queue")
    .select(QUEUE_COLUMNS)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("submitted_at", { ascending: false })
    .limit(QUEUE_LIMIT);

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  const searchFilter = buildSearchFilter(SEARCH_COLUMNS, options.search);
  if (searchFilter) query = query.or(searchFilter);

  const { data, error } = await query;
  if (error) {
    throw new Error(`staff_yellow_card_queue read failed: ${error.message}`);
  }

  return ((data as StaffYellowCardQueueRow[] | null) ?? []).map(toQueueItem);
}

/**
 * Tab counts are deliberately global — they do not narrow with the search box,
 * which is how the mock behaved and what makes them useful as a workload
 * summary rather than a restatement of the table below them.
 */
export async function getYellowCardStatusCounts(
  db?: Db,
): Promise<Record<YellowCardStatus, number>> {
  const supabase = db ?? await createClient();
  const { data, error } = await supabase
    .from("staff_yellow_card_queue")
    .select("status");

  if (error) {
    throw new Error(`staff_yellow_card_queue count read failed: ${error.message}`);
  }

  return countByStatus((data as { status: YellowCardStatus | null }[] | null) ?? []);
}
