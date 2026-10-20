import type { Module, StaffUser } from "../types";
import type { StaffRole } from "./gate";

/**
 * my_staff_profile with the columns the portal shell needs. Superset of
 * MyStaffProfileRow, which carries only what admission needs. Every column is
 * nullable: it is a view.
 */
export type MyStaffProfileFullRow = {
  id: string | null;
  full_name: string | null;
  email: string | null;
  role: StaffRole | null;
  modules: string[] | null;
  is_supervisor: boolean | null;
  status: string | null;
  department_label: string | null;
  created_at: string | null;
};

// 'platform' is absent on purpose. It is a notification target, not an
// assignable module, and the Module type cannot express it. An unknown code
// maps to undefined and is filtered out rather than corrupting the list.
const MODULE_LABEL: Record<string, Module> = {
  yellow_card: "yellow-card",
  incidents: "incidents",
  booking: "booking",
};

/**
 * The shell's view of the signed-in employee. Only ever called after
 * decideAccess has returned "allow", so role is known to be 'staff'.
 */
export function toStaffUser(row: MyStaffProfileFullRow | null): StaffUser | null {
  if (!row?.id) return null;

  return {
    id: row.id,
    email: row.email ?? "",
    full_name: row.full_name ?? "",
    role: "staff",
    department: row.department_label ?? "",
    assignedModules: (row.modules ?? [])
      .map((code) => MODULE_LABEL[code])
      .filter((m): m is Module => Boolean(m)),
    // Fail safe: is_supervisor gates incident force-release, so an unreadable
    // value must be the unprivileged one.
    is_supervisor: row.is_supervisor ?? false,
    created_at: row.created_at ?? "",
  };
}
