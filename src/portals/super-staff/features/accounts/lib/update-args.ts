import type { Database } from "@/shared/supabase/types";
import type { AccountFormValue } from "../components/account-form-fields";
import type { Account, Module, Role } from "../types";

/** The generated argument type for update_staff_account. Params with SQL
 *  defaults arrive here as optional-but-not-nullable, which is why the call
 *  site casts — see account-detail-view.tsx. */
export type UpdateRpcArgs =
  Database["public"]["Functions"]["update_staff_account"]["Args"];

/** The exact argument object update_staff_account expects. There is no
 *  p_email: an email address cannot be changed through the product. */
export type UpdateArgs = {
  p_id: string;
  p_full_name: string;
  p_role: string;
  p_modules: string[];
  p_department_code: string | null;
  p_phone: string | null;
  p_employee_id: string | null;
  p_is_supervisor: boolean;
};

const ROLE_CODE: Record<Role, string> = {
  Staff: "staff",
  Responder: "responder",
  Admin: "admin",
  "Super Staff": "super_staff",
};

// 'platform' is absent by design — it is a notification target, not an
// assignable module. The Module type cannot express it, so this map cannot
// emit it.
const MODULE_CODE: Record<Module, string> = {
  "Yellow Card": "yellow_card",
  Incidents: "incidents",
  Booking: "booking",
};

const trimmedOrNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** The account's role and modules as loaded, before any edit. Take them from
 *  the loaded Account, never the form value, so flipping the role dropdown
 *  away and back can't change what is sent. */
export type StoredAccess = Pick<Account, "role" | "modules">;

/** Staff: the ticked modules. Any other role keeps what it already holds,
 *  unless the role is changing, which clears them (a move from Staff must
 *  not leave modules behind). Sending [] for an unchanged non-staff role
 *  would empty them silently, or, on your own account, trip
 *  update_staff_account's own-modules guard (42501). See #107. */
function modulesToSend(value: AccountFormValue, stored: StoredAccess): Module[] {
  if (value.role === "Staff") return value.modules;
  if (value.role === stored.role) return stored.modules;
  return [];
}

export function toUpdateArgs(
  id: string,
  value: AccountFormValue,
  stored: StoredAccess,
): UpdateArgs {
  const isStaff = value.role === "Staff";
  const isResponder = value.role === "Responder";

  return {
    p_id: id,
    p_full_name: value.fullName.trim(),
    p_role: ROLE_CODE[value.role],
    p_modules: modulesToSend(value, stored).map((m) => MODULE_CODE[m]),
    p_department_code: isResponder ? trimmedOrNull(value.departmentCode) : null,
    p_phone: isResponder ? trimmedOrNull(value.phone) : null,
    p_employee_id: isResponder ? trimmedOrNull(value.employeeId) : null,
    p_is_supervisor: isStaff ? value.isSupervisor : false,
  };
}
