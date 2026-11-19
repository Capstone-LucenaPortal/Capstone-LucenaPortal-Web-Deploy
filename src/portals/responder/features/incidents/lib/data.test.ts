import { beforeEach, describe, expect, it, vi } from "vitest";
import { getVisibleIncidentStatuses } from "@/portals/responder/features/incidents/lib/data";

/**
 * The rest of data.ts is tested through the fake of this module that every
 * page test uses. This file covers only what a fake cannot: that the
 * stale-arrival lookup turns a Postgres error into a throw, never into [] --
 * which would read as "every report rerouted away" and mark every arrival
 * stale (#138).
 */
const result = vi.hoisted(() => ({
  value: { data: null as unknown, error: null as { message: string } | null },
}));
const from = vi.hoisted(() =>
  vi.fn(() => ({ select: () => ({ in: async () => result.value }) })),
);

vi.mock("@/shared/supabase/server", () => ({
  createClient: async () => ({ from }),
}));

beforeEach(() => {
  from.mockClear();
  result.value = { data: [], error: null };
});

describe("getVisibleIncidentStatuses", () => {
  it("throws on a Postgres error instead of reporting nothing visible", async () => {
    result.value = { data: null, error: { message: "statement timeout" } };

    await expect(getVisibleIncidentStatuses(["inc-1"])).rejects.toThrow(
      "getVisibleIncidentStatuses: statement timeout",
    );
  });

  it("asks nothing for an empty list", async () => {
    expect(await getVisibleIncidentStatuses([])).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});
