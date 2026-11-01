import { describe, it, expect, vi, afterEach } from "vitest";
import * as profile from "./profile";
import { isAssigned } from "./module-gate";
import { stubProfileRow as stubRow } from "./stub-profile-row";
import type { Module } from "../types";

afterEach(() => {
  vi.restoreAllMocks();
});

const CASES: { module: Module; code: string; others: string[] }[] = [
  { module: "yellow-card", code: "yellow_card", others: ["incidents", "booking"] },
  { module: "incidents", code: "incidents", others: ["yellow_card", "booking"] },
  { module: "booking", code: "booking", others: ["yellow_card", "incidents"] },
];

describe("isAssigned", () => {
  it.each(CASES)("admits an account assigned $module", async ({ module, code }) => {
    stubRow([code]);
    expect(await isAssigned(module)).toBe(true);
  });

  it.each(CASES)(
    "refuses an account assigned only the other modules, for $module",
    async ({ module, others }) => {
      stubRow(others);
      expect(await isAssigned(module)).toBe(false);
    },
  );

  it("refuses an account with no modules at all", async () => {
    stubRow(null);
    expect(await isAssigned("booking")).toBe(false);
  });

  it("refuses when there is no staff row", async () => {
    vi.spyOn(profile, "getMyProfileRow").mockResolvedValue(null);
    expect(await isAssigned("booking")).toBe(false);
  });
});
