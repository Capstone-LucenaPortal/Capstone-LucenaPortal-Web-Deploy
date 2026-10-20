import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A real supabase-js client over a stub fetch, so the test pins what goes on
 * the wire — the view and its columns — rather than a hand-written query
 * chain. getStaffProfile takes no client, so stubbing the factory is the only
 * way in.
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

const { getStaffProfile, ProfileReadError } = await import("./profile");

const ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Maria Santos",
  email: "maria.santos@lucenacity.gov.ph",
  role: "super_staff",
  status: "active",
};

/** A client whose every request is answered with `status` and `body`. */
function clientAnswering(status: number, body: unknown) {
  const requests: URL[] = [];
  const fetch = async (input: RequestInfo | URL) => {
    requests.push(new URL(input instanceof Request ? input.url : input));
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  factory.returns = createSupabaseClient("https://example.supabase.co", "anon-key", {
    global: { fetch },
  });
  return requests;
}

afterEach(() => {
  factory.returns = null;
});

describe("getStaffProfile", () => {
  it("reads the signed-in account's row from my_staff_profile", async () => {
    const requests = clientAnswering(200, [ROW]);

    await expect(getStaffProfile()).resolves.toEqual({
      id: ROW.id,
      fullName: ROW.full_name,
      email: ROW.email,
      role: ROW.role,
      status: ROW.status,
    });

    expect(requests[0].pathname).toBe("/rest/v1/my_staff_profile");
    expect(requests[0].searchParams.get("select")?.split(",")).toEqual(Object.keys(ROW));
  });

  it("returns null for a signed-in account with no staff row", async () => {
    clientAnswering(200, []);

    await expect(getStaffProfile()).resolves.toBeNull();
  });

  // Not null: the gate would judge that not-an-employee and sign them out.
  it("throws on a failed read instead of answering null", async () => {
    clientAnswering(500, {
      code: "57014",
      message: "canceling statement due to statement timeout",
    });

    await expect(getStaffProfile()).rejects.toBeInstanceOf(ProfileReadError);
  });
});
