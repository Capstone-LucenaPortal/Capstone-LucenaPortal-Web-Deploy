/**
 * One read's outcome: its rows, or why it failed. An empty list and a failed
 * read must stay apart, or a citizen with records is told they have none.
 */
export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Settles a read into a `Loaded`. The service's own message is already written
 * for the citizen, so it is kept; `fallback` covers an error with no text, or a
 * thrown value that is not an `Error`.
 */
export async function settle<T>(read: Promise<T>, fallback: string): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await read };
  } catch (err) {
    return { ok: false, error: (err instanceof Error && err.message) || fallback };
  }
}
