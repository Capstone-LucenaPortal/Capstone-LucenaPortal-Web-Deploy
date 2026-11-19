import { createClient } from "@/shared/supabase/client";
import {
  allRows,
  countedRows,
  rowCount,
  rows,
} from "@/portals/super-staff/lib/supabase/select";
import { AUDIT_AREAS } from "./area";
import type { IsoBounds } from "./date-range";
import { toEntries } from "./entry";
import type { AreaCounts, AreaFilter, AuditEntry } from "../types";

// One line. Splitting with `+` degrades the row type to GenericStringError[].
const COLUMNS =
  "id, occurred_at, actor_name, area, target_kind, target_id, target_label, change, detail, session_id, ip_address, user_agent, changes";

/** Rows on one page of the Audit Log. */
export const AUDIT_PAGE_SIZE = 50;

/**
 * The newest row's timestamp, or null when there is none. Read from the log,
 * not the browser's clock: a slow clock would hide the newest rows, a fast one
 * would let new rows in. Keep it the string the API sent. A `Date` has no
 * microseconds, so one would fall just short of the row it came from.
 */
async function newestOccurredAt(
  targetId: string | undefined,
  signal: AbortSignal | undefined,
): Promise<string | null> {
  let query = createClient()
    .from("super_audit_log")
    .select("occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(1);
  if (targetId !== undefined) query = query.eq("target_id", targetId);
  if (signal) query = query.abortSignal(signal);
  const [newest] = await rows(query);
  return newest?.occurred_at ?? null;
}

/**
 * The ceiling the Audit Log reads up to: the newest entry's timestamp, or null
 * for an empty log. Pages are read by offset from a log that every sign-in
 * writes to, so one ceiling holds a filter's pages still: a row written while
 * paging can't push the rows after it onto the next page, and appears once the
 * caller reads a new ceiling.
 */
export function newestAuditEntryAt(
  signal?: AbortSignal,
): Promise<string | null> {
  return newestOccurredAt(undefined, signal);
}

/** What a page and the counts share: the dates, and the ceiling. */
export type AuditScope = IsoBounds & { ceiling: string };

export type AuditPageQuery = AuditScope & {
  area: AreaFilter;
  /** The search text. Blank sends no search; surrounding spaces are ignored. */
  search: string;
  /** 1-based. */
  page: number;
};

export type AuditPage = { entries: AuditEntry[]; total: number };

/** The time bounds every Audit Log read takes. From is inclusive; the To
 *  bound is the instant after the To day, exclusive (see dateRangeToBounds). */
function scoped<
  Q extends {
    lte(column: "occurred_at", value: string): Q;
    gte(column: "occurred_at", value: string): Q;
    lt(column: "occurred_at", value: string): Q;
  },
>(query: Q, { ceiling, fromIso, beforeIso }: AuditScope): Q {
  let q = query.lte("occurred_at", ceiling);
  if (fromIso) q = q.gte("occurred_at", fromIso);
  if (beforeIso) q = q.lt("occurred_at", beforeIso);
  return q;
}

// Metacharacters of a PostgreSQL (POSIX ARE) regex. A backslash before any of
// them matches it literally; none is a letter or digit, which would make the
// backslash start an escape class instead.
const REGEX_META = /[\\^$.|?*+()[\]{}]/g;

/**
 * The search as a PostgREST `or` filter, or null for a blank box. Matches the
 * stored actor or target as a case-insensitive substring. A regex match, not
 * ilike, because PostgREST turns every `*` in a like pattern into `%`, so a
 * typed `*` could never match itself.
 *
 * Two layers of escaping: the text's regex metacharacters, so that the pattern
 * matches the text literally, then the pattern's `\` and `"` inside the double
 * quotes, which is what lets `,` `(` `)` sit in a PostgREST filter value.
 *
 * A null actor displays as "System", so text that is part of "system" also
 * matches those rows. A null target displays as "—", which nobody searches for.
 */
function searchFilter(search: string): string | null {
  const text = search.trim();
  if (text === "") return null;
  const pattern = text.replace(REGEX_META, "\\$&");
  const value = `"${pattern.replace(/[\\"]/g, "\\$&")}"`;
  const filters = [
    `actor_name.imatch.${value}`,
    `target_label.imatch.${value}`,
  ];
  if ("system".includes(text.toLowerCase())) filters.push("actor_name.is.null");
  return filters.join(",");
}

/**
 * One page of the entries the caller may see, newest first, with the exact
 * number of entries that match the dates, area and search up to the ceiling.
 * The view self-scopes; do not filter by role. The `id` tie-break fixes the
 * order of rows that share a timestamp, which would otherwise be free to
 * differ between pages.
 */
export async function listAuditPage(
  query: AuditPageQuery,
  signal?: AbortSignal,
): Promise<AuditPage> {
  const first = (query.page - 1) * AUDIT_PAGE_SIZE;
  let request = scoped(
    createClient()
      .from("super_audit_log")
      .select(COLUMNS, { count: "exact" }),
    query,
  );
  if (query.area !== "all") request = request.eq("area", query.area);
  const search = searchFilter(query.search);
  if (search !== null) request = request.or(search);
  let ranged = request
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(first, first + AUDIT_PAGE_SIZE - 1);
  if (signal) ranged = ranged.abortSignal(signal);

  const { rows: page, count } = await countedRows(ranged);
  return { entries: toEntries(page), total: count };
}

/** How many entries one area (or All) has within the scope, sending no rows. */
async function countArea(
  area: AreaFilter,
  scope: AuditScope,
  signal: AbortSignal | undefined,
): Promise<number> {
  let request = scoped(
    createClient()
      .from("super_audit_log")
      .select("id", { count: "exact", head: true }),
    scope,
  );
  if (area !== "all") request = request.eq("area", area);
  if (signal) request = request.abortSignal(signal);
  return rowCount(request);
}

/** Every tab at zero, for an empty log. */
export const ZERO_COUNTS: AreaCounts = Object.fromEntries(
  ["all", ...AUDIT_AREAS].map((area) => [area, 0]),
) as AreaCounts;

/**
 * The tab counts for the dates, up to the ceiling: All and each area, one
 * count-only request each, sent together. They ignore the search. Rejects if
 * any one fails, so no tab shows a count beside one that failed.
 */
export async function countAuditAreas(
  scope: AuditScope,
  signal?: AbortSignal,
): Promise<AreaCounts> {
  const keys: AreaFilter[] = ["all", ...AUDIT_AREAS];
  const counts = await Promise.all(
    keys.map((area) => countArea(area, scope, signal)),
  );
  return Object.fromEntries(
    keys.map((area, i) => [area, counts[i]]),
  ) as AreaCounts;
}

/**
 * History for one record, newest first, every entry of it, across as many
 * requests as that takes. Matched on target_id so a rename cannot orphan it.
 *
 * Pages are read by offset from a log that every sign-in writes to, so two
 * things hold them still. The upper limit stops a new row from pushing the rows
 * after it onto the next page; it appears on the next load instead. The `id`
 * tie-break fixes the order of rows that share a timestamp.
 */
export async function listAuditEntriesForTarget(
  targetId: string,
  signal?: AbortSignal,
): Promise<AuditEntry[]> {
  const upTo = await newestOccurredAt(targetId, signal);
  if (upTo === null) return [];

  let query = createClient()
    .from("super_audit_log")
    .select(COLUMNS)
    .eq("target_id", targetId)
    .lte("occurred_at", upTo)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });
  if (signal) query = query.abortSignal(signal);
  return toEntries(await allRows(query, signal));
}
