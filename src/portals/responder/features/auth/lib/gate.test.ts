import { describe, expect, it } from "vitest";
import {
  decideAccess,
  toResponderProfile,
  type MyStaffProfileRow,
  type StaffProfile,
} from "./gate";

const row: MyStaffProfileRow = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Juan Dela Cruz",
  email: "juan@lucena.gov",
  role: "responder",
  status: "active",
};

const profile: StaffProfile = {
  id: row.id!,
  fullName: "Juan Dela Cruz",
  email: "juan@lucena.gov",
  role: "responder",
  status: "active",
};

describe("toResponderProfile", () => {
  it("maps a complete row", () => {
    expect(toResponderProfile(row)).toEqual(profile);
  });

  it("returns null for no row — the caller is not an employee", () => {
    expect(toResponderProfile(null)).toBeNull();
  });

  it("returns null when id or role is null", () => {
    // Every column of a view is nullable. A row without an id or a role
    // cannot admit anyone.
    expect(toResponderProfile({ ...row, id: null })).toBeNull();
    expect(toResponderProfile({ ...row, role: null })).toBeNull();
  });

  it("fails safe to inactive when status is null", () => {
    // An unreadable status must never be treated as active.
    expect(toResponderProfile({ ...row, status: null })?.status).toBe(
      "inactive",
    );
  });

  it("tolerates a null name and email", () => {
    const p = toResponderProfile({ ...row, full_name: null, email: null });
    expect(p?.fullName).toBe("");
    expect(p?.email).toBe("");
  });
});

describe("decideAccess", () => {
  it("allows an active responder", () => {
    expect(decideAccess(profile)).toEqual({ kind: "allow", profile });
  });

  it("refuses a caller with no profile", () => {
    expect(decideAccess(null)).toEqual({ kind: "not-an-employee" });
  });

  it("refuses every other role, naming it", () => {
    // Roles are exact, never hierarchical: a super_staff is NOT a responder.
    const roles = ["staff", "admin", "super_staff"] as const;
    for (const role of roles) {
      expect(decideAccess({ ...profile, role })).toEqual({
        kind: "wrong-portal",
        role,
      });
    }
  });

  it("refuses a deactivated responder", () => {
    expect(decideAccess({ ...profile, status: "inactive" })).toEqual({
      kind: "deactivated",
    });
  });

  it("checks identity, then portal, then status — in that order", () => {
    // A deactivated staff member is told they are in the wrong portal, not
    // that they are deactivated: naming the status would confirm to a stranger
    // that an account exists here.
    expect(
      decideAccess({ ...profile, role: "staff", status: "inactive" }),
    ).toEqual({ kind: "wrong-portal", role: "staff" });
  });
});
