import { createClient, type Db } from "@/shared/supabase/server";
import { buildSearchFilter } from "@/portals/staff/lib/supabase/search-filter";
import { countByStatus, toQueueItem } from "./row-mapper";
import type { StatusFilter } from "./queue-params";
import { deriveSlaState } from "./sla";
import { ACTIVE_STATUSES, AWAITING_TRIAGE_STATUSES } from "./status";
import type { StaffIncidentQueueRow } from "./row-mapper";
import type { IncidentQueueItem, IncidentStatus } from "../types";

/**
 * The queue's interface: the list one screen shows, the tab counts above it,
 * the figure its activity bar polls for and the At Risk figure on the
 * dashboard card. The detail screen's reads are not here — they are private to
 * `incident-dossier.ts`, which is the only way in to them. See ADR-0003.
 */

/**
 * Column lists are checked against the generated types: a column
 * the view does not have is a compile error. That holds only while each list
 * is ONE string literal on ONE source line — split it with `+` or build it
 * with `.join()` and TypeScript widens it to `string`, which postgrest-js
 * cannot parse, so the row type degrades to GenericStringError[].
 *
 * The result is still cast to its row type below. Every list here was verified
 * by live query against the sandbox on 2026-08-07 — `duplicate_of` and
 * `original_reference` on 2026-10-20. Do not add a column without doing the same.
 */
const QUEUE_COLUMNS = "id, reference_number, type_label, incident_level, status, closure_reason, is_verified, barangay_name, submitted_at, sla_armed_at, sla_due_at, resolved_at, closed_at, duplicate_of, original_reference";

/**
 * What `deriveSlaState` needs and nothing else. Six columns rather than the
 * queue's fifteen, because the At Risk figure is one number and the rows
 * behind it are never shown.
 *
 * It sits with the select lists above so the standing instruction covers it
 * too — and dropping a column from it is worse than dropping one from a
 * display list: an absent `is_verified` reads as unverified, which suspends
 * every clock and reports nothing at risk at all.
 */
const AT_RISK_COLUMNS = "is_verified, status, sla_armed_at, sla_due_at, resolved_at, closed_at";

/**
 * The columns the search box looks in — what a desk officer might hold about a
 * report, not a subset of the display columns. `address` is searched but not
 * shown in the queue, which is the point of naming the list separately.
 *
 * It sits with the select lists so the standing instruction above covers it
 * too. Verify an addition against the live view the same way.
 */
const SEARCH_COLUMNS = [
  "reference_number",
  "type_label",
  "barangay_name",
  "address",
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
 * Ordering, verified by live query on 2026-08-07 — 13 active, then 6 resolved,
 * then 6 closed:
 *
 *   closed_at   nulls first  — everything not closed comes first
 *   resolved_at nulls first  — within that, active before resolved
 *   sla_due_at  nulls last   — within that, soonest deadline first;
 *                              a null deadline means the clock never armed
 *   submitted_at desc        — tie-break
 *
 * This replaces the mock queue's client-side SLA_RANK sort, which could only
 * order rows it had already been handed.
 *
 * Then one ordering PostgREST cannot express: Awaiting Triage rows are lifted
 * to the top, keeping the order above among themselves and among the rest.
 * The SLA clock arms on routing, so a report nobody has routed has no deadline
 * and nullslast sinks it below every breached row in the pool — the one row on
 * the screen that is waiting on somebody in this building. SCRUM-193.
 *
 * It is applied to the page the database returned, so it reorders within
 * QUEUE_LIMIT and cannot reach past it. That holds while the active rows fit
 * on one screenful; the day they do not, this wants a second read of the
 * awaiting-triage rows rather than a bigger limit.
 */
export async function getIncidentQueue(
  options: QueueOptions = {},
  db?: Db,
): Promise<IncidentQueueItem[]> {
  const supabase = db ?? await createClient();

  let query = supabase
    .from("staff_incidents")
    .select(QUEUE_COLUMNS)
    .order("closed_at", { ascending: true, nullsFirst: true })
    .order("resolved_at", { ascending: true, nullsFirst: true })
    .order("sla_due_at", { ascending: true, nullsFirst: false })
    .order("submitted_at", { ascending: false })
    .limit(QUEUE_LIMIT);

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  const searchFilter = buildSearchFilter(SEARCH_COLUMNS, options.search);
  if (searchFilter) query = query.or(searchFilter);

  const { data, error } = await query;
  if (error) throw new Error(`staff_incidents read failed: ${error.message}`);

  return awaitingTriageFirst(
    ((data as StaffIncidentQueueRow[] | null) ?? []).map(toQueueItem),
  );
}

/** Stable: a partition, not a re-sort, so the database's order survives it. */
function awaitingTriageFirst(items: IncidentQueueItem[]): IncidentQueueItem[] {
  const isAwaitingTriage = (item: IncidentQueueItem) =>
    AWAITING_TRIAGE_STATUSES.includes(item.status);

  return [
    ...items.filter(isAwaitingTriage),
    ...items.filter((item) => !isAwaitingTriage(item)),
  ];
}

/**
 * Tab counts are deliberately whole-view — they do not narrow with the search
 * box and they do not narrow with the tab that is open, which is what makes
 * them a workload summary rather than a restatement of the table below them.
 * Every figure a queue shows is whole-view; see CONTEXT.md, "Queue".
 */
export async function getIncidentStatusCounts(
  db?: Db,
): Promise<Record<IncidentStatus, number>> {
  const supabase = db ?? await createClient();
  const { data, error } = await supabase.from("staff_incidents").select("status");

  if (error) {
    throw new Error(`staff_incidents count read failed: ${error.message}`);
  }

  return countByStatus((data as { status: IncidentStatus | null }[] | null) ?? []);
}

/**
 * How many reports are awaiting triage right now.
 *
 * Polled on a timer by the queue's activity bar, to decide whether anything has
 * arrived since the page rendered. Its baseline is a fold of the status counts
 * above over the same constant this filters on, which is what stops the two
 * figures disagreeing about the same set.
 *
 * `head: true` means Postgres counts without shipping any rows, which is what
 * makes this cheap enough to run every thirty seconds on every open queue.
 *
 * Returns null rather than throwing. A transient blip must not surface as an
 * error to an officer mid-triage; the bar keeps its last known figure and tries
 * again on the next tick.
 *
 * It also fills the dashboard card's Awaiting Triage figure, so the card and the
 * queue read one definition of the set; null lands there as a zero.
 *
 * **Its client is required where the queue read's is optional.** Its callers —
 * the two-line `"use server"` shell in ./actions.ts and the dashboard card in
 * ./dashboard-card.ts — always have one — so the parameter is required rather than optional, and the "every caller omits
 * it" reasoning behind the optional seam above does not apply. The
 * read lives here rather than in that module because `"use server"` makes every
 * export a network-reachable endpoint whose arguments are deserialised from the
 * request; the seam moves rather than widening one. See ADR-0001 and ADR-0002.
 */
export async function readAwaitingTriageCount(db: Db): Promise<number | null> {
  const { count, error } = await db
    .from("staff_incidents")
    .select("id", { count: "exact", head: true })
    .in("status", AWAITING_TRIAGE_STATUSES);

  if (error) return null;
  return count ?? 0;
}

/**
 * How many incidents are at risk right now.
 *
 * There is no SQL for this: "at risk" is a fraction of an elapsed window
 * measured against a configurable threshold, and PostgREST cannot express it.
 * So the fields it needs are read across the active rows — six columns, no
 * joins — and the state is derived here. Only an incident nobody has finished
 * can be at risk, which is why this narrows to ACTIVE_STATUSES rather than
 * reading the whole view. Whether that is the same rule as "somebody still has
 * work to do", or a second one that happens to agree, is argued beside the
 * constant — and asserted in ./status.test.ts — rather than restated here.
 *
 * The status filter is the whole of the narrowing. An `is_verified` filter
 * beside it would move a decision out of `deriveSlaState` and into the query,
 * and the figure on the card would stop answering from the same rule as the
 * badge on each row.
 *
 * `threshold` arrives as a plain number rather than being read here, so this
 * takes the seam parameter without pulling `getAtRiskThreshold` — which is
 * `cache()`-wrapped, and must therefore never take a client. See ADR-0001.
 *
 * `now` arrives the same way and is the same shape of fact, with one more
 * reason behind it: a moment invented in here is a second clock. The figure
 * fills a card that sits above rows the caller has already timed against its
 * own, and a whole-view figure that disagrees with the view is worse than a
 * stale one. The signature is what stops this function inventing a moment.
 */
export async function getAtRiskCount(
  threshold: number,
  now: Date,
  db?: Db,
): Promise<number> {
  const supabase = db ?? await createClient();
  const { data, error } = await supabase
    .from("staff_incidents")
    .select(AT_RISK_COLUMNS)
    .in("status", ACTIVE_STATUSES);

  if (error) {
    throw new Error(`staff_incidents at-risk read failed: ${error.message}`);
  }

  const rows =
    (data as Parameters<typeof deriveSlaState>[0][] | null) ?? [];

  return rows.filter((row) => deriveSlaState(row, now, threshold) === "at_risk")
    .length;
}
