import { describe, expect, it } from "vitest";
import type { Account } from "../types";
import { isLastActiveSuperStaff } from "./guards";

const base: Account = {
  id: "acc-x",
  fullName: "X",
  email: "x@lucena.gov",
  role: "Super Staff",
  modules: [],
  isSupervisor: false,
  status: "Active",
  createdAt: "2026-01-01T00:00:00+08:00",
  lastChangeAt: "2026-01-01T00:00:00+08:00",
  invitedAt: null,
  lastSignInAt: null,
};

describe("isLastActiveSuperStaff", () => {
  it("is true for an active Super Staff when only one remains", () => {
    expect(isLastActiveSuperStaff(base, 1)).toBe(true);
  });
  it("is false when other active Super Staff exist", () => {
    expect(isLastActiveSuperStaff(base, 2)).toBe(false);
  });
  it("is false for a non-Super-Staff account", () => {
    expect(isLastActiveSuperStaff({ ...base, role: "Admin" }, 1)).toBe(false);
  });
  it("is false for an already-inactive Super Staff", () => {
    expect(isLastActiveSuperStaff({ ...base, status: "Inactive" }, 1)).toBe(
      false,
    );
  });
});
