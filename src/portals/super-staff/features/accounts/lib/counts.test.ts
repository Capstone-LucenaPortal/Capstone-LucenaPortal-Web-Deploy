import { describe, expect, it } from "vitest";
import type { Account } from "../types";
import { computeRoleCounts } from "./counts";

const mk = (role: Account["role"], status: Account["status"]): Account => ({
  id: `acc-${role}-${status}-${Math.random()}`,
  fullName: "n",
  email: "n@lucena.gov",
  role,
  modules: [],
  isSupervisor: false,
  status,
  createdAt: "2026-01-01T00:00:00+08:00",
  lastChangeAt: "2026-01-01T00:00:00+08:00",
  invitedAt: null,
  lastSignInAt: null,
});

const accounts: Account[] = [
  mk("Staff", "Active"),
  mk("Staff", "Active"),
  mk("Staff", "Inactive"),
  mk("Responder", "Active"),
  mk("Admin", "Active"),
  mk("Super Staff", "Active"),
];

describe("computeRoleCounts", () => {
  it("counts active-only by default", () => {
    const c = computeRoleCounts(accounts, false);
    expect(c.all).toBe(5);
    expect(c.Staff).toBe(2);
    expect(c.Responder).toBe(1);
    expect(c.Admin).toBe(1);
    expect(c["Super Staff"]).toBe(1);
  });
  it("includes inactive when asked", () => {
    const c = computeRoleCounts(accounts, true);
    expect(c.all).toBe(6);
    expect(c.Staff).toBe(3);
  });
});
