"use client";

import { useEffect, useState } from "react";

import type { StaffRole } from "@/shared/guard/portals";
import { createClient } from "@/shared/supabase/client";

/**
 * The staff role of the account already signed in to this browser, or null:
 * no session, no staff row, or not yet read. Every Portal shares one session,
 * so another Portal's account is served a login page with its session kept
 * (issue #19); the page uses this to say who is signed in.
 *
 * getSession() reads the cookie without a round-trip, so a signed-out visit
 * costs no profile read. Trusting the cookie is fine here: the answer only
 * words a note, it grants nothing.
 */
export function useSignedInStaffRole(): StaffRole | null {
  const [role, setRole] = useState<StaffRole | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function read() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from("my_staff_profile").select("role").maybeSingle();
      if (active) setRole(data?.role ?? null);
    }

    // The note is a courtesy: a failed read, thrown or returned as an error,
    // leaves the form as it was.
    read().catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return role;
}
