import { describe, expect, it } from "vitest";
import {
  decideAccess,
  toStaffProfile,
  type MyStaffProfileRow,
  type StaffProfile,
} from "./gate";

const row: MyStaffProfileRow = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Juan Dela Cruz",
  email: "juan@lucena.gov",
  role: "staff",
  status: "active",
};

const profile: StaffProfile = {
  id: row.id!,
  fullName: "Juan Dela Cruz",
  email: "juan@lucena.gov",
  role: "staff",
  status: "active",
};

describe("toStaffProfile", () => {
  it("maps a complete row", () => {
    expect(toStaffProfile(row)).toEqual(profile);
  });

  it("returns null for no row — the caller is not an employee", () => {
    expect(toStaffProfile(null)).toBeNull();
  });

  it("returns null when id or role is null", () => {
    // Every column of a view is nullable. A row without an id or a role
    // cannot admit anyone.
    expect(toStaffProfile({ ...row, id: null })).toBeNull();
    expect(toStaffProfile({ ...row, role: null })).toBeNull();
  });

  it("fails safe to inactive when status is null", () => {
    // An unreadable status must never be treated as active.
    expect(toStaffProfile({ ...row, status: null })?.status).toBe("inactive");
  });

  it("tolerates a null name and email", () => {
    const p = toStaffProfile({ ...row, full_name: null, email: null });
    expect(p?.fullName).toBe("");
    expect(p?.email).toBe("");
  });
});

describe("decideAccess", () => {
  it("allows an active staff member", () => {
    expect(decideAccess(profile)).toEqual({ kind: "allow", profile });
  });

  it("refuses a caller with no profile", () => {
    expect(decideAccess(null)).toEqual({ kind: "not-an-employee" });
  });

  it("refuses every other role, naming it", () => {
    // Roles are exact, never hierarchical: a super_staff is NOT a staff.
    const roles = ["responder", "admin", "super_staff"] as const;
    for (const role of roles) {
      expect(decideAccess({ ...profile, role })).toEqual({
        kind: "wrong-portal",
        role,
      });
    }
  });

  it("refuses a deactivated staff member", () => {
    expect(decideAccess({ ...profile, status: "inactive" })).toEqual({
      kind: "deactivated",
    });
  });

  it("checks identity, then portal, then status — in that order", () => {
    // A deactivated responder is told they are in the wrong portal, not that
    // they are deactivated: naming the status would confirm to a stranger
    // that an account exists here.
    expect(
      decideAccess({ ...profile, role: "responder", status: "inactive" }),
    ).toEqual({ kind: "wrong-portal", role: "responder" });
  });
});
