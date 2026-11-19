import { cache } from "react";
import { createClient } from "@/shared/supabase/server";
import type { Database } from "@/shared/supabase/types";

/** my_staff_profile could not be read, so who is signed in is unknown. */
export class ProfileReadError extends Error {
  constructor(cause: { message: string; code: string }) {
    super(`Could not read my_staff_profile: ${cause.message}`, { cause });
    this.name = "ProfileReadError";
  }
}

export type AdminProfileRow = Pick<
  Database["public"]["Views"]["my_staff_profile"]["Row"],
  "id" | "full_name" | "email" | "role" | "status"
>;

const COLUMNS = "id, full_name, email, role, status";

/**
 * The server's read of who is signed in, for the (shell) layout's gate and the
 * pages beneath it. React's cache() dedupes it across the layout and every
 * page in one render pass. The same shape as Staff's getMyProfileRow.
 *
 * Never the JWT: its claims are up to an hour stale, which would keep a
 * deactivated admin working for an hour.
 *
 * Server-only by construction: it imports the cookie-backed server client.
 *
 * null means the account has no staff row (or nobody is signed in: see
 * hasSession). A failed read throws ProfileReadError instead: it is no verdict
 * on the account, and answering null would have the gate call an active admin
 * not-an-employee. The throw reaches src/app/(admin)/error.tsx, which offers a
 * retry with the session intact.
 */
export const getAdminProfile = cache(async (): Promise<AdminProfileRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("my_staff_profile")
    .select(COLUMNS)
    .maybeSingle();

  if (error) throw new ProfileReadError(error);

  return data ?? null;
});

/**
 * Whether the server can see a signed-in user. Only asked once getAdminProfile
 * has come back empty, to tell "no session" (go to the sign-in) from "signed
 * in, but not an employee" (refuse). The request guard sends a signed-out
 * visitor away before any Admin page, so this is a fallback.
 */
export async function hasSession(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user !== null;
}
