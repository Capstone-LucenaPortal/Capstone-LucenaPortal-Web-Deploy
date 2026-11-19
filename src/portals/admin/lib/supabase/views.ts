import { createClient } from "@/shared/supabase/client";
import { toPortalError } from "@/portals/admin/lib/supabase/errors";
import { fetchAllRows } from "@/shared/supabase/pagination";
import type { Database } from "@/shared/supabase/types";

type Views = Database["public"]["Views"];

/** The analytics views Admin reads whole, newest first. */
export type AdminAnalyticsView =
  | "admin_incident_analytics"
  | "admin_yellow_card_analytics"
  | "admin_booking_analytics";

export type AnalyticsRow<V extends AdminAnalyticsView> = Views[V]["Row"];

/**
 * The view's newest `submitted_at`, or null when the view is empty. Read from
 * the view, not the browser's clock: a slow clock would hide the newest rows, a
 * fast one would let new rows in. Kept as the string the API sent. A `Date` has
 * no microseconds, so one would fall just short of the row it came from.
 *
 * The generated view types mark `submitted_at` nullable, but it is
 * `timestamptz not null` on every base table, so null only ever means "empty".
 */
async function newestSubmittedAt(
  view: AdminAnalyticsView,
  signal: AbortSignal | undefined,
): Promise<string | null> {
  let query = createClient()
    .from(view)
    .select("submitted_at")
    .order("submitted_at", { ascending: false })
    .limit(1);
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;
  if (error) throw toPortalError(error);
  return data?.[0]?.submitted_at ?? null;
}

/**
 * Every row of an Admin analytics view, newest first, across as many requests
 * as that takes (PostgREST caps one response at 1,000 rows; see
 * src/shared/supabase/pagination.ts).
 *
 * Pages are read by offset, so two things hold them still. The upper limit on
 * `submitted_at` stops a submission arriving mid-load from pushing the rows
 * after it onto the next page; it appears on the next load instead. The `id`
 * tie-break fixes the order of rows that share a `submitted_at`, which would
 * otherwise be free to differ between pages. Super-staff's Audit Log reads its
 * log the same way (#94).
 *
 * `signal`, when given, is attached to both requests via `.abortSignal()` and
 * also handed to `fetchAllRows`, so a cancelled load stops issuing pages
 * instead of only cancelling whichever single request was in flight.
 *
 * An empty result is not an error: it is also what a non-admin caller sees,
 * because each view's WHERE clause filters them out rather than raising.
 * Errors are thrown as a PortalError; no partial rows are ever returned.
 */
export async function listViewNewestFirst<V extends AdminAnalyticsView>(
  view: V,
  signal?: AbortSignal,
): Promise<AnalyticsRow<V>[]> {
  const upTo = await newestSubmittedAt(view, signal);
  if (upTo === null) return [];

  let query = createClient()
    .from(view)
    .select("*")
    .lte("submitted_at", upTo)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false });
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await fetchAllRows(query, signal);
  if (error) throw toPortalError(error);
  // supabase-js resolves `from(view)` over a union of view names to a union of
  // row types it can't narrow back to V; the select("*") rows are V's rows.
  return (data ?? []) as unknown as AnalyticsRow<V>[];
}
