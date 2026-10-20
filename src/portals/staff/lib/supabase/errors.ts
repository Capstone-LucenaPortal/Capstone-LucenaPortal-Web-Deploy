/**
 * Translation from PostgreSQL errcodes to sentences written for a Staff member.
 *
 * Every staff RPC raises with a deliberate errcode and a message that names the
 * function, the reference number and the enum value that failed the guard. That
 * message is excellent for a developer and wrong for a queue clerk, so it is
 * never rendered. See ../../docs/superpowers/decisions/2026-08-07-staff-live-data.md
 * decision 5.
 */

/** The shape of a PostgrestError, narrowed to what translation needs. */
export interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

export interface ErrorMessages {
  /** 42501 — the caller is not allowed to do this at all. */
  forbidden: string;
  /** 22023 — a guard rejected the transition. Almost always a stale page. */
  conflict: string;
  /** P0002 or PT404 — the row is gone. */
  missing: string;
  /**
   * 23P01 — an EXCLUDE constraint refused the slot. Booking's
   * booking_occupancies carries `EXCLUDE USING gist (space_code WITH =, during
   * WITH &&)`, and this is the database saying the venue is already taken.
   * Optional so the two prior modules' message objects still compile.
   */
  unavailable?: string;
  /**
   * 23503 — a catalogue row the operation needs is absent. booking_price
   * raises it rather than returning zero, precisely so a rate-card edit that
   * drops a row cannot start issuing free bookings silently.
   */
  misconfigured?: string;
  /**
   * 23505 — a unique constraint. record_balance_payment raises it when the
   * official receipt number is already recorded against another payment, which
   * is an operator typo far more often than it is a real duplicate.
   */
  duplicate?: string;
  /** Anything else: network, timeout, a code we have not seen. */
  fallback: string;
}

export interface ActionFailure {
  ok: false;
  message: string;
  /**
   * True when the most likely cause is that a colleague acted first and this
   * page is showing state that no longer exists. The caller revalidates.
   */
  stale: boolean;
}

export type ActionResult = { ok: true } | ActionFailure;

export function toActionFailure(
  error: PostgrestErrorLike | null,
  messages: ErrorMessages,
): ActionFailure {
  switch (error?.code) {
    case "42501":
      return { ok: false, message: messages.forbidden, stale: false };
    case "22023":
      return { ok: false, message: messages.conflict, stale: true };
    // PT404 is the not-found code functions created since l77b raise instead
    // of P0002 (DB docs/what-not-to-do.md section 9). Same meaning here.
    case "P0002":
    case "PT404":
      return { ok: false, message: messages.missing, stale: true };
    // The next three are all `stale: false`. None is a colleague-acted-first
    // situation, and revalidating would re-render the page out from under the
    // message before anyone had read it.
    case "23P01":
      return {
        ok: false,
        message: messages.unavailable ?? messages.fallback,
        stale: false,
      };
    case "23503":
      return {
        ok: false,
        message: messages.misconfigured ?? messages.fallback,
        stale: false,
      };
    case "23505":
      return {
        ok: false,
        message: messages.duplicate ?? messages.fallback,
        stale: false,
      };
    default:
      return { ok: false, message: messages.fallback, stale: false };
  }
}
