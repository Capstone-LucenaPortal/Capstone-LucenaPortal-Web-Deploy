"use client";

// src/app/(admin)/admin/forbidden/page.tsx
//
// Landing page for the shared request guard's role check
// (src/shared/guard/decide.ts): an authenticated account that is not an
// active admin is redirected here before any admin page — markup, bundle, or
// data — is served to it. The (admin) layout keeps its own client-side gate
// as defense in depth; it and the guard judge the profile with the same
// judgeStaffProfile, and this page and the layout render the same
// AccessRefusal screen, so the gates cannot drift apart.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/portals/admin/features/auth/hooks/use-auth";
import { AccessRefusal, type AccessRefusalDecision } from "@/portals/admin/features/auth/components/access-refusal";
import { decideRoleAccess } from "@/portals/admin/lib/supabase/access";

export default function ForbiddenPage() {
  const { session, isLoading, isAdmin, profile } = useAuth();
  const router = useRouter();

  // AccessRefusal signs a deactivated account out on its own mount, which —
  // because @supabase/ssr's browser client is a singleton — feeds a real
  // SIGNED_OUT event back into the same AuthProvider this page reads from,
  // dropping `session` to null a moment later. Once a refusal has been decided, it is
  // pinned here so that later drop doesn't fall through to the "no session"
  // branch below and swap the screen for a /login redirect before the user
  // can read it (or recompute against a now-null profile and show a
  // different message).
  const [pinnedDecision, setPinnedDecision] = useState<AccessRefusalDecision | null>(null);

  const liveDecision = !isLoading && session && !isAdmin ? decideRoleAccess(profile) : null;
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
    if (isLoading || pinnedDecision) return;
    // No session: the proxy would bounce the next navigation to /login
    // anyway; do it directly. An active admin has no business here — likely a
    // stale redirect or a role restored mid-session — send them home.
    if (!session) {
      router.push("/admin/login");
    } else if (isAdmin) {
      router.push("/admin/dashboard");
    }
  }, [isLoading, session, isAdmin, router, pinnedDecision]);

  if (refusal) {
    return <AccessRefusal decision={refusal} />;
  }

  if (isLoading || !session || isAdmin) {
    return null;
  }

  return null;
}
