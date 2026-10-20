import { decideRoleAccess, isActiveAdmin } from "@/portals/admin/lib/supabase/access";

// The path-aware gate tests that lived here (decideAccess, requiresRoleCheck)
// are rows of the shared guard's table test now: src/shared/guard/decide.test.ts.

describe("isActiveAdmin", () => {
  it("accepts an active admin profile", () => {
    expect(isActiveAdmin({ role: "admin", status: "active" })).toBe(true);
  });

  it("rejects a deactivated admin", () => {
    expect(isActiveAdmin({ role: "admin", status: "inactive" })).toBe(false);
  });

  it("rejects other staff roles", () => {
    expect(isActiveAdmin({ role: "super_staff", status: "active" })).toBe(false);
  });

  it("rejects a missing profile (citizen or non-staff account)", () => {
    expect(isActiveAdmin(null)).toBe(false);
  });
});

describe("decideRoleAccess", () => {
  it("allows an active admin", () => {
    expect(decideRoleAccess({ role: "admin", status: "active" })).toEqual({ kind: "allow" });
  });

  it("refuses a citizen (no staff profile) as not-an-employee", () => {
    expect(decideRoleAccess(null)).toEqual({ kind: "not-an-employee" });
  });

  it("refuses an unrecognised role string as not-an-employee", () => {
    expect(decideRoleAccess({ role: "bogus", status: "active" })).toEqual({
      kind: "not-an-employee",
    });
  });

  it("refuses a non-admin staff account as wrong-portal, carrying its role", () => {
    expect(decideRoleAccess({ role: "super_staff", status: "active" })).toEqual({
      kind: "wrong-portal",
      role: "super_staff",
    });
  });

  it("refuses a deactivated admin as deactivated", () => {
    expect(decideRoleAccess({ role: "admin", status: "inactive" })).toEqual({
      kind: "deactivated",
    });
  });

  // Role is checked ahead of status: a non-admin account that is also
  // deactivated is told which portal to use, not that it is deactivated —
  // that portal's own gate will tell it so.
  it("reports wrong-portal, not deactivated, for a deactivated non-admin account", () => {
    expect(decideRoleAccess({ role: "responder", status: "inactive" })).toEqual({
      kind: "wrong-portal",
      role: "responder",
    });
  });
});
