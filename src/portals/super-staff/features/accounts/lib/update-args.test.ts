import { describe, expect, it } from "vitest";
import type { AccountFormValue } from "../components/account-form-fields";
import { toUpdateArgs, type StoredAccess } from "./update-args";

const ID = "11111111-1111-1111-1111-111111111111";

const staff: AccountFormValue = {
  fullName: "  Ramon Cruz  ",
  email: "rcruz@lucena.gov",
  role: "Staff",
  modules: ["Yellow Card", "Incidents"],
  isSupervisor: true,
};

/** The same Staff account as it was loaded, before any edit. */
const stored: StoredAccess = { role: "Staff", modules: ["Yellow Card", "Incidents"] };

describe("toUpdateArgs", () => {
  it("maps display vocabulary to database codes", () => {
    const args = toUpdateArgs(ID, staff, stored);
    expect(args.p_id).toBe(ID);
    expect(args.p_role).toBe("staff");
    expect(args.p_modules).toEqual(["yellow_card", "incidents"]);
    expect(args.p_is_supervisor).toBe(true);
  });

  it("trims the name", () => {
    expect(toUpdateArgs(ID, staff, stored).p_full_name).toBe("Ramon Cruz");
  });

  it("never sends an email — the RPC has no such parameter", () => {
    expect(toUpdateArgs(ID, staff, stored)).not.toHaveProperty("p_email");
  });

  it("maps every role", () => {
    const roles = ["Staff", "Responder", "Admin", "Super Staff"] as const;
    const codes = roles.map((role) => toUpdateArgs(ID, { ...staff, role }, stored).p_role);
    expect(codes).toEqual(["staff", "responder", "admin", "super_staff"]);
  });

  it("clears modules and the supervisor flag on a move from staff", () => {
    const args = toUpdateArgs(ID, { ...staff, role: "Admin" }, stored);
    expect(args.p_modules).toEqual([]);
    expect(args.p_is_supervisor).toBe(false);
  });

  it("keeps the stored modules when a non-staff role isn't changing", () => {
    // Dev Super Staff holds modules the form never shows. Sending [] would
    // trip update_staff_account's own-modules guard (42501) on a name change.
    const args = toUpdateArgs(
      ID,
      { ...staff, role: "Super Staff", modules: [] },
      { role: "Super Staff", modules: ["Yellow Card", "Incidents", "Booking"] },
    );
    expect(args.p_modules).toEqual(["yellow_card", "incidents", "booking"]);
  });

  it("sends the ticked modules for staff, not the stored ones", () => {
    const args = toUpdateArgs(ID, { ...staff, modules: ["Booking"] }, stored);
    expect(args.p_modules).toEqual(["booking"]);
  });

  it("sends the ticked modules on a move to staff, not the stored ones", () => {
    const args = toUpdateArgs(
      ID,
      { ...staff, modules: ["Booking"] },
      { role: "Admin", modules: ["Yellow Card", "Incidents"] },
    );
    expect(args.p_modules).toEqual(["booking"]);
  });

  it("clears modules on a move between two non-staff roles", () => {
    const args = toUpdateArgs(
      ID,
      { ...staff, role: "Admin", modules: [] },
      { role: "Super Staff", modules: ["Yellow Card", "Booking"] },
    );
    expect(args.p_modules).toEqual([]);
  });

  it("sends the responder fields only for a responder", () => {
    const args = toUpdateArgs(ID, {
      ...staff,
      role: "Responder",
      departmentCode: "bfp",
      phone: " 09171234567 ",
      employeeId: " R-0042 ",
    }, stored);
    expect(args.p_department_code).toBe("bfp");
    expect(args.p_phone).toBe("09171234567");
    expect(args.p_employee_id).toBe("R-0042");
  });

  it("nulls the responder fields for every other role even if present", () => {
    const args = toUpdateArgs(ID, {
      ...staff,
      role: "Staff",
      departmentCode: "bfp",
      phone: "09171234567",
      employeeId: "R-0042",
    }, stored);
    expect(args.p_department_code).toBeNull();
    expect(args.p_phone).toBeNull();
    expect(args.p_employee_id).toBeNull();
  });
});
