/**
 * The one check that the app and the database actually agree.
 *
 * Type checking is the PRIMARY check and it is cheaper — but it cannot catch
 * the failure that matters most here: a view that EXISTS, whose types are
 * correct, and which returns an empty list because a gate silently refused.
 * Roles are exact and a failed gate returns HTTP 200 with zero rows, which is
 * indistinguishable from an empty pool. This script tells them apart by signing
 * in as an account that MUST see rows.
 *
 * 🔴 READ-ONLY. It claims nothing and writes nothing. Integration tests that
 * write to the Sandbox are explicitly out of scope: they would mutate rows the
 * DB repo's behavioural assertions depend on, and one_active_claim_per_responder
 * means two of them cannot run concurrently.
 *
 * 🔴 NOT PART OF `npm test` — and not a `.test.ts`, so Vitest never collects
 * it. A test needing network and credentials must not be able to fail the unit
 * suite — a red build that means "the sandbox was asleep" trains people to
 * ignore red builds.
 *
 * ⚠️ tsx does NOT load .env.local. Next does; a bare script does not. Run it via
 * `npm run smoke:responder`, which passes --env-file=.env.local (Node 20.6+).
 *
 * It signs in and reads the database directly, never through the app's
 * routes, so the /responder prefix (MRG-06) does not enter into it.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EMAIL = process.env.SMOKE_EMAIL ?? "dev.responder@lucena.local";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "DevResponder!2026";

/** Every key the pool card, the report pane and the held ticket read. */
const REQUIRED_KEYS = [
  "id",
  "reference_number",
  "type_label",
  "category_label",
  "incident_level",
  "status",
  "is_verified",
  "description",
  "address",
  "barangay_name",
  "sla_armed_at",
  "sla_due_at",
  "submitted_at",
  "pooled_at",
  "reporter_first_name",
  "reporter_phone",
  "before_photo_count",
  "after_photo_count",
  "cycle_number",
] as const;

const failures: string[] = [];
function check(condition: boolean, message: string) {
  if (!condition) failures.push(message);
}

async function main() {
  if (!URL || !KEY) throw new Error("smoke: NEXT_PUBLIC_SUPABASE_* are not set");
  if (URL.includes("uifixsfdujcezuxopnvz")) {
    throw new Error("smoke: that is PRODUCTION. Point .env.local at the sandbox.");
  }

  const supabase = createClient(URL, KEY);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (signInError) throw new Error(`smoke: sign-in failed — ${signInError.message}`);

  // 1. The pool. THE assertion: a gate that silently refused returns [] here.
  const { data: pool, error: poolError } = await supabase
    .from("responder_incidents")
    .select(REQUIRED_KEYS.join(", "))
    .eq("status", "in_pool");

  if (poolError) throw new Error(`smoke: responder_incidents — ${poolError.message}`);
  check(
    (pool?.length ?? 0) > 0,
    "responder_incidents returned ZERO rows for a seeded responder. Either the " +
      "department gate is refusing (is the account active, and does its " +
      "department_code match the seeded incidents?) or seed_responder_pool.sql " +
      "has not been run.",
  );

  // 2. Every key the app reads is actually present. A missing column arrives as
  //    `undefined`, not as an error — the exact failure mode decision C1 makes
  //    the generated type file load-bearing to prevent.
  // Through `unknown`: a runtime-built select() string gives postgrest-js no
  // literal to infer from, so it widens the row to GenericStringError. The
  // check below is a plain `key in row`, which is exactly the point — it must
  // see what the wire actually returned, not what the types promised.
  const row = (pool?.[0] ?? {}) as unknown as Record<string, unknown>;
  for (const key of REQUIRED_KEYS) {
    check(key in row, `responder_incidents is missing the column "${key}"`);
  }

  // 3. The three views l56 added exist and are readable. They return [] for a
  //    responder with no events, so this asserts "no error", not "rows".
  for (const view of [
    "responder_incident_events",
    "responder_incident_photos",
    "responder_history",
  ]) {
    const { error } = await supabase.from(view).select("id").limit(1);
    check(!error, `${view} is unreadable — ${error?.message}`);
  }

  // 4. The config read the photo cap depends on.
  const { data: config, error: configError } = await supabase
    .from("public_incident_config")
    .select("max_photos_per_cycle")
    .maybeSingle();
  check(!configError && config != null, "public_incident_config is unreadable");

  // 5. The inbox the nav badge counts.
  const { error: inboxError } = await supabase
    .from("my_notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  check(!inboxError, `my_notifications is unreadable — ${inboxError?.message}`);

  await supabase.auth.signOut();

  if (failures.length) {
    console.error(`smoke: ${failures.length} failure(s)`);
    failures.forEach((f) => console.error(`  ✗ ${f}`));
    // ⚠️ THIS is what makes it a check rather than a log. A script that prints
    // failures and exits 0 is a script whose red never stops anything.
    process.exit(1);
  }
  console.log(
    `smoke: OK — ${pool!.length} pool rows, all ${REQUIRED_KEYS.length} keys present`,
  );
}

main().catch((error) => {
  console.error(`smoke: ${error.message}`);
  process.exit(1);
});
