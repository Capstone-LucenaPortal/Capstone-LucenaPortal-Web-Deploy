/**
 * The queue search filter, in one place for all three queues.
 *
 * PostgREST's `or=(a.ilike.X,b.ilike.X)` is comma-delimited and paren-wrapped,
 * so an unescaped comma or paren in the term silently changes which columns
 * are searched. Double-quoting the value handles most of it; the strip handles
 * the rest, including `*`, which PostgREST reads as a wildcard.
 *
 * The escaping and the join are two halves of one rule, which is why they are
 * one function rather than a pattern helper each caller assembles around: a
 * fix to either half that lands in one queue and not the other two leaves the
 * others quietly exposed while their tests still pass.
 *
 * ⚠️ The asymmetry is deliberate. The term is escaped because it is user input
 * — someone can type anything into the address bar. The column names are not,
 * because they are code: they come from a const in the calling module, never
 * from a request.
 */

/** Private, and staying that way — see the note above about the two halves. */
function toSearchPattern(raw: string | undefined): string | null {
  const cleaned = (raw ?? "").replace(/["(),*\\]/g, "").trim();
  return cleaned ? `"%${cleaned}%"` : null;
}

/**
 * The whole `or` argument — every column matched against the same term — or
 * null when there is nothing left to search for, so the caller skips the
 * filter entirely rather than matching every row against `"%%"`.
 */
export function buildSearchFilter(
  columns: readonly string[],
  raw: string | undefined,
): string | null {
  const pattern = toSearchPattern(raw);
  if (!pattern) return null;

  return columns.map((column) => `${column}.ilike.${pattern}`).join(",");
}
