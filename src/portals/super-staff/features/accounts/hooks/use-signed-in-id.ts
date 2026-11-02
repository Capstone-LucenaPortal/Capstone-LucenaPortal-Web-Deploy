"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/shared/supabase/client";

/**
 * The signed-in Super-staff's id, read from the cookie without a round-trip.
 * It only shapes the screen; the database and staff-accounts refuse what one
 * may not do to one's own account. null until it arrives, and if the read fails.
 */
export function useSignedInId(): string | null {
  const [signedInId, setSignedInId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (active) setSignedInId(data.session?.user.id ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return signedInId;
}
