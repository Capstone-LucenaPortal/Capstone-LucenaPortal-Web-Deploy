import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getMyProfileRow, ProfileReadError } from "./profile";

/**
 * A real supabase-js client over a stubbed fetch, so the query getMyProfileRow
 * builds goes on the wire and is checked there. getMyProfileRow is cache()d
 * and takes no client, so stubbing the factory is the only way in.
 */
const { factory } = vi.hoisted(() => ({
  factory: { returns: null as unknown },
}));

vi.mock("@/shared/supabase/server", () => ({
  createClient: async () => {
    if (!factory.returns) throw new Error("no test client was set for this call");
    return factory.returns;
  },
}));

/**
 * Hands getMyProfileRow a client whose every request is answered with
 * `status` and `body`. Returns the URLs it was asked for.
 */
function installClientAnswering(status: number, body: unknown) {
  const urls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    urls.push(new Request(input).url);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  factory.returns = createSupabaseClient("https://example.supabase.co", "anon-key", {
    global: { fetch },
  });
  return urls;
}

const ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Maria Santos",
  email: "maria.santos@lucenacity.gov.ph",
  role: "responder",
  status: "active",
  department_code: "cdrrmo",
  department_label: "CDRRMO",
  phone: null,
  employee_id: null,
  on_duty: false,
  created_at: "2026-01-15T08:00:00.000Z",
};

afterEach(() => {
  factory.returns = null;
});

describe("getMyProfileRow", () => {
  it("reads the signed-in account's row from my_staff_profile", async () => {
    const urls = installClientAnswering(200, [ROW]);

    await expect(getMyProfileRow()).resolves.toEqual(ROW);

    const url = new URL(urls[0]);
    expect(url.pathname).toBe("/rest/v1/my_staff_profile");
    expect(url.searchParams.get("select")?.split(",").sort()).toEqual(Object.keys(ROW).sort());
  });

  it("returns null for a signed-in account with no staff row", async () => {
    installClientAnswering(200, []);

    await expect(getMyProfileRow()).resolves.toBeNull();
  });

  // Not null: the gate would judge that not-an-employee and sign them out.
  it("throws on a failed read instead of answering null", async () => {
    installClientAnswering(500, {
      code: "57014",
      message: "canceling statement due to statement timeout",
      details: null,
      hint: null,
    });

    const error = await getMyProfileRow().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProfileReadError);
    expect((error as Error).cause).toMatchObject({ code: "57014" });
  });
});
