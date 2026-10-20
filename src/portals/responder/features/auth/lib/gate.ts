import { judgeStaffProfile, type RoleVerdict } from "@/shared/guard/decide";
import type { Database } from "@/shared/supabase/types";

export type StaffRole = Database["public"]["Enums"]["staff_role"];

/** The one role this portal admits. Exact match — roles are not hierarchical. */
export const PORTAL_ROLE: StaffRole = "responder";

/** The shape my_staff_profile returns. Every column is nullable: it is a view. */
export type MyStaffProfileRow = {
  id: string | null;
  full_name: string | null;
  email: string | null;
  role: StaffRole | null;
  status: string | null;
};

export type StaffProfile = {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  /** 'active' | 'inactive'. Typed as string because the view column is text. */
  status: string;
};

export type GateDecision =
  | { kind: "allow"; profile: StaffProfile }
  | Exclude<RoleVerdict, { kind: "allow" }>;

export function toResponderProfile(
  row: MyStaffProfileRow | null,
): StaffProfile | null {
  if (!row?.id || !row.role) return null;
  return {
    id: row.id,
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    role: row.role,
    // Fail safe: an unreadable status is treated as inactive, never active.
    status: row.status ?? "inactive",
  };
}

/**
 * Admission for one request: identity, then portal, then status. The request
 * guard judges the same row before serving a portal route; the (portal) layout
 * and /forbidden ask again from their own read. Judged by the guard's own
 * judgeStaffProfile (src/shared/guard/decide.ts), so an account the guard
 * admits is never refused here, and vice versa.
 *
 * This is NOT the security boundary — every view and RPC re-checks
 * is_active_staff('responder') independently. It exists so a person who lands
 * in the wrong portal is told why, instead of meeting a working page where
 * every gated query returns 200 and an empty array.
 */
export function decideAccess(
  profile: StaffProfile | null,
  expectedRole: StaffRole = PORTAL_ROLE,
): GateDecision {
  if (!profile) return { kind: "not-an-employee" };
  const verdict = judgeStaffProfile(profile, expectedRole);
  return verdict.kind === "allow" ? { kind: "allow", profile } : verdict;
}
