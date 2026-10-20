// src/portals/admin/lib/supabase/access.ts
//
// "Who may use this portal", for the client-side call sites — the (admin)
// layout and /forbidden, via src/portals/admin/features/auth/hooks/use-auth.tsx's
// profile. The server-side gate is the shared request guard
// (src/shared/guard/decide.ts), and both judge a profile with the same
// judgeStaffProfile, so a user the guard admits is never refused by the layout
// and vice versa.
//
// Pure functions: the call sites run these against a profile row they fetched
// themselves, and the tests run them against literals.

import { judgeStaffProfile, type RoleVerdict, type StaffRoleProfile } from "@/shared/guard/decide";
import type { StaffRole } from "@/shared/guard/portals";

export type { StaffRole, StaffRoleProfile };

// The one role this portal admits. Exact match — roles are not hierarchical.
const PORTAL_ROLE: StaffRole = "admin";

// The role/status verdict: an allow, or one of three reasons a signed-in
// account is refused. The client call sites are always already inside a
// role-gated context, so they need this directly — /forbidden in particular
// must explain why the visitor is on it, which a path-aware decision could not
// (the guard exempts /forbidden from its own role check so its redirect does
// not loop).
export type RoleAccessDecision = RoleVerdict;

export function decideRoleAccess(profile: StaffRoleProfile | null): RoleAccessDecision {
  return judgeStaffProfile(profile, PORTAL_ROLE);
}

export function isActiveAdmin(profile: StaffRoleProfile | null | undefined): boolean {
  return decideRoleAccess(profile ?? null).kind === "allow";
}
