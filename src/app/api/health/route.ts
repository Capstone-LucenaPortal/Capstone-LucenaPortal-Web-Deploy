import { requireEnv } from "@/shared/supabase/env";

/** A probe slower than this counts as the database being unreachable. */
const PROBE_TIMEOUT_MS = 5000;

/**
 * Unauthenticated reachability check for Super-staff's System Health page
 * (#72). It answers `{ ok, db_ok, ms }` and nothing more: no table, job,
 * version or error text, because anyone can call it.
 *
 * `ok` is true whenever this handler runs at all — the app answered. `db_ok`
 * and `ms` come from one request using only the public anon key: a zero-row
 * read of `public_booking_config`, a view anon can already read. That goes
 * through PostgREST to Postgres, so it proves the database answers. The auth
 * service's /health was the other candidate, but it reports its own version
 * without touching the database. No service-role key, and no new
 * anon-callable DB function.
 */
export async function GET(): Promise<Response> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = requireEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const started = performance.now();
  let dbOk = false;
  try {
    const res = await fetch(`${url}/rest/v1/public_booking_config?limit=0`, {
      headers: { apikey: anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    dbOk = res.ok;
  } catch {
    // Network failure or timeout. The reason stays here, never in the body.
  }
  const ms = Math.round(performance.now() - started);

  return Response.json(
    { ok: true, db_ok: dbOk, ms },
    { headers: { "Cache-Control": "no-store" } },
  );
}
