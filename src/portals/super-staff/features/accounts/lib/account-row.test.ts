import { describe, expect, it } from "vitest";
import { toAccountRow, type SuperAccountRow } from "./account-row";

const row: SuperAccountRow = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Ramon Cruz",
  email: "rcruz@lucena.gov",
  role: "staff",
  modules: ["yellow_card", "incidents"],
  is_supervisor: true,
  status: "active",
  department_code: null,
  department_label: null,
  phone: null,
  employee_id: null,
  created_at: "2026-08-01T00:00:00Z",
  last_change_at: "2026-08-02T00:00:00Z",
  invited_at: null,
  last_sign_in_at: null,
};

describe("toAccountRow", () => {
  it("maps database codes to display vocabulary", () => {
    const account = toAccountRow(row);
    expect(account?.role).toBe("Staff");
    expect(account?.modules).toEqual(["Yellow Card", "Incidents"]);
    expect(account?.status).toBe("Active");
  });

  it("maps every role", () => {
    const roles = ["staff", "responder", "admin", "super_staff"] as const;
    const labels = roles.map((r) => toAccountRow({ ...row, role: r })?.role);
    expect(labels).toEqual(["Staff", "Responder", "Admin", "Super Staff"]);
  });

  it("drops 'platform', which is not an assignable module", () => {
    // module_code includes 'platform' as a notification target. The Module
    // display type cannot express it, so it must be dropped, never emitted.
    const account = toAccountRow({
      ...row,
      modules: ["yellow_card", "platform", "booking"],
    });
    expect(account?.modules).toEqual(["Yellow Card", "Booking"]);
  });

  it("returns null for no row", () => {
    expect(toAccountRow(null)).toBeNull();
  });

  it("returns null when id or role is null", () => {
    // Every column of a view is nullable. A row without an id or a role is
    // not a usable account.
    expect(toAccountRow({ ...row, id: null })).toBeNull();
    expect(toAccountRow({ ...row, role: null })).toBeNull();
  });

  it("fails safe to Inactive when status is null or unknown", () => {
    expect(toAccountRow({ ...row, status: null })?.status).toBe("Inactive");
    expect(toAccountRow({ ...row, status: "weird" })?.status).toBe("Inactive");
  });

  it("tolerates a null name, email and timestamps", () => {
    const account = toAccountRow({
      ...row,
      full_name: null,
      email: null,
      created_at: null,
      last_change_at: null,
      modules: null,
    });
    expect(account?.fullName).toBe("");
    expect(account?.email).toBe("");
    expect(account?.createdAt).toBe("");
    expect(account?.modules).toEqual([]);
  });

  it("carries the responder fields and the onboarding columns", () => {
    const account = toAccountRow({
      ...row,
      role: "responder",
      department_code: "bfp",
      department_label: "Bureau of Fire Protection",
      phone: "09171234567",
      employee_id: "R-0042",
      invited_at: "2026-08-05T00:00:00Z",
      last_sign_in_at: "2026-08-06T00:00:00Z",
    });
    expect(account?.departmentCode).toBe("bfp");
    expect(account?.departmentLabel).toBe("Bureau of Fire Protection");
    expect(account?.phone).toBe("09171234567");
    expect(account?.employeeId).toBe("R-0042");
    expect(account?.invitedAt).toBe("2026-08-05T00:00:00Z");
    expect(account?.lastSignInAt).toBe("2026-08-06T00:00:00Z");
  });

  it("leaves the responder fields undefined when the view returns null", () => {
    const account = toAccountRow(row);
    expect(account?.departmentCode).toBeUndefined();
    expect(account?.phone).toBeUndefined();
  });
});
