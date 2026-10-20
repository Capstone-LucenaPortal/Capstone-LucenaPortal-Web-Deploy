import { describe, expect, it } from "vitest";
import { toStaffUser, type MyStaffProfileFullRow } from "./staff-user";

const row: MyStaffProfileFullRow = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Juan Dela Cruz",
  email: "juan@lucena.gov",
  role: "staff",
  modules: ["yellow_card", "incidents"],
  is_supervisor: true,
  status: "active",
  department_label: "Yellow Card Office",
  created_at: "2026-01-15T08:00:00.000Z",
};

describe("toStaffUser", () => {
  it("maps database module codes to this repo's kebab-case vocabulary", () => {
    // The database says yellow_card; the Module type says "yellow-card".
    expect(toStaffUser(row)?.assignedModules).toEqual([
      "yellow-card",
      "incidents",
    ]);
  });

  it("drops 'platform', which is not an assignable module", () => {
    // module_code includes 'platform' as a notification target. The Module
    // type cannot express it, so it must be dropped, never emitted.
    const user = toStaffUser({
      ...row,
      modules: ["yellow_card", "platform", "booking"],
    });
    expect(user?.assignedModules).toEqual(["yellow-card", "booking"]);
  });

  it("carries name, email, supervisor flag and department", () => {
    const user = toStaffUser(row);
    expect(user?.full_name).toBe("Juan Dela Cruz");
    expect(user?.email).toBe("juan@lucena.gov");
    expect(user?.is_supervisor).toBe(true);
    expect(user?.department).toBe("Yellow Card Office");
  });

  it("returns null for no row", () => {
    expect(toStaffUser(null)).toBeNull();
  });

  it("returns null when id is null", () => {
    expect(toStaffUser({ ...row, id: null })).toBeNull();
  });

  it("fails safe on the supervisor flag", () => {
    // is_supervisor gates incident force-release. A null must never read as
    // true — that would hand an unprivileged member a privileged control.
    expect(toStaffUser({ ...row, is_supervisor: null })?.is_supervisor).toBe(
      false,
    );
  });

  it("tolerates null modules, department and timestamps", () => {
    const user = toStaffUser({
      ...row,
      modules: null,
      department_label: null,
      created_at: null,
    });
    expect(user?.assignedModules).toEqual([]);
    expect(user?.department).toBe("");
    expect(user?.created_at).toBe("");
  });

  it("reports role as staff — the gate admits nothing else", () => {
    expect(toStaffUser(row)?.role).toBe("staff");
  });
});
