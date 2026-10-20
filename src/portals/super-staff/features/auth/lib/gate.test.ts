import { describe, expect, it } from "vitest";
import type { StaffProfile } from "../types";
import { decideAccess, toStaffProfile } from "./gate";

const superStaff: StaffProfile = {
  id: "11111111-1111-1111-1111-111111111111",
  fullName: "Dev Super Staff",
  email: "dev.superstaff@lucena.local",
  role: "super_staff",
  status: "active",
};

describe("decideAccess", () => {
  it("allows an active super_staff and hands back the profile", () => {
    const decision = decideAccess(superStaff);
    expect(decision.kind).toBe("allow");
    if (decision.kind === "allow") {
      expect(decision.profile.fullName).toBe("Dev Super Staff");
    }
  });

  it("refuses a null profile as not-an-employee", () => {
    // Zero rows from my_staff_profile: authenticated, but a citizen or unknown.
    expect(decideAccess(null)).toEqual({ kind: "not-an-employee" });
  });

  it("refuses another role as wrong-portal and reports which role", () => {
    expect(decideAccess({ ...superStaff, role: "responder" })).toEqual({
      kind: "wrong-portal",
      role: "responder",
    });
  });

  it("refuses an inactive super_staff as deactivated", () => {
    expect(decideAccess({ ...superStaff, status: "inactive" })).toEqual({
      kind: "deactivated",
    });
  });

  it("checks role before status, per spec section 3", () => {
    // An inactive Staff sees 'wrong-portal', not 'deactivated'. The message is
    // still true, and status is the responsibility of the portal that owns the
    // account — not this one.
    expect(
      decideAccess({ ...superStaff, role: "staff", status: "inactive" }),
    ).toEqual({ kind: "wrong-portal", role: "staff" });
  });

  it("honours an explicit expectedRole so other portals can reuse it", () => {
    expect(decideAccess(superStaff, "staff")).toEqual({
      kind: "wrong-portal",
      role: "super_staff",
    });
  });
});

describe("toStaffProfile", () => {
  const row = {
    id: "11111111-1111-1111-1111-111111111111",
    full_name: "Dev Super Staff",
    email: "dev.superstaff@lucena.local",
    role: "super_staff" as const,
    status: "active",
  };

  it("maps a populated row", () => {
    expect(toStaffProfile(row)).toEqual(superStaff);
  });

  it("returns null for no row", () => {
    expect(toStaffProfile(null)).toBeNull();
  });

  it("returns null when id or role is null", () => {
    // Every my_staff_profile column is nullable (it is a view). A row without
    // an id or a role is not a usable identity.
    expect(toStaffProfile({ ...row, id: null })).toBeNull();
    expect(toStaffProfile({ ...row, role: null })).toBeNull();
  });

  it("fails safe to inactive when status is null", () => {
    expect(toStaffProfile({ ...row, status: null })?.status).toBe("inactive");
  });

  it("tolerates a null name or email", () => {
    const mapped = toStaffProfile({ ...row, full_name: null, email: null });
    expect(mapped?.fullName).toBe("");
    expect(mapped?.email).toBe("");
  });
});
