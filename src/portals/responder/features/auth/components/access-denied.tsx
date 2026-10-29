"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/shared/supabase/client";
import { refusalEndsSession } from "@/shared/guard/decide";
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

export function AccessDenied({ decision }: { decision: Refusal }) {
  // Only a deactivated account is signed out, in this browser only (see
  // refusalEndsSession). A Server Component cannot clear the auth cookie, so
  // the sign-out runs here.
  const endsSession = refusalEndsSession(decision);
  const [signedOut, setSignedOut] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // StrictMode runs effects twice in development. The second sign-out is
    // harmless but it makes "you have been signed out" a claim about two
    // round-trips instead of one.
    if (!endsSession || started.current) return;
    started.current = true;

    void createClient()
      .auth.signOut({ scope: "local" })
      // A failed sign-out still opens the exits. Stranding someone on a
      // refusal screen with no working button is worse than sending them to
      // the sign-in form.
      .catch((cause: unknown) => {
        console.error("access-denied: could not sign out", cause);
      })
      .finally(() => setSignedOut(true));
  }, [endsSession]);

  const exitsOpen = !endsSession || signedOut;

  const { heading, body, link } = copy(decision);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6">
        <h1 className="text-[17px] leading-tight font-bold text-gray-900">
          {heading}
        </h1>
        <p className="mt-2.5 text-[13px] text-pretty text-gray-600">{body}</p>
        {endsSession && (
          <p className="mt-2.5 text-[12.5px] text-gray-500">
            {signedOut
              ? "You have been signed out of this portal."
              : "Signing you out of this portal…"}
          </p>
        )}
        {/* When the session is being ended, the exits stay shut until the
            cookie is actually gone. Leaving them live would let a click race
            the sign-out: the browser would carry the deactivated responder's
            valid session to /responder/login, the request guard would send it
            on to /responder/pool, and its role check would send it right back
            to /responder/forbidden. A kept session has no such race. */}
        <div className="mt-5 flex flex-col gap-2.5">
          {exitsOpen ? (
            <>
              {link && (
                <a
                  href={link.href}
                  className="flex h-12 items-center justify-center rounded-md bg-lucena-blue text-[15px] font-semibold text-white hover:bg-lucena-blue-dark"
                >
                  {link.label}
                </a>
              )}
              <a
                href="/responder/login"
                className="flex h-12 items-center justify-center rounded-md border border-gray-300 bg-white text-[15px] font-semibold text-gray-900 hover:bg-gray-50"
              >
                Back to sign in
              </a>
            </>
          ) : (
            <button
              type="button"
              disabled
              className="flex h-12 items-center justify-center rounded-md border border-gray-200 bg-white text-[15px] font-semibold text-gray-400"
            >
              Signing out…
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
