// src/shared/guard/proxy.ts
//
// The one request guard for the whole app. It gathers the inputs
// decideRequest (src/shared/guard/decide.ts) needs — session, staff profile,
// idle clock — and acts on its answer. The rules themselves are the
// per-Portal table in src/shared/guard/portals.ts.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { decideRequest, portalFor, type GuardDecision, type GuardInput } from "@/shared/guard/decide";
import { CLOCK_OFFSET_COOKIE, LAST_ACTIVITY_COOKIE, readIdleClock } from "@/shared/guard/idle-clock";
import { requireEnv } from "@/shared/supabase/env";
import { toSessionScopedCookieOptions } from "@/shared/supabase/session-cookie";
import type { Database } from "@/shared/supabase/types";

export async function guardRequest(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Paths outside every staff prefix (the Citizen Portal) get no server
  // check at all — not even a session refresh.
  const portal = portalFor(pathname);
  if (!portal) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  // The cache headers @supabase/ssr hands over with every cookie write. Kept
  // apart from `response` so a redirect can carry them without also carrying
  // Next's own proxy headers.
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Write to BOTH the request (so this render sees the fresh token)
          // and a rebuilt response (so the browser stores it).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          // See src/shared/supabase/session-cookie.ts — this keeps the login
          // session-scoped instead of persisting for 400 days.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, toSessionScopedCookieOptions(options)),
          );
          // A response that sets an auth cookie must not be cached, or a CDN
          // can serve one person's session to the next.
          cacheHeaders = headers;
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser(). getUser()
  // validates the token with the auth server and triggers the refresh;
  // getSession() only decodes whatever is in the cookie and trusts it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The idle clock is read only for Portals with an idle timeout, so the
  // others never get a clock-offset cookie. Date.now() is this request's one
  // moment.
  const now = Date.now();
  const clock =
    portal.idleTimeoutMs === null
      ? {}
      : readIdleClock(
          request.cookies.get(LAST_ACTIVITY_COOKIE)?.value,
          request.cookies.get(CLOCK_OFFSET_COOKIE)?.value,
          now,
        );

  const input: GuardInput = {
    pathname,
    hasSession: Boolean(user),
    lastActivity: clock.lastActivity,
    now,
  };
  let decision: GuardDecision = decideRequest(input);

  if (decision.kind === "read-profile") {
    // The role comes from the my_staff_profile view — the same source each
    // Portal's own client gate reads — never from JWT claims, which lag a
    // deactivation by up to the token's lifetime.
    const { data, error } = await supabase
      .from("my_staff_profile")
      .select("role, status")
      .maybeSingle();
    decision = decideRequest({
      ...input,
      profile: error ? { ok: false } : { ok: true, profile: data ?? null },
    });
  }

  // Whatever setAll wrote — a refreshed token, or the deletions of a failed
  // refresh or a sign-out — was written to `response`. A refusal replaces it,
  // so the cookies and cache headers must ride along, or the browser keeps a
  // dead auth cookie and a proxy may cache it.
  const withSessionCookies = (refusal: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => refusal.cookies.set(cookie));
    Object.entries(cacheHeaders).forEach(([key, value]) => refusal.headers.set(key, value));
    return refusal;
  };

  switch (decision.kind) {
    case "redirect":
      if (decision.signOut) {
        // Local scope: going idle at one desk must not end this person's
        // sessions on every other device. The request is refused whether or
        // not the revoke succeeds — the clock stays stale, so every later
        // request is refused the same way.
        await supabase.auth.signOut({ scope: "local" });
      }
      return withSessionCookies(NextResponse.redirect(new URL(decision.to, request.url)));
    case "unavailable":
      return withSessionCookies(
        new NextResponse("Could not confirm your access to this portal. Try again.", { status: 503 }),
      );
    case "read-profile":
      // Unreachable: decideRequest only asks for the profile when it has none.
      throw new Error("Guard asked for the staff profile twice");
    case "allow":
      // First reading of this session's clock: keep the measured gap between
      // the browser's clock and this one. Session-scoped, like the clock.
      // Only for a session: a clock left over on the login page belongs to
      // no one, and sign-in restarts it anyway.
      if (user && clock.offset !== undefined) {
        response.cookies.set(CLOCK_OFFSET_COOKIE, String(clock.offset), { path: "/", sameSite: "lax" });
      }
      return response;
  }
}
