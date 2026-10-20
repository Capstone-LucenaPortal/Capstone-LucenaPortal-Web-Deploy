import { RpcError, rpcErrorMessage } from "@/portals/super-staff/lib/supabase/errors";

/**
 * Toast copy for the calendar RPCs. It differs from the shared
 * `rpcErrorMessage` in two ways, both from the ticket:
 *
 *  - PT404 and 42501 say "Not found" and "Not permitted" in so many words. A
 *    stale screen editing a holiday someone else changed is the likeliest
 *    PT404 here (user story 16), and it must not read as a network blip.
 *  - 23505 shows the database's message. add_holiday raises it for a date that
 *    already has an entry, ACTIVE OR RETIRED, and the message says what to do
 *    instead — reactivate the retired row. The shared seam falls back for a
 *    conflict, because most are raw constraint text.
 */
export function calendarErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof RpcError)) return fallback;
  switch (error.kind) {
    case "conflict":
      return error.message;
    case "not_found":
      return "Not found — this entry no longer exists. Refresh the page.";
    case "permission":
      return "Not permitted — only an active Super Staff member can change the calendar.";
    default:
      return rpcErrorMessage(error, fallback);
  }
}
