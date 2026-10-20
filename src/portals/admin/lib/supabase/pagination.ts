// PostgREST's default `db-max-rows` setting caps any single unpaginated
// response at 1000 rows. A `.select("*")` with no `.range()` silently drops
// everything past that cap instead of erroring — once an analytics view
// crosses 1000 rows, every KPI, trend bucket and backlog count computed from
// the returned array quietly under-counts, with nothing on screen to say so.
//
// PAGE_SIZE mirrors that default exactly. It is not an arbitrary batch size:
// it is the largest page PostgREST will ever hand back in one response, so
// requesting more per page would not fetch more per page anyway.
const PAGE_SIZE = 1000;

interface PagedResponse<Row> {
  data: Row[] | null;
  error: unknown;
}

/**
 * The slice of a Supabase/PostgREST query builder that `fetchAllRows` needs:
 * a `.range()` call that can be issued again and again against successive
 * offsets, each resolving to a PostgREST response. The real query builder
 * (e.g. `supabase.from(view).select("*").order(...)`) satisfies this
 * structurally — `.range()` returns the same builder, so calling it more
 * than once just re-issues the request with a new offset.
 */
export interface RangeableQuery<Row> {
  range(from: number, to: number): PromiseLike<PagedResponse<Row>>;
}

/**
 * Fetches every row a query would return, paging past PostgREST's
 * `db-max-rows` cap via `.range()` instead of trusting a single request to
 * come back complete.
 *
 * `query` must be an already-built, not-yet-awaited filter/order chain.
 * `fetchAllRows` calls `.range()` on it once per page, concatenating pages
 * until one comes back shorter than PAGE_SIZE — the only reliable signal
 * that there is no next page. That check also covers the boundary where the
 * true row count is an exact multiple of PAGE_SIZE (e.g. exactly 2000 rows):
 * the second page is still a full PAGE_SIZE rows, so the loop fetches a
 * third, empty page before it can tell the data actually ended at 2000
 * rather than continuing beyond it.
 *
 * On error from any page, the pages fetched so far are discarded and the
 * error is surfaced immediately — a partial result must never be mistaken
 * for a complete one by a caller that only checks `error`.
 *
 * `signal`, when given, is checked at the TOP of every loop iteration —
 * before the first page's request as well as every subsequent one. This is
 * what actually stops a cancelled fetch mid-pagination: `query` itself
 * should already carry the same signal via `.abortSignal()` (see
 * listIncidents/listApplications/listBookings), which cancels whichever
 * single HTTP request is currently in flight, but that alone does not stop
 * this loop from immediately issuing the NEXT page's request the moment the
 * in-flight one settles — an aborted query still resolves (PostgREST's
 * client turns a fetch abort into `{ data: null, error }`, it does not
 * reject), so without this explicit check the loop would keep paging through
 * an analytics view that already has thousands of rows just to discover the
 * cancellation one page at a time. Checking `signal.aborted` directly here
 * means a cancellation between page N finishing and page N+1 starting is
 * caught immediately, not after one more wasted round trip.
 */
export async function fetchAllRows<Row>(
  query: RangeableQuery<Row>,
  signal?: AbortSignal,
): Promise<PagedResponse<Row>> {
  const rows: Row[] = [];
  let offset = 0;

  for (;;) {
    if (signal?.aborted) {
      return {
        data: null,
        error: signal.reason ?? new DOMException("The operation was aborted.", "AbortError"),
      };
    }

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: null, error };

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return { data: rows, error: null };
    }

    offset += PAGE_SIZE;
  }
}
