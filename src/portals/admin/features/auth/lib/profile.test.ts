// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

// What the stubbed server-client factory hands back. getAdminProfile and
// hasSession take no client, so stubbing the factory is the only way in — as
// in src/portals/staff/features/auth/lib/profile.test.ts.
type Result = { data: unknown; error: { message: string; code: string } | null };
const { server } = vi.hoisted(() => ({
  server: {
    profile: { data: null, error: null } as Result,
    user: null as { id: string } | null,
    tables: [] as string[],
  },
}));

vi.mock("@/shared/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      server.tables.push(table);
      return { select: () => ({ maybeSingle: async () => server.profile }) };
    },
    auth: { getUser: async () => ({ data: { user: server.user }, error: null }) },
  }),
}));

const { getAdminProfile, hasSession, ProfileReadError } = await import("./profile");

const ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Maria Santos",
  email: "maria.santos@lucenacity.gov.ph",
  role: "admin",
  status: "active",
};

afterEach(() => {
  server.profile = { data: null, error: null };
  server.user = null;
  server.tables = [];
});

describe("getAdminProfile", () => {
  it("reads the signed-in account's row from my_staff_profile", async () => {
    server.profile = { data: ROW, error: null };

    await expect(getAdminProfile()).resolves.toEqual(ROW);
    expect(server.tables).toEqual(["my_staff_profile"]);
  });

  it("returns null for an account with no staff row", async () => {
    await expect(getAdminProfile()).resolves.toBeNull();
  });

  // Not null: the gate would call an active admin not-an-employee.
  it("throws on a failed read instead of answering null", async () => {
    server.profile = { data: null, error: { code: "57014", message: "statement timeout" } };

    await expect(getAdminProfile()).rejects.toBeInstanceOf(ProfileReadError);
  });
});

describe("hasSession", () => {
  it("is true when the server can see a signed-in user", async () => {
    server.user = { id: ROW.id };
    await expect(hasSession()).resolves.toBe(true);
  });

  it("is false when nobody is signed in", async () => {
    await expect(hasSession()).resolves.toBe(false);
  });
});
