// src/shared/supabase/server.ts
//
// Taken from the Staff Portal (post-SCRUM-178).
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireEnv } from "@/shared/supabase/env";
import { toSessionScopedCookieOptions } from "@/shared/supabase/session-cookie";
import type { Database } from "@/shared/supabase/types";

/**
 * Server-side Supabase client, for Server Components, Server Actions and
 * Route Handlers. The request guard builds its own client against the
 * request's cookies (src/shared/guard/proxy.ts).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // See src/shared/supabase/session-cookie.ts — this keeps the login
            // session-scoped instead of persisting for 400 days.
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, toSessionScopedCookieOptions(options)),
            );
          } catch {
            // Called from a Server Component — cookie writes are ignored there.
          }
        },
      },
    },
  );
}

/**
 * Whatever the factory above returns — the type for a client passed into a
 * function rather than built by it. `Awaited` because the factory is async.
 * Staff's server actions take one (MRG-04).
 */
export type Db = Awaited<ReturnType<typeof createClient>>;
