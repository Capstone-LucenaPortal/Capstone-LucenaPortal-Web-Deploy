import { RpcError, toRpcError } from "./errors";

/**
 * The read half of the seam PRD Q9 asked for: "put the cast in one place —
 * typed `rpc()` / `from()` helpers in `src/lib/supabase/`, not fifteen ad-hoc
 * casts" (that folder is now src/portals/super-staff/lib/supabase/). `callRpc`
 * shipped; this is the `from()` side.
 *
 * ⚠️ It deliberately does NOT wrap the query builder. The whole reason the
 * feature modules cast was the `@supabase/ssr` 0.5.2 generic-variance bug that
 * collapsed every schema to `never` (fixed by the 0.12.4 upgrade in `e757ac6`).
 * With that gone the typed client already infers a view's row correctly, and
 * narrows it to the selected columns — so there is nothing left to cast, and a
 * wrapper that re-declared `.eq()`/`.order()`/`.limit()` would be a Middle Man
 * standing between callers and a builder that already works.
 *
 * What IS still repeated in every caller is the unwrapping: check `error`,
 * classify it, decide what a missing payload means. That is what these two
 * take, and all they take. The row type flows in from the builder untouched.
 */

/** What `toRpcError` needs. PostgREST's own error is assignable to it. */
type DbErrorLike = {
  code: string | null;
  message: string;
  details?: string | null;
};

type Result<T> = { data: T | null; error: DbErrorLike | null };

/**
 * A list read. No rows is an empty list, never an error — a `super_*` view
 * scoped to nothing by the gate returns `[]`, and the caller renders an empty
 * table rather than an access failure.
 */
export async function rows<T>(query: PromiseLike<Result<T[]>>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw toRpcError(error);
  return data ?? [];
}

/**
 * A by-id read, for `.maybeSingle()`. Returns the row or null.
 *
 * The null matters: callers used to write `toX((data as Row | null) ?? ({} as Row))`,
 * which handed the mapper an object with every column `undefined` and let a
 * missing record arrive downstream wearing a row's type. `.maybeSingle()`
 * already reports absence as a null row with no error — this passes that
 * absence along instead of inventing a value for it.
 *
 * Not for `.single()`, which raises PGRST116 on zero rows; `classifyDbError`
 * reads that as a refused gate, and only the one-row config views may use it.
 */
export async function maybeRow<T>(query: PromiseLike<Result<T>>): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw toRpcError(error);
  return data;
}

/**
 * A one-row read, for `.single()`.
 *
 * `.single()` promises exactly one row or an error — on zero rows PostgREST
 * raises PGRST116, which `classifyDbError` reads as a refused gate, because
 * every `.single()` in this portal points at a one-row `super_*` config view
 * where "more than one" cannot happen. So the caller gets a row, not a maybe:
 * making these five callers each handle an impossible null would be noise.
 *
 * A null payload with no error means that promise was broken — a `.single()`
 * pointed at something other than a one-row view. That is worth failing on
 * rather than passing an absent row off as present.
 */
export async function singleRow<T>(
  query: PromiseLike<{ data: T; error: DbErrorLike | null }>,
): Promise<NonNullable<T>> {
  const { data, error } = await query;
  if (error) throw toRpcError(error);
  if (data === null || data === undefined) {
    throw new RpcError(
      "unexpected",
      "A .single() read returned no row and no error.",
      null,
    );
  }
  return data;
}
