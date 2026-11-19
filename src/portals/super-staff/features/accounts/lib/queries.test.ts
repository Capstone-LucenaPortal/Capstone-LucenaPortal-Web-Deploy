import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountHistory } from "./queries";

// Tested at the network: the supabase-js builder is real, and the fake stands
// in for PostgREST on `super_audit_log`, answering every request with `rows`.

const ACCOUNT_ID = "22222222-2222-2222-2222-222222222222";

let rows: Record<string, unknown>[];
let requests: URL[];

async function fakePostgrest(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(String(input));
  requests.push(url);
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// One client, as the browser has: each new one would warn about sharing GoTrue
// storage.
let client: ReturnType<typeof createSupabaseClient> | undefined;
vi.mock("@/shared/supabase/client", () => ({
  createClient: () =>
    (client ??= createSupabaseClient("https://fake.supabase.co", "anon-key", {
      auth: { persistSession: false },
      global: { fetch: fakePostgrest },
    })),
}));

const auditRow = (patch: Record<string, unknown> = {}) => ({
  id: "a1",
  occurred_at: "2026-11-10T02:15:00+00:00",
  actor_name: "Maria Santos",
  area: "accounts",
  target_kind: "staff_account",
  target_id: ACCOUNT_ID,
  target_label: "juan.delacruz@lucenacity.gov.ph",
  change: "Deactivated account",
  detail: "Transferred to another office",
  changes: { status: { from: "active", to: "inactive" } },
  ...patch,
});

beforeEach(() => {
  rows = [];
  requests = [];
});

describe("getAccountHistory", () => {
  it("names the report an entry returned to the pool", async () => {
    rows = [
      auditRow({
        changes: {
          status: { from: "active", to: "inactive" },
          report_released: "INC-2026-000042",
        },
      }),
    ];

    const [item] = await getAccountHistory(ACCOUNT_ID);

    expect(item.summary).toBe(
      "Deactivated account — Transferred to another office · Report INC-2026-000042 returned to the pool",
    );
  });

  it("names it on an entry with no detail", async () => {
    rows = [
      auditRow({
        change: "Updated account",
        detail: null,
        changes: { report_released: "INC-2026-000042" },
      }),
    ];

    const [item] = await getAccountHistory(ACCOUNT_ID);

    expect(item.summary).toBe(
      "Updated account · Report INC-2026-000042 returned to the pool",
    );
  });

  it("leaves every entry that released nothing as it was", async () => {
    rows = [
      auditRow({ id: "a1" }),
      auditRow({ id: "a2", change: "Updated account", detail: null, changes: null }),
      auditRow({ id: "a3", changes: { report_released: 42 } }),
    ];

    const items = await getAccountHistory(ACCOUNT_ID);

    expect(items.map((i) => i.summary)).toEqual([
      "Deactivated account — Transferred to another office",
      "Updated account",
      "Deactivated account — Transferred to another office",
    ]);
  });

  it("reads changes alongside the account's entries, matched on its id", async () => {
    rows = [auditRow()];

    await getAccountHistory(ACCOUNT_ID);

    // The request that reads the entries, after the one that finds the newest.
    const url = requests.find((u) => u.searchParams.has("offset"));
    if (!url) throw new Error("No entries were read.");
    expect(url.searchParams.get("select")).toContain("changes");
    expect(url.searchParams.get("target_id")).toBe(`eq.${ACCOUNT_ID}`);
  });
});
