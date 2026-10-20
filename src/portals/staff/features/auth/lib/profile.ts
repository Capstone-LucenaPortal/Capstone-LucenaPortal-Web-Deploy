import { cache } from "react";
import { createClient } from "@/shared/supabase/server";
import type { MyStaffProfileFullRow } from "./staff-user";

/** my_staff_profile could not be read, so who is signed in is unknown. */
export class ProfileReadError extends Error {
  constructor(cause: { message: string; code: string }) {
    super(`Could not read my_staff_profile: ${cause.message}`, { cause });
    this.name = "ProfileReadError";
  }
}

const COLUMNS = "id, full_name, email, role, modules, is_supervisor, status, department_label, created_at";

/**
 * The one authoritative read of who is signed in. React's cache() dedupes it
 * across the layout and every page in a single render pass.
 *
 * Never the JWT: the custom_access_token_hook is a dashboard setting no
 * migration captures, and its claims are up to an hour stale — which would
 * keep a deactivated employee working for an hour after being locked out.
 *
 * Server-only by construction: it imports the cookie-backed server client.
 *
 * null means the account has no staff row. A failed read throws
 * ProfileReadError instead: it is no verdict on the account, and answering
 * null would have the gate call an active employee not-an-employee and sign
 * them out. The throw reaches src/app/(staff)/error.tsx, which offers a retry
 * with the session intact — the page's counterpart of the request guard's 503.
 */
export const getMyProfileRow = cache(
  async (): Promise<MyStaffProfileFullRow | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("my_staff_profile")
      .select(COLUMNS)
      .maybeSingle();

    if (error) throw new ProfileReadError(error);

    // COLUMNS is checked against the generated types while it stays one
    // literal on one line. The cast narrows the view's nullable columns to
    // the row type. Compile-time only.
    return (data as MyStaffProfileFullRow | null) ?? null;
  },
);
