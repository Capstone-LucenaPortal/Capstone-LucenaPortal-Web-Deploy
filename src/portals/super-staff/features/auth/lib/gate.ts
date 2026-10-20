import { judgeStaffProfile, type RoleVerdict } from "@/shared/guard/decide";
import type { StaffProfile, StaffRole } from "../types";

/** The one role this portal admits. Exact match — roles are not hierarchical. */
export const PORTAL_ROLE: StaffRole = "super_staff";

/** The shape my_staff_profile returns. Every column is nullable: it is a view. */
export type MyStaffProfileRow = {
  id: string | null;
  full_name: string | null;
  email: string | null;
  role: StaffRole | null;
  status: string | null;
};

/** The select that yields a MyStaffProfileRow. Keep the two in step. */
export const MY_STAFF_PROFILE_COLUMNS = "id, full_name, email, role, status";

export type GateDecision =
  | { kind: "allow"; profile: StaffProfile }
  | Exclude<RoleVerdict, { kind: "allow" }>;

export function toStaffProfile(
  row: MyStaffProfileRow | null,
): StaffProfile | null {
  if (!row?.id || !row.role) return null;
  return {
    id: row.id,
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    role: row.role,
    // Fail safe: an unreadable status is treated as inactive, never as active.
    status: row.status ?? "inactive",
  };
}

/**
 * Admission for one page load. Order follows spec section 3: identity, then
 * portal, then status. Judged by the request guard's own judgeStaffProfile
 * (src/shared/guard/decide.ts), so an account the guard admits is never
 * refused here, and vice versa.
 *
 * This is NOT the security boundary — every view and RPC re-checks
 * is_active_staff('<exact role>') independently. It exists so a person who
 * lands in the wrong portal is told why, instead of meeting a working page
 * where every gated query returns 200 and an empty array.
 */
export function decideAccess(
  profile: StaffProfile | null,
  expectedRole: StaffRole = PORTAL_ROLE,
): GateDecision {
  if (!profile) return { kind: "not-an-employee" };
  const verdict = judgeStaffProfile(profile, expectedRole);
  return verdict.kind === "allow" ? { kind: "allow", profile } : verdict;
}
