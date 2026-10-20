import { createClient, type Db } from "@/shared/supabase/server";
import { buildSearchFilter } from "@/portals/staff/lib/supabase/search-filter";
import { countByStatus, toQueueItem } from "./row-mapper";
import { NEEDS_ACTION, statusesFor, type StatusFilter } from "./queue-params";
import { NEEDS_ACTION_STATUSES } from "./status";
import type { StaffBookingQueueRow } from "./row-mapper";
import type { BookingQueueItem, BookingStatus } from "../types";

/**
 * Column lists are checked against the generated types: a column
 * the view does not have is a compile error. That holds only while each list
 * is ONE string literal on ONE source line — split it with `+` or build it
 * with `.join()` and TypeScript widens it to `string`, which postgrest-js
 * cannot parse, so the row type degrades to GenericStringError[].
 *
 * Every result is still cast to its row type below. Every list here was
 * verified by live query against the sandbox on 2026-08-11, after l54 and l55.
 * Do not add a column without doing the same.
 *
 * Not exported. The detail list that used to be built from this one lives in
 * ./booking-dossier.ts and is written out in full — see ADR-0006 for what that
 * untying gave up, and why exporting this instead was the worse trade. No file
 * outside this one has ever used it.
 */
const QUEUE_COLUMNS = "id, reference_number, status, cancellation_reason, event_title, event_type_label, venue_code, venue_label, rate_tier, tier_verified, organization_name, contact_person, estimated_headcount, event_date, start_time, duration_hours, total_fee, balance_amount, hold_expires_at, submitted_at, unverified_payment_count, tier_review_since";

/**
 * The columns the search box looks in — what a clerk might hold about a
 * booking, not a subset of the display columns.
 *
 * It sits with the select lists so the standing instruction above covers it
 * too. Verify an addition against the live view the same way.
 */
const SEARCH_COLUMNS = [
  "reference_number",
  "event_title",
  "organization_name",
  "contact_person",
] as const;

/**
 * One screenful. Raise it when someone asks for paging, not before.
 */
const QUEUE_LIMIT = 100;

export interface QueueOptions {
  status?: StatusFilter;
  search?: string;
}

/**
 * The queue read.
 *
 * Two orderings, chosen by the filter, and this is deliberate: the needs-action
 * tab is about how long somebody has been waiting on us, and everything else
 * reads as a schedule.
 *
 * `db` is ADR-0001's seam: optional and trailing, so every caller goes on
 * omitting it and building the real client, and a test can hand one in whose
 * fetch records the request. Optional here where `readNeedsActionCount` below
 * takes a required one — the reasoning for the difference is in its header.
 */
export async function getBookingQueue(
  options: QueueOptions = {},
  db?: Db,
): Promise<BookingQueueItem[]> {
  const supabase = db ?? await createClient();
  const filter = options.status ?? "all";

  let query = supabase
    .from("staff_bookings")
    .select(QUEUE_COLUMNS)
    .limit(QUEUE_LIMIT);

  const statuses = statusesFor(filter);
  if (statuses) query = query.in("status", statuses);

  const searchFilter = buildSearchFilter(SEARCH_COLUMNS, options.search);
  if (searchFilter) query = query.or(searchFilter);

  if (filter === NEEDS_ACTION) {
    // Oldest first. The point of this tab is how long somebody has been
    // waiting on us — decision 8 makes slow quoting visible as a staff
    // problem rather than resolving it by dropping the reservation.
    query = query.order("submitted_at", { ascending: true });
  } else {
    // Everything else reads as a schedule.
    query = query
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw new Error(`staff_bookings read failed: ${error.message}`);

  return ((data as StaffBookingQueueRow[] | null) ?? []).map(toQueueItem);
}

/**
 * Tab counts are deliberately whole-view — they do not narrow with the search
 * box and they do not narrow with the tab that is open, which is what makes
 * them a workload summary rather than a restatement of the table below them.
 * Every figure a queue shows is whole-view; see CONTEXT.md, "Queue".
 *
 * PostgREST has no GROUP BY, so one column comes back across the whole view and
 * countByStatus does the tallying. What that leaves worth pinning is that the
 * read stays a bare select with nothing filtering it.
 *
 * `db` is ADR-0001's seam, optional and trailing as on the queue read above.
 */
export async function getBookingStatusCounts(
  db?: Db,
): Promise<Record<BookingStatus, number>> {
  const supabase = db ?? await createClient();
  const { data, error } = await supabase.from("staff_bookings").select("status");

  if (error) {
    throw new Error(`staff_bookings count read failed: ${error.message}`);
  }

  return countByStatus((data as { status: BookingStatus | null }[] | null) ?? []);
}

/**
 * How many bookings are waiting on this office right now.
 *
 * Polled on a timer by the queue's activity bar, to decide whether the backlog
 * has grown since the page rendered. Its baseline is a fold of the status
 * counts above over the same constant this filters on, which is what stops the
 * two figures disagreeing about the same set — and they sit next to each other
 * in the tab row, so a disagreement would be visible.
 *
 * `head: true` means Postgres counts without shipping any rows, which is what
 * makes this cheap enough to run every thirty seconds on every open queue.
 *
 * Returns null rather than throwing. A transient blip must not surface as an
 * error to a clerk mid-booking; the bar keeps its last known figure and tries
 * again on the next tick.
 *
 * **Its client is required where the queue read's is optional.** The caller is
 * the two-line `"use server"` shell in ./actions.ts, and it always has one — so
 * the parameter is required rather than optional, and the "every caller omits
 * it" reasoning behind the optional seam above does not apply. The
 * read lives here rather than in that module because `"use server"` makes every
 * export a network-reachable endpoint whose arguments are deserialised from the
 * request; the seam moves rather than widening one. See ADR-0001 and ADR-0002.
 */
export async function readNeedsActionCount(db: Db): Promise<number | null> {
  const { count, error } = await db
    .from("staff_bookings")
    .select("id", { count: "exact", head: true })
    .in("status", NEEDS_ACTION_STATUSES);

  if (error) return null;
  return count ?? 0;
}

/**
 * Pesos still owed across every `confirmed` booking, whole-view.
 *
 * NOT filtered by the current tab: the queue page renders this beside three
 * whole-view counts, and a figure that silently changed scope on each tab click
 * would be the bug. PostgREST has no GROUP BY and its aggregate support is not
 * worth the fragility for one figure, so the column comes back and is summed
 * here — exactly as countByStatus counts here.
 *
 * Nulls are skipped rather than coerced to zero. A `confirmed` booking with a
 * null balance is a data problem, and adding zero would hide it. The two are
 * numerically indistinguishable, so no test separates them — the test beside
 * this read pins that a null contributes nothing and does not poison the
 * total, and this sentence is what says the hole is deliberate.
 *
 * `db` is ADR-0001's seam, optional and trailing as on the queue read above.
 */
export async function getBalanceOutstanding(db?: Db): Promise<number> {
  const supabase = db ?? await createClient();
  const { data, error } = await supabase
    .from("staff_bookings")
    .select("balance_amount")
    .eq("status", "confirmed");

  if (error) {
    throw new Error(`staff_bookings balance read failed: ${error.message}`);
  }

  const rows = (data as { balance_amount: number | null }[] | null) ?? [];
  return rows.reduce(
    (sum, row) => (typeof row.balance_amount === "number" ? sum + row.balance_amount : sum),
    0,
  );
}

/**
 * Every booking that holds a venue slot in a date window.
 *
 * Reads `staff_bookings` with the SAME column list the queue uses — reusing
 * QUEUE_COLUMNS rather than writing a second one, so a column verified once
 * stays verified.
 *
 * ⚠️ `.neq("status", "cancelled")` and NOT an `.in()` over the other seven.
 * The enum can gain a ninth value, and excluding the one status that releases
 * a hold keeps this query correct when it does. It is also exactly what
 * bk_sync_occupancy does: one transition releases, everything else holds.
 *
 * ⚠️ A booking that spans midnight is filed on its START date. `start_time` is
 * bounded by booking_config.closing_hour (22:00 today) and submit_booking
 * refuses a booking that would run past closing, so this cannot currently
 * happen. If the closing hour is ever removed, toBlocks needs a second block on
 * the following day.
 *
 * No limit: a month of bookings at one venue cannot approach one, and a
 * truncated calendar would draw a free evening that is not free.
 *
 * `db` is ADR-0001's seam, optional and trailing as on the queue read above.
 */
export async function getBookingCalendar(
  from: string,
  to: string,
  db?: Db,
): Promise<BookingQueueItem[]> {
  const supabase = db ?? await createClient();

  const { data, error } = await supabase
    .from("staff_bookings")
    .select(QUEUE_COLUMNS)
    .gte("event_date", from)
    .lte("event_date", to)
    .neq("status", "cancelled")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`staff_bookings calendar read failed: ${error.message}`);
  }

  return ((data as StaffBookingQueueRow[] | null) ?? []).map(toQueueItem);
}
