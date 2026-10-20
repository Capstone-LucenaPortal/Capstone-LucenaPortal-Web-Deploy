// src/shared/supabase/session-cookie.ts
//
// The one session-cookie policy, shared by every Supabase cookie adapter: the
// browser client (src/shared/supabase/client.ts), the server client
// (src/shared/supabase/server.ts) and the request guard
// (src/shared/guard/proxy.ts). @supabase/ssr's cookie storage hardcodes a
// 400-day Max-Age (its DEFAULT_COOKIE_OPTIONS) on every auth cookie it
// writes, regardless of any cookieOptions passed to the client factories.
// Stripping maxAge/expires in each adapter's own setAll is the only way to
// make the cookie session-scoped instead: the browser then drops it when it
// fully closes, rather than keeping a login valid for over a year.
//
// Taken from the Staff Portal (post-SCRUM-178), which keeps maxAge 0: that is
// how @supabase/ssr deletes a cookie, and stripping it would leave a
// signed-out browser holding an empty auth cookie until it closed.
//
// Two auth cookies, two sessions. The default name, sb-<project-ref>-auth-token,
// is the one staff-side cookie, kept on purpose — one staff session per site
// (ADR 0004), so no per-Portal cookie names — and it is the only one the
// request guard reads. Citizens use their own, sb-<project-ref>-citizen-auth-token
// (citizenAuthCookieName below, ADR 0007), so a citizen sign-in and a staff
// sign-in in one browser never overwrite each other.
import type { CookieOptions } from "@supabase/ssr";

// The project ref exactly as supabase-js derives it for its default storage
// key, so the two names can only ever differ by the "citizen-" part.
export function citizenAuthCookieName(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-citizen-auth-token`;
}

export function toSessionScopedCookieOptions(options: CookieOptions): CookieOptions {
  const sessionOptions = { ...options };
  if (sessionOptions.maxAge !== 0) delete sessionOptions.maxAge;
  delete sessionOptions.expires;
  return sessionOptions;
}
