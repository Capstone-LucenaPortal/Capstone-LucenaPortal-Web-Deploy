"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/shared/supabase/client";
import {
  ACTIVITY_EVENTS,
  IDLE_CHECK_INTERVAL_MS,
  IDLE_SIGNOUT_PATH,
  isIdleExpired,
  markActivity,
  readLastActivity,
} from "@/portals/staff/lib/supabase/idle-timeout";

/**
 * The browser half of the idle timeout (ISO-6). Moves the shared idle clock on
 * real input, and signs the tab out once the clock goes stale — so a screen
 * left open on an identity document does not stay open. The request guard
 * enforces the same clock on every request; see
 * src/portals/staff/lib/supabase/idle-timeout.ts.
 *
 * Date.now() rather than a handed-down moment: each event and tick is its own
 * moment, and there is no render beneath this to share one with.
 */
export function IdleTimeout() {
  const router = useRouter();
  const signingOut = useRef(false);

  useEffect(() => {
    async function signOutIdle() {
      if (signingOut.current) return;
      signingOut.current = true;
      // Leave whether or not the revoke succeeds: the clock stays stale, so
      // the request guard refuses the next request on its own.
      await createClient().auth.signOut({ scope: "local" });
      // replace(), not push(): the portal page must not be one Back away.
      router.replace(IDLE_SIGNOUT_PATH);
      router.refresh();
    }

    function signOutIfIdle(now: number): boolean {
      if (!isIdleExpired(readLastActivity(), now)) return false;
      void signOutIdle();
      return true;
    }

    // Checked before the clock moves: the click that wakes a screen after the
    // window closed must end the session, not rescue it.
    function onActivity(event?: Event) {
      // Leaving a tab is not using it.
      if (event?.type === "visibilitychange" && document.hidden) return;
      const now = Date.now();
      if (!signOutIfIdle(now)) markActivity(now);
    }

    // Mounting is a navigation, which a person made.
    onActivity();
    ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, onActivity, true));
    const tick = setInterval(() => signOutIfIdle(Date.now()), IDLE_CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, onActivity, true));
      clearInterval(tick);
    };
  }, [router]);

  return null;
}
