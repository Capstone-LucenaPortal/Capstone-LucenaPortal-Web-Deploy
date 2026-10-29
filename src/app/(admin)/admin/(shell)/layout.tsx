"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/portals/admin/features/auth/hooks/use-auth";
import { AccessRefusal, type AccessRefusalDecision } from "@/portals/admin/features/auth/components/access-refusal";
import { Sidebar } from "@/portals/admin/components/layout/sidebar";
import { decideRoleAccess } from "@/portals/admin/lib/supabase/access";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { session, isLoading, profile } = useAuth();
  const router = useRouter();

  // AccessRefusal signs a deactivated account out on its own mount, which —
  // because @supabase/ssr's browser client is a singleton — feeds a real
  // SIGNED_OUT event back into the same AuthProvider this layout reads from,
  // dropping `session` to null a moment later. Once a refusal has been decided, it is
  // pinned here so that later drop doesn't fall through to the "no session"
  // branch below and swap the screen for a /login redirect before the user
  // can read it (or recompute against a now-null profile and show a
  // different message).
  const [pinnedDecision, setPinnedDecision] = useState<AccessRefusalDecision | null>(null);

  // Client-side half of the role gate — the proxy already redirects a
  // refused session to /forbidden before these pages are served, but this
  // branch stays as defense in depth (and covers a role change mid-session,
  // which the proxy only sees on the next navigation). decideRoleAccess is
  // the same function /forbidden calls, so the two gates cannot drift apart.
  const liveDecision = !isLoading && session ? decideRoleAccess(profile) : null;
  const liveRefusal: AccessRefusalDecision | null =
    liveDecision && liveDecision.kind !== "allow" ? liveDecision : null;
  const refusal = pinnedDecision ?? liveRefusal;

  // Adjusting state during render (React's documented pattern for this —
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // rather than in a useEffect: this pin only ever needs to happen once, and
  // React discards this render's output and immediately re-renders when
  // setState is called during render, so `refusal` is already
  // `pinnedDecision` by the next pass — the guard can't fire twice. Same
  // observable behavior as the effect it replaces (fires exactly once), just
  // resolved one render-cycle earlier instead of after a commit + effect.
  if (refusal && !pinnedDecision) {
    setPinnedDecision(refusal);
  }

  useEffect(() => {
    if (!isLoading && !session && !pinnedDecision) {
      router.push("/admin/login");
    }
  }, [isLoading, session, router, pinnedDecision]);

  if (refusal) {
    return <AccessRefusal decision={refusal} />;
  }

  if (isLoading) {
    return null;
  }

  if (!session) {
    return null;
  }

  return (
    // Column below md so Sidebar's mobile top bar sits above the content
    // instead of being squeezed into a row alongside it; row from md up,
    // matching Sidebar's own md breakpoint for switching from the off-canvas
    // drawer to the static side column.
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* First focusable element in the DOM, ahead of Sidebar's hamburger/nav
          links, so it is the first Tab stop on every admin page. Visually
          hidden until focused (sr-only / focus:not-sr-only), matching the
          conventional skip-link pattern — this codebase has no prior
          skip-link to match (src/app/(admin)/admin/login/page.tsx renders a bare <main> with
          no such anchor), so the visual treatment below (blue-900, rounded-
          none, ring-white) is new but follows the site's existing focus-ring
          and rounded-none conventions (see Modal.tsx / Sidebar.tsx). */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-none focus:bg-blue-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
      >
        Skip to content
      </a>
      <Sidebar />
      {/* Padding is coupled to PageHero's negative-margin bleed (see that
          file) — keep these two in lockstep at every breakpoint.
          tabIndex={-1} lets the skip link move focus here programmatically
          (href="#main") without adding a stop to the normal Tab order. */}
      <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto p-4 md:p-8 focus:outline-none">
        {children}
      </main>
    </div>
  );
}
