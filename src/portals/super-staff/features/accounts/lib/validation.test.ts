import { describe, expect, it } from "vitest";
import type { NewAccountInput } from "../types";
import { validateAccount } from "./validation";

const staff: NewAccountInput = {
  fullName: "Ana Cruz",
  email: "ana@lucena.gov",
  role: "Staff",
  modules: ["Incidents"],
  isSupervisor: false,
};

describe("validateAccount", () => {
  it("passes a valid staff input", () => {
    expect(validateAccount(staff, [])).toEqual({});
  });
  it("requires a full name", () => {
    expect(validateAccount({ ...staff, fullName: "  " }, []).fullName).toBeDefined();
  });
  it("requires a valid email", () => {
    expect(validateAccount({ ...staff, email: "nope" }, []).email).toBeDefined();
  });
  it("rejects a duplicate email case-insensitively", () => {
    expect(validateAccount(staff, ["ANA@lucena.gov"]).email).toBeDefined();
  });
  it("blocks supervisor without the Incidents module", () => {
    const r = validateAccount(
      { ...staff, modules: ["Booking"], isSupervisor: true },
      [],
    );
    expect(r.supervisor).toBeDefined();
  });
  it("warns when a staff account has no modules", () => {
    expect(validateAccount({ ...staff, modules: [] }, []).modules).toBeDefined();
  });
  it("ignores module/supervisor rules for non-staff roles", () => {
    const admin: NewAccountInput = {
      fullName: "Boss",
      email: "boss@lucena.gov",
      role: "Admin",
      modules: [],
      isSupervisor: false,
    };
    expect(validateAccount(admin, [])).toEqual({});
  });
});

describe("validateAccount — responder fields", () => {
  const responder: NewAccountInput = {
    fullName: "Rosa Reyes",
    email: "rreyes@lucena.gov.ph",
    role: "Responder",
    modules: [],
    isSupervisor: false,
  };

  it("requires department, phone and employee id", () => {
    const errors = validateAccount(responder, []);
    expect(errors.departmentCode).toBeDefined();
    expect(errors.phone).toBeDefined();
    expect(errors.employeeId).toBeDefined();
  });

  it("accepts a complete responder", () => {
    const errors = validateAccount(
      {
        ...responder,
        departmentCode: "bfp",
        phone: "09171234567",
        employeeId: "R-0042",
      },
      [],
    );
    expect(errors).toEqual({});
  });

  it("does not require them for a staff account", () => {
    const errors = validateAccount(
      { ...responder, role: "Staff", modules: ["Incidents"] },
      [],
    );
    expect(errors.departmentCode).toBeUndefined();
    expect(errors.phone).toBeUndefined();
    expect(errors.employeeId).toBeUndefined();
  });
});
