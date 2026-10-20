import { describe, expect, it } from "vitest";
import type { NewAccountInput } from "../types";
import { toInvitePayload } from "./invite-payload";

const staff: NewAccountInput = {
  fullName: "  Juan Dela Cruz  ",
  email: "  Juan.DelaCruz@Lucena.GOV.ph ",
  role: "Staff",
  modules: ["Yellow Card", "Incidents"],
  isSupervisor: true,
};

describe("toInvitePayload", () => {
  it("maps display role and modules to database enum codes", () => {
    const payload = toInvitePayload(staff);
    expect(payload.role).toBe("staff");
    expect(payload.modules).toEqual(["yellow_card", "incidents"]);
  });

  it("normalises the email and trims the name", () => {
    const payload = toInvitePayload(staff);
    expect(payload.email).toBe("juan.delacruz@lucena.gov.ph");
    expect(payload.full_name).toBe("Juan Dela Cruz");
  });

  it("maps every role", () => {
    const roles = ["Staff", "Responder", "Admin", "Super Staff"] as const;
    const codes = roles.map((role) => toInvitePayload({ ...staff, role }).role);
    expect(codes).toEqual(["staff", "responder", "admin", "super_staff"]);
  });

  it("drops modules and the supervisor flag for non-staff roles", () => {
    // staff_modules_exclude_platform aside, only Staff carry modules at all.
    const payload = toInvitePayload({ ...staff, role: "Admin" });
    expect(payload.modules).toEqual([]);
    expect(payload.is_supervisor).toBe(false);
  });

  it("sends the responder fields only for a responder", () => {
    const responder = toInvitePayload({
      ...staff,
      role: "Responder",
      departmentCode: "bfp",
      phone: " 09171234567 ",
      employeeId: " R-0042 ",
    });
    expect(responder.department_code).toBe("bfp");
    expect(responder.phone).toBe("09171234567");
    expect(responder.employee_id).toBe("R-0042");
  });

  it("nulls the responder fields for every other role even if present", () => {
    const payload = toInvitePayload({
      ...staff,
      role: "Staff",
      departmentCode: "bfp",
      phone: "09171234567",
      employeeId: "R-0042",
    });
    expect(payload.department_code).toBeNull();
    expect(payload.phone).toBeNull();
    expect(payload.employee_id).toBeNull();
  });

  it("nulls missing responder fields rather than sending empty strings", () => {
    // The Edge Function checks truthiness; "" and null both fail, but null is
    // what the column expects and what the RPC signature declares.
    const payload = toInvitePayload({ ...staff, role: "Responder" });
    expect(payload.department_code).toBeNull();
    expect(payload.phone).toBeNull();
    expect(payload.employee_id).toBeNull();
  });
});
