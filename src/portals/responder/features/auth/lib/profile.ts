import { cache } from "react";
import { createClient } from "@/shared/supabase/server";
import type { MyStaffProfileFullRow } from "./responder-user";

/** my_staff_profile could not be read, so who is signed in is unknown. */
export class ProfileReadError extends Error {
  constructor(cause: { message: string; code: string }) {
    super(`Could not read my_staff_profile: ${cause.message}`, { cause });
    this.name = "ProfileReadError";
  }
}

const COLUMNS = "id, full_name, email, role, status, department_code, department_label, phone, employee_id, on_duty, created_at";

/**
 * The authoritative read of who is signed in for a render. React's cache()
 * dedupes it across the layout and every page in a single render pass. The
 * request guard makes its own, narrower read of the same view before the
 * render starts (src/shared/guard/proxy.ts); cache() cannot span the two.
 *
 * Never the JWT: the custom_access_token_hook is a dashboard setting no
 * migration captures, and its claims are up to an hour stale — which would
 * keep a deactivated responder working for an hour after being locked out.
 *
 * Server-only by construction: it imports the cookie-backed server client.
 *
 * null means the account has no staff row. A failed read throws
 * ProfileReadError instead: it is no verdict on the account, and answering
 * null would have the gate call an active responder not-an-employee and sign
 * them out. The throw reaches app/(responder)/error.tsx, which offers a retry
 * and never signs out — the page's counterpart of the guard's 503.
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
