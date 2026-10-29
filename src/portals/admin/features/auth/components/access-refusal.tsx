// src/portals/admin/features/auth/components/access-refusal.tsx
"use client";

// The refusal screen shown to a signed-in account that may not use this
// portal. Rendered from two places that must never drift apart: the (admin)
// layout's client-side gate, and /forbidden — where the shared request guard
// lands the same accounts before any admin page is served. Both
// call src/portals/admin/lib/supabase/access.ts's decideRoleAccess on the same profile, so the
// copy shown here can never disagree with the reason the guard redirected.
import { useEffect, useState } from "react";

import { Button } from "@/portals/admin/components/ui/button";
import { ROLE_ARTICLE, ROLE_LABEL } from "@/portals/admin/features/auth/lib/role-labels";
import { refusalEndsSession } from "@/shared/guard/decide";
import { CITIZEN_PORTAL_PATH, PORTAL_PREFIX } from "@/shared/guard/portals";
import { createClient } from "@/shared/supabase/client";
import type { RoleAccessDecision } from "@/portals/admin/lib/supabase/access";

export type AccessRefusalDecision = Exclude<RoleAccessDecision, { kind: "allow" }>;

function copy(decision: AccessRefusalDecision): {
  heading: string;
  body: string;
  link?: { href: string; label: string };
} {
  switch (decision.kind) {
    case "not-an-employee":
      return {
        heading: "This portal is for city employees",
        body: "You are signed in with an account that is not registered as a city employee. If you are a resident, use the citizen portal instead.",
        link: { href: CITIZEN_PORTAL_PATH, label: "Go to the citizen portal" },
      };
    case "wrong-portal":
      return {
        heading: "Wrong portal",
        body: `You are signed in with ${ROLE_ARTICLE[decision.role]} ${ROLE_LABEL[decision.role]} account. Use the ${ROLE_LABEL[decision.role]} portal instead.`,
        // The Portal's root, not its login: the session is kept, and the
        // root sends it on to that Portal's home.
        link: {
          href: PORTAL_PREFIX[decision.role],
          label: `Go to the ${ROLE_LABEL[decision.role]} portal`,
        },
      };
    case "deactivated":
      return {
        heading: "Your account has been deactivated",
        body: "Contact your Super Staff to have it reactivated.",
      };
  }
}

export function AccessRefusal({ decision }: { decision: AccessRefusalDecision }) {
  // Only a deactivated account is signed out, in this browser only (see
  // refusalEndsSession), here on arrival: neither the (admin) layout nor
  // /forbidden can clear the auth cookie from a Server Component.
  //
  // The result is observed rather than discarded: if the revoke call fails,
  // the cookie is still live server-side, and this screen must not claim a
  // sign-out that didn't happen — the same principle src/portals/admin/features/auth/hooks/use-auth.tsx's
  // signOut() and Sidebar.tsx already follow.
  const endsSession = refusalEndsSession(decision);
  const [signedOut, setSignedOut] = useState<boolean | null>(null);
  useEffect(() => {
    if (!endsSession) return;
    void createClient()
      .auth.signOut({ scope: "local" })
      .then(({ error }) => setSignedOut(!error));
  }, [endsSession]);

  const { heading, body, link } = copy(decision);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-bold text-blue-900">{heading}</h1>
      <p className="max-w-md text-sm text-gray-700">{body}</p>
      {signedOut === true && (
        <p className="max-w-md text-sm text-gray-500">
          You have been signed out of this portal.
        </p>
      )}
      {signedOut === false && (
        <p className="max-w-md text-sm text-gray-500">
          We could not sign you out automatically — close this browser tab to end your session.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {link && (
          <a href={link.href}>
            <Button variant="primary">{link.label}</Button>
          </a>
        )}
        <a href="/admin/login">
          <Button variant="secondary">Back to sign in</Button>
        </a>
      </div>
    </div>
  );
}
