/**
 * The database raises four SQLSTATEs the portal cares about, and two different
 * not-found conventions. The 63 legacy `P0002` raises are deliberately NOT being
 * retrofitted in this slice, so both conventions must be handled at once — this
 * is the one file that knows about them.
 */
export type RpcErrorKind =
  | "permission"
  | "validation"
  | "not_found"
  /**
   * 23505, a unique violation. Most are a raw constraint message that is not
   * fit to show, so `rpcErrorMessage` falls back for it. An RPC that raises it
   * DELIBERATELY with written copy — add_holiday's "already has a holiday
   * entry; edit or reactivate it instead" — is shown by its feature's own
   * message function, which switches on this kind rather than the SQLSTATE.
   */
  | "conflict"
  | "unexpected";

/** The shape of a PostgrestError, narrowed to what classification needs. */
type DbErrorLike = {
  code: string | null;
  message: string;
  details?: string | null;
};

/** A PostgREST status override arrives as JSON in `details`, e.g. {"status":404}. */
function overriddenStatus(details: string | null | undefined): number | null {
  if (!details) return null;
  try {
    const parsed: unknown = JSON.parse(details);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "status" in parsed &&
      typeof (parsed as { status: unknown }).status === "number"
    ) {
      return (parsed as { status: number }).status;
    }
  } catch {
    // Malformed details are not an error in themselves — fall through.
  }
  return null;
}

export function classifyDbError(error: DbErrorLike): RpcErrorKind {
  switch (error.code) {
    case "42501":
      return "permission";
    case "22023":
      return "validation";
    case "23505":
      return "conflict";
    case "P0002":
    case "PT404":
      return "not_found";
    case "PGRST116":
      // "Cannot coerce the result to a single JSON object", with `details`
      // reading "The result contains 0 rows" — both verbatim from the sandbox
      // on 2026-08-21. Note `details` is plain English, not the JSON a status
      // override carries, which is why this used to fall through to
      // `unexpected` and leave the config views spinning forever.
      //
      // PostgREST raises this code for BOTH zero rows and more than one, and
      // this returns `permission` for the pair. That is sound only because
      // every `.single()` in this portal reads a gate-scoped ONE-ROW view
      // (super_*_config, super_site_info, super_metrics), where "more than
      // one" cannot happen — so zero rows means the gate refused, never that a
      // record is missing. Wiring design §7.1 requires the empty case be read
      // as "not authorised", not as "config missing".
      //
      // ⚠️ Two things keep that true, and a change to either breaks this:
      // by-id lookups use `.maybeSingle()`, which returns a null row and no
      // error at all; and no `.single()` is pointed at a multi-row relation.
      // Point one at a list and a 2-row result will tell the operator they
      // have lost access.
      return "permission";
    default:
      return overriddenStatus(error.details) === 404
        ? "not_found"
        : "unexpected";
  }
}

export class RpcError extends Error {
  readonly kind: RpcErrorKind;
  readonly code: string | null;

  constructor(kind: RpcErrorKind, message: string, code: string | null) {
    super(message);
    this.name = "RpcError";
    this.kind = kind;
    this.code = code;
  }
}

export function toRpcError(error: DbErrorLike): RpcError {
  return new RpcError(classifyDbError(error), error.message, error.code);
}

/** Storage throws its own shape: an HTTP status, not a SQLSTATE. */
type StorageErrorLike = {
  message: string;
  status?: number;
};

/**
 * Storage errors classified onto the same four kinds, so the whole app has ONE
 * error seam and every caller can reach for `rpcErrorMessage`.
 *
 * Deliberately no `validation` case: `validateImageFile` already refuses the
 * mime and the size limit client-side, so a 4xx that is not an auth failure
 * means the client and the bucket disagree — an operator cannot act on the
 * bucket's own English, and `unexpected` shows our fallback copy instead.
 */
export function toStorageRpcError(error: StorageErrorLike): RpcError {
  const code = error.status === undefined ? null : String(error.status);
  const kind = error.status === 401 || error.status === 403
    ? "permission"
    : "unexpected";
  return new RpcError(kind, error.message, code);
}

/** Toast copy for a caught error. Validation shows the database's own message. */
export function rpcErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof RpcError)) return fallback;
  switch (error.kind) {
    case "permission":
      return "You no longer have access. Sign in again.";
    case "not_found":
      return "That record no longer exists. Refresh the list.";
    case "validation":
      return error.message;
    default:
      return fallback;
  }
}
