import type { Account, AccountStatus, Module, Role } from "../types";

/** A row of super_accounts. Every column is nullable: it is a view. */
export type SuperAccountRow = {
  id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  modules: string[] | null;
  is_supervisor: boolean | null;
  status: string | null;
  department_code: string | null;
  department_label: string | null;
  phone: string | null;
  employee_id: string | null;
  created_at: string | null;
  last_change_at: string | null;
  invited_at: string | null;
  last_sign_in_at: string | null;
};

const ROLE_LABEL: Record<string, Role> = {
  staff: "Staff",
  responder: "Responder",
  admin: "Admin",
  super_staff: "Super Staff",
};

// 'platform' is absent on purpose. It is a notification target, not an
// assignable module, and the Module type cannot express it. An unknown code
// maps to undefined and is filtered out rather than corrupting the list.
const MODULE_LABEL: Record<string, Module> = {
  yellow_card: "Yellow Card",
  incidents: "Incidents",
  booking: "Booking",
};

const optional = (value: string | null): string | undefined =>
  value ?? undefined;

export function toAccountRow(row: SuperAccountRow | null): Account | null {
  if (!row?.id || !row.role) return null;

  const role = ROLE_LABEL[row.role];
  if (!role) return null;

  // Fail safe: only the exact string 'active' is Active. Anything else —
  // null, a typo, a value added later — is treated as Inactive.
  const status: AccountStatus = row.status === "active" ? "Active" : "Inactive";

  return {
    id: row.id,
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    role,
    modules: (row.modules ?? [])
      .map((code) => MODULE_LABEL[code])
      .filter((m): m is Module => Boolean(m)),
    isSupervisor: row.is_supervisor ?? false,
    status,
    createdAt: row.created_at ?? "",
    lastChangeAt: row.last_change_at ?? "",
    departmentCode: optional(row.department_code),
    departmentLabel: optional(row.department_label),
    phone: optional(row.phone),
    employeeId: optional(row.employee_id),
    invitedAt: row.invited_at,
    lastSignInAt: row.last_sign_in_at,
  };
}
