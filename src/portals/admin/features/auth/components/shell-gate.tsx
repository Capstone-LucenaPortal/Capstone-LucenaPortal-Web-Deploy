"use client";

// The browser-side half of the Admin shell's gate. The (shell) layout has
// already judged the session on the server and rendered the shell (issue
// #150); this part only watches what happens after that render:
//
// - the session ends mid-visit (signed out in another tab, expired): go to the
//   employee sign-in, with the idle note if the idle timer has run out;
// - a different user signs in mid-visit: hide the page until their profile
//   loads, then judge it with the same decideRoleAccess the server used.
//
// It never judges the user the server already judged again. AuthProvider
// drops profile read errors, so a same-user re-read that comes back empty says
// nothing about the account; a deactivation mid-visit is caught by the request
// guard on the next navigation.
//
// It must not hide anything during AuthProvider's first read of the session on
// page load: that blank is what #150 removed. AuthProvider starts with
// isLoading true and only raises it again on a user change, so "loaded once"
// is all it takes to tell the two apart. Same-user events (TOKEN_REFRESHED)
// never raise it, so they never unmount the page and any open PII review modal.
import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/use-auth";
import { AccessRefusal, type AccessRefusalDecision } from "./access-refusal";
import { decideRoleAccess } from "@/portals/admin/lib/supabase/access";
import {
  IDLE_SIGNOUT_PATH,
  isIdleExpired,
  readLastActivity,
} from "@/portals/admin/lib/supabase/idle-timeout";
import { EMPLOYEE_SIGN_IN_PATH } from "@/shared/guard/portals";

export function ShellGate({ children }: { children: ReactNode }) {
  const { session, isLoading, profile } = useAuth();
  const router = useRouter();
  const browserUserId = session?.user.id ?? null;

  // State adjusted during render rather than in effects (React's documented
  // pattern: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  // React re-renders straight away, so each of these fires once per change.
  //
  // The user the shell is showing: set by the browser's first read (the
  // session the server already judged), then by each different active admin
  // who signs in here. null until that first read is done.
  const [shownUser, setShownUser] = useState<{ id: string | null; switched: boolean } | null>(null);
  if (!isLoading && shownUser === null) {
    setShownUser({ id: browserUserId, switched: false });
  }
  const hasLoaded = shownUser !== null;

  // Only a different signed-in user is judged.
  const newUserDecision =
    shownUser && !isLoading && session && browserUserId !== shownUser.id
      ? decideRoleAccess(profile)
      : null;

  // AccessRefusal signs a deactivated account out on its own mount, which feeds
  // a real SIGNED_OUT back into AuthProvider (the browser Supabase client is a
  // singleton) and drops `session` to null a moment later. A refusal is pinned
  // so that drop can't swap it for a redirect.
  const [pinnedDecision, setPinnedDecision] = useState<AccessRefusalDecision | null>(null);
  const refusal =
    pinnedDecision ??
    (newUserDecision && newUserDecision.kind !== "allow" ? newUserDecision : null);
  if (refusal && !pinnedDecision) {
    setPinnedDecision(refusal);
  }

  if (newUserDecision?.kind === "allow") {
    setShownUser({ id: browserUserId, switched: true });
  }

  // The Sidebar's name came from the server, for the admin before. Ask the
  // server to render the shell again for the new one.
  useEffect(() => {
    if (shownUser?.switched) router.refresh();
  }, [shownUser, router]);

  useEffect(() => {
    if (hasLoaded && !isLoading && !session && !pinnedDecision) {
      // An idle sign-out ends the session too, and IdleTimeout sends the tab
      // to the idle note on its own. Whichever of the two redirects runs last
      // must agree, so a run-out timer means the idle note here as well; it
      // also gives a second open Admin tab the note. This relies on sign-out
      // leaving the idle clock as it was: a sign-out that cleared it would
      // send an idle tab here to the plain sign-in. replace(), not push():
      // the Admin page must not be one Back away.
      const idle = isIdleExpired(readLastActivity(), Date.now());
      router.replace(idle ? IDLE_SIGNOUT_PATH : EMPLOYEE_SIGN_IN_PATH);
    }
  }, [hasLoaded, isLoading, session, pinnedDecision, router]);

  if (refusal) {
    return <AccessRefusal decision={refusal} />;
  }

  // After the first read: a user change in progress, or a session that has
  // ended (the redirect above is on its way).
  if (hasLoaded && (isLoading || !session)) {
    return null;
  }

  return children;
}
