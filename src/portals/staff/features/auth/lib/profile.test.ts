import { afterEach, describe, expect, it, vi } from "vitest";
import {
  columnsOf,
  createFailingFetch,
  createRecordingFetch,
  createTestClient,
  parseQueryParams,
} from "@/portals/staff/lib/supabase/testing";

/**
 * What the stubbed factory hands back: a real client over a recording fetch,
 * per ADR 0001. getMyProfileRow is cache()d and takes no client, so stubbing
 * the factory is the only way in — as in gated-document.test.ts.
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

const { getMyProfileRow, ProfileReadError } = await import("./profile");

const ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Juan Dela Cruz",
  email: "juan.delacruz@lucenacity.gov.ph",
  role: "staff",
  modules: ["incidents"],
  is_supervisor: false,
  status: "active",
  department_label: "Yellow Card Office",
  created_at: "2026-01-15T08:00:00.000Z",
};

afterEach(() => {
  factory.returns = null;
});

describe("getMyProfileRow", () => {
  it("reads the signed-in account's row from my_staff_profile", async () => {
    const { fetch, requests } = createRecordingFetch([ROW]);
    factory.returns = createTestClient(fetch);

    await expect(getMyProfileRow()).resolves.toEqual(ROW);

    const params = parseQueryParams(requests[0].url);
    expect(params.table).toBe("my_staff_profile");
    expect(columnsOf(params)).toEqual(Object.keys(ROW));
  });

  it("returns null for a signed-in account with no staff row", async () => {
    factory.returns = createTestClient(createRecordingFetch([]).fetch);

    await expect(getMyProfileRow()).resolves.toBeNull();
  });

  // Not null: the gate would judge that not-an-employee and sign them out.
  it("throws on a failed read instead of answering null", async () => {
    const { fetch } = createFailingFetch({
      code: "57014",
      message: "canceling statement due to statement timeout",
    });
    factory.returns = createTestClient(fetch);

    await expect(getMyProfileRow()).rejects.toBeInstanceOf(ProfileReadError);
  });
});
