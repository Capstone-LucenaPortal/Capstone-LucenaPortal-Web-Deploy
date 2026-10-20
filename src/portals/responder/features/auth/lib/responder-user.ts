import type { ResponderUser } from "../types";
import type { StaffRole } from "./gate";

/**
 * my_staff_profile with the columns this portal needs. Superset of
 * MyStaffProfileRow, which carries only what admission needs. Every column is
 * nullable: it is a view.
 */
export type MyStaffProfileFullRow = {
  id: string | null;
  full_name: string | null;
  email: string | null;
  role: StaffRole | null;
  status: string | null;
  department_code: string | null;
  department_label: string | null;
  phone: string | null;
  employee_id: string | null;
  on_duty: boolean | null;
  created_at: string | null;
};

/**
 * The app's view of the signed-in responder. Only ever called after
 * decideAccess has returned "allow", so role is known to be 'responder'.
 */
export function toResponderUser(
  row: MyStaffProfileFullRow | null,
): ResponderUser | null {
  if (!row?.id) return null;

  return {
    id: row.id,
    email: row.email ?? "",
    full_name: row.full_name ?? "",
    role: "responder",
    department_code: row.department_code ?? "",
    department_label: row.department_label ?? "",
    phone: row.phone ?? "",
    employee_id: row.employee_id ?? "",
    // Fail safe: off is the default. Reading an unreadable value as "on duty"
    // would count a responder in the shift's headcount when they are not.
    on_duty: row.on_duty ?? false,
    created_at: row.created_at ?? "",
  };
}
