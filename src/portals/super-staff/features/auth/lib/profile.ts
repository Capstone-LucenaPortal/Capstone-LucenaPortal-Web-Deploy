import { createClient } from "@/shared/supabase/server";
import type { StaffProfile } from "../types";
import { MY_STAFF_PROFILE_COLUMNS, toStaffProfile } from "./gate";

/** my_staff_profile could not be read, so who is signed in is unknown. */
export class ProfileReadError extends Error {
  constructor(cause: { message: string; code: string }) {
    super(`Could not read my_staff_profile: ${cause.message}`, { cause });
    this.name = "ProfileReadError";
  }
}

/**
 * The one authoritative read of who is signed in — once per page load, in the
 * protected layout. Never the JWT: the custom_access_token_hook is a dashboard
 * setting no migration captures, and its claims are up to an hour stale, which
 * would keep a deactivated employee working for an hour (spec decision 2).
 *
 * Server-only by construction: it imports the cookie-backed server client.
 * (The `server-only` package is not a dependency of this repo, so there is no
 * import to enforce it — this file is only ever reached from a Server
 * Component.)
 *
 * null means the account has no staff row. A failed read throws
 * ProfileReadError instead: it is no verdict on the account, and answering
 * null would have the gate call an active employee not-an-employee and sign
 * them out. The throw reaches app/error.tsx, which offers a retry with the
 * session intact.
 */
export async function getStaffProfile(): Promise<StaffProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_staff_profile")
    .select(MY_STAFF_PROFILE_COLUMNS)
    .maybeSingle();

  if (error) throw new ProfileReadError(error);

  return toStaffProfile(data);
}
