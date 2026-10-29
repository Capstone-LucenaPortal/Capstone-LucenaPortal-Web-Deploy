// src/shared/guard/portals.ts
//
// The request guard's per-Portal table (ADR 0006): one row per staff-side
// Portal, chosen by path prefix. The rows differ on purpose — each Portal
// keeps the rules it had before the merge — and sit side by side here so
// they cannot drift silently. Adding a Portal to the guard means adding a row.
//
// Paths under no row's prefix (the Citizen Portal at the root) get no server
// check, as before the merge.

import type { Database } from "@/shared/supabase/types";

export type StaffRole = Database["public"]["Enums"]["staff_role"];

/**
 * Where each staff-side Portal lives. Fixed in code — there are no
 * per-Portal URL settings, since every Portal is served from one origin
 * (ADR 0005). Cross-Portal links are internal: `${PORTAL_PREFIX[role]}/login`.
 */
export const PORTAL_PREFIX: Record<StaffRole, string> = {
  staff: "/staff",
  super_staff: "/super-staff",
  responder: "/responder",
  admin: "/admin",
};

/** The Citizen Portal owns the root. */
export const CITIZEN_PORTAL_PATH = "/";

export interface PortalRow {
  prefix: string;
  /** The one staff_role admitted. Exact match — roles are not hierarchical. */
  role: StaffRole;
  /** Idle time after which a session of this Portal's role is ended; null for none. */
  idleTimeoutMs: number | null;
  /** What a failed my_staff_profile read returns: a 503, or the forbidden page. */
  onProfileReadError: "unavailable" | "forbidden";
  /**
   * Where a signed-in visit to login by this Portal's own role goes; null to
   * serve the login page. Any other account is always served the login page.
   */
  signedInLoginRedirect: string | null;
}

export const PORTALS: readonly PortalRow[] = [
  {
    prefix: PORTAL_PREFIX.admin,
    role: "admin",
    idleTimeoutMs: null,
    onProfileReadError: "forbidden",
    signedInLoginRedirect: null,
  },
  {
    prefix: PORTAL_PREFIX.staff,
    role: "staff",
    // The same 15 minutes as Staff's browser-side clock
    // (src/portals/staff/lib/supabase/idle-timeout.ts's IDLE_TIMEOUT_MS).
    idleTimeoutMs: 15 * 60 * 1000,
    onProfileReadError: "unavailable",
    signedInLoginRedirect: null,
  },
  {
    prefix: PORTAL_PREFIX.super_staff,
    role: "super_staff",
    // The same 15 minutes as Super-staff's browser-side clock
    // (src/portals/super-staff/lib/supabase/idle-timeout.ts's IDLE_TIMEOUT_MS).
    idleTimeoutMs: 15 * 60 * 1000,
    onProfileReadError: "unavailable",
    signedInLoginRedirect: `${PORTAL_PREFIX.super_staff}/accounts`,
  },
  {
    prefix: PORTAL_PREFIX.responder,
    role: "responder",
    // The same 60 minutes as Responder's browser-side clock
    // (src/portals/responder/lib/supabase/idle-timeout.ts's IDLE_TIMEOUT_MS):
    // a responder at a scene goes quiet on the phone for long stretches.
    idleTimeoutMs: 60 * 60 * 1000,
    onProfileReadError: "unavailable",
    signedInLoginRedirect: `${PORTAL_PREFIX.responder}/pool`,
  },
];
