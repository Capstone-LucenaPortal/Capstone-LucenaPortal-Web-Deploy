import {
  createBrowserClient,
  parseCookieHeader,
  serializeCookieHeader,
  type CookieMethodsBrowser,
} from "@supabase/ssr";

import { requireEnv } from "@/shared/supabase/env";
import { toSessionScopedCookieOptions } from "@/shared/supabase/session-cookie";
import type { Database } from "@/shared/supabase/types";

/**
 * The browser's cookie adapter for @supabase/ssr: read from document.cookie,
 * write session-scoped. Shared by this client and the Citizen Portal's
 * (src/portals/citizen/lib/supabase/client.ts), which differ only in the
 * cookie's name (ADR 0004, 0007).
 */
export const sessionScopedDocumentCookies = {
  getAll() {
    return parseCookieHeader(document.cookie);
  },
  // See src/shared/supabase/session-cookie.ts — this keeps the login
  // session-scoped instead of persisting for 400 days.
  setAll(cookiesToSet) {
    cookiesToSet.forEach(({ name, value, options }) => {
      document.cookie = serializeCookieHeader(
        name,
        value,
        toSessionScopedCookieOptions(options),
      );
    });
  },
} satisfies CookieMethodsBrowser;

/**
 * Browser-side Supabase client.
 *
 * createBrowserClient is already a singleton internally, so calling this from
 * many components does not create many clients.
 *
 * Reads are safe from the browser here by design: PL-12 means every base table
 * is revoked and every view scopes itself, so an unauthorised caller receives
 * an empty result set rather than data.
 */
export function createClient() {
  return createBrowserClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    { cookies: sessionScopedDocumentCookies },
  );
}
