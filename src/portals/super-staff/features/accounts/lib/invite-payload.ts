import type { Module, NewAccountInput, Role } from "../types";

/** The JSON body staff-accounts parses. Field names are snake_case by design:
 *  they are forwarded almost verbatim to create_staff_account_profile. */
export type InvitePayload = {
  email: string;
  full_name: string;
  role: string;
  modules: string[];
  department_code: string | null;
  phone: string | null;
  employee_id: string | null;
  is_supervisor: boolean;
};

const ROLE_CODE: Record<Role, string> = {
  Staff: "staff",
  Responder: "responder",
  Admin: "admin",
  "Super Staff": "super_staff",
};

// 'platform' is absent on purpose — it is a notification target, not an
// assignable module, and the Edge Function rejects it
// (staff_modules_exclude_platform). The Module type cannot express it, so
// this map cannot emit it.
const MODULE_CODE: Record<Module, string> = {
  "Yellow Card": "yellow_card",
  Incidents: "incidents",
  Booking: "booking",
};

const trimmedOrNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function toInvitePayload(input: NewAccountInput): InvitePayload {
  const isStaff = input.role === "Staff";
  const isResponder = input.role === "Responder";

  return {
    email: input.email.trim().toLowerCase(),
    full_name: input.fullName.trim(),
    role: ROLE_CODE[input.role],
    modules: isStaff ? input.modules.map((m) => MODULE_CODE[m]) : [],
    department_code: isResponder ? trimmedOrNull(input.departmentCode) : null,
    phone: isResponder ? trimmedOrNull(input.phone) : null,
    employee_id: isResponder ? trimmedOrNull(input.employeeId) : null,
    is_supervisor: isStaff ? input.isSupervisor : false,
  };
}
