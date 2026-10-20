// src/shared/supabase/env.ts
//
// Replaces the `process.env.X!` non-null assertions that used to feed the
// Supabase clients: a missing variable then surfaced as an opaque fetch error
// deep inside supabase-js instead of a clear boot-time failure.
//
// Callers must pass the literal `process.env.NEXT_PUBLIC_...` expression as
// the second argument — Next.js only inlines NEXT_PUBLIC_ variables into
// client bundles when they appear as literal member accesses, so a dynamic
// `process.env[name]` lookup here would always be undefined in the browser.
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        "Copy .env.example to .env.local and fill in the Supabase project values.",
    );
  }
  return value;
}
