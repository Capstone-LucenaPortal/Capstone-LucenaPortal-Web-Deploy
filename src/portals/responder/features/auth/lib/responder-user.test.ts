import { describe, expect, it } from "vitest";
import { toResponderUser, type MyStaffProfileFullRow } from "./responder-user";

const row: MyStaffProfileFullRow = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Juan Dela Cruz",
  email: "juan@lucena.gov",
  role: "responder",
  status: "active",
  department_code: "engineering",
  department_label: "Engineering",
  phone: "09171234501",
  employee_id: "LGU-2026-0501",
  on_duty: true,
  created_at: "2026-01-12T08:00:00.000Z",
};

describe("toResponderUser", () => {
  it("carries every field the shell renders", () => {
    expect(toResponderUser(row)).toEqual({
      id: row.id,
      email: "juan@lucena.gov",
      full_name: "Juan Dela Cruz",
      role: "responder",
      department_code: "engineering",
      department_label: "Engineering",
      phone: "09171234501",
      employee_id: "LGU-2026-0501",
      on_duty: true,
      created_at: "2026-01-12T08:00:00.000Z",
    });
  });

  it("returns null for no row", () => {
    expect(toResponderUser(null)).toBeNull();
  });

  it("returns null when id is null", () => {
    expect(toResponderUser({ ...row, id: null })).toBeNull();
  });

  it("fails safe on the duty flag", () => {
    // Account spec Q4: on_duty defaults to OFF. An unreadable value must be
    // the off one -- reading null as "on duty" would count a responder in the
    // shift's headcount when they are not.
    expect(toResponderUser({ ...row, on_duty: null })?.on_duty).toBe(false);
  });

  it("tolerates null department, contact details and timestamps", () => {
    // responder_fields_required makes all three NOT NULL in the database, so
    // this cannot happen for a real responder. It is still every column of a
    // view: the mapper must not throw if the constraint is ever relaxed.
    const user = toResponderUser({
      ...row,
      department_code: null,
      department_label: null,
      phone: null,
      employee_id: null,
      created_at: null,
    });
    expect(user?.department_code).toBe("");
    expect(user?.department_label).toBe("");
    expect(user?.phone).toBe("");
    expect(user?.employee_id).toBe("");
    expect(user?.created_at).toBe("");
  });

  it("reports role as responder — the gate admits nothing else", () => {
    expect(toResponderUser(row)?.role).toBe("responder");
  });
});
