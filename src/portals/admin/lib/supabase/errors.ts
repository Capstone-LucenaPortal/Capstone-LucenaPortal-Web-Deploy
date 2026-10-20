export type PortalErrorKind = "permission" | "not-found" | "invalid" | "unknown";

export interface PortalError {
  kind: PortalErrorKind;
  message: string;
  // The raw upstream message, for logging/debugging only. Components must
  // render `message`, never `detail`: for unknown errors the raw text is a
  // Postgres internal (constraint/column/function names) that has no business
  // on screen.
  detail: string;
}

// What the user sees when the error is not one of the known, deliberately
// user-facing kinds below. Kept generic on purpose — the raw message lives in
// `detail`.
export const GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again, and contact your system administrator if the problem continues.";

/**
 * Maps a PostgREST error onto something the UI can act on.
 *
 * Two things about this contract are easy to get wrong:
 *
 * - P0002 arrives as an HTTP 500, not a 404. Roughly twenty RPCs raise it for
 *   "not found or no access", so treating 500 as a crash would misreport all
 *   of them.
 * - An empty result set is NOT an error and never reaches here. It is what a
 *   failed view gate looks like (HTTP 200 + []), and callers must render an
 *   empty state rather than a failure.
 *
 * Every RPC prefixes its message with its own name, so the prefix is stripped
 * for display but kept intact in the raw error for logging.
 */
export function toPortalError(error: unknown): PortalError {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;

  const rawMessage = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

  // "read_incident_pii: caller is not an active Admin" -> "caller is not..."
  const message = rawMessage.replace(/^[a-z_]+:\s*/, "");

  switch (code) {
    case "42501":
      return { kind: "permission", message, detail: rawMessage };
    case "P0002":
    case "PT404":
      return { kind: "not-found", message, detail: rawMessage };
    case "22023":
      return { kind: "invalid", message, detail: rawMessage };
    default:
      // Unknown means the message was written for a database log, not a user:
      // rendering it leaks schema internals to whoever is looking at the
      // screen. Show the generic line instead; the raw text stays in detail.
      return { kind: "unknown", message: GENERIC_ERROR_MESSAGE, detail: rawMessage };
  }
}
