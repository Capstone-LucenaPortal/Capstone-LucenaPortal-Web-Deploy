"use client";

import { useEffect } from "react";
import { Button } from "@/portals/staff/components/ui/button";
import { Card } from "@/portals/staff/components/ui/card";
import { createClient } from "@/shared/supabase/client";
import { CITIZEN_PORTAL_PATH, PORTAL_PREFIX } from "@/shared/guard/portals";
import type { GateDecision } from "../lib/gate";
import { ROLE_ARTICLE, ROLE_LABEL } from "../lib/role-labels";

type Refusal = Exclude<GateDecision, { kind: "allow" }>;

function copy(decision: Refusal): {
  heading: string;
  body: string;
  link?: { href: string; label: string };
} {
  switch (decision.kind) {
    case "not-an-employee":
      return {
        heading: "This portal is for city employees",
        body: "Your account is not registered as a city employee. If you are a resident, use the citizen portal instead.",
        link: { href: CITIZEN_PORTAL_PATH, label: "Go to the citizen portal" },
      };
    case "wrong-portal":
      return {
        heading: "Wrong portal",
        body: `Your account is ${ROLE_ARTICLE[decision.role]} ${ROLE_LABEL[decision.role]} account. Sign in at the ${ROLE_LABEL[decision.role]} portal instead.`,
        link: {
          href: `${PORTAL_PREFIX[decision.role]}/login`,
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

export function AccessDenied({ decision }: { decision: Refusal }) {
  // A Server Component cannot clear the auth cookie, so the sign-out runs
  // here. Leaving a live session in a portal it does not belong to means
  // every gated query returns 200 and an empty array — a working-looking
  // page with no data and no explanation.
  useEffect(() => {
    void createClient().auth.signOut();
  }, []);

  const { heading, body, link } = copy(decision);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-xl font-bold text-lucena-blue">{heading}</h1>
        <p className="mt-3 text-sm text-gray-600">{body}</p>
        <p className="mt-3 text-sm text-gray-500">
          You have been signed out of this portal.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {link && (
            <a href={link.href}>
              <Button variant="primary">{link.label}</Button>
            </a>
          )}
          <a href="/staff/login">
            <Button variant="secondary">Back to sign in</Button>
          </a>
        </div>
      </Card>
    </main>
  );
}
