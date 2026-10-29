// src/shared/guard/decide.ts
//
// The request guard's decision, as one pure function: given the path, whether
// a session exists, the staff profile (or that reading it failed) and the
// time of last activity, it says allow, redirect, or 503. The proxy
// (src/shared/guard/proxy.ts) gathers those inputs and acts on the answer;
// the per-Portal rules come from src/shared/guard/portals.ts.
//
// This is NOT the security boundary — every view and RPC re-checks
// is_active_staff(<role>) independently. It exists so a person who lands in
// the wrong Portal, or whose account was never a staff account, is told why
// instead of meeting a working page where every gated query returns nothing.

import { PORTALS, type PortalRow, type StaffRole } from "@/shared/guard/portals";

export interface StaffRoleProfile {
  role: string | null;
  status: string | null;
}

/** The result of reading my_staff_profile: a row (or none), or a failure. */
export type ProfileRead = { ok: true; profile: StaffRoleProfile | null } | { ok: false };

export interface GuardInput {
  pathname: string;
  hasSession: boolean;
  /** Absent until read — the decision asks for it with "read-profile". */
  profile?: ProfileRead;
  /** Time of the last thing the person did, in server time; absent when unknown. */
  lastActivity?: number;
  now: number;
}

export type GuardDecision =
  | { kind: "allow" }
  /** A signed-in request needing a role check: read my_staff_profile, then decide again. */
  | { kind: "read-profile" }
  /** signOut: end the session (local scope) before redirecting. */
  | { kind: "redirect"; to: string; signOut?: true }
  /** Refuse this one request with a 503, session intact. */
  | { kind: "unavailable" };

/** `<prefix>/login?reason=idle` tells the sign-in screen why the person is there. */
export const IDLE_SIGNOUT_REASON = "idle";

const STAFF_ROLES: readonly StaffRole[] = ["staff", "responder", "admin", "super_staff"];

function isStaffRole(role: string | null): role is StaffRole {
  return role !== null && (STAFF_ROLES as readonly string[]).includes(role);
}

export type RoleVerdict =
  | { kind: "allow" }
  | { kind: "not-an-employee" }
  | { kind: "wrong-portal"; role: StaffRole }
  | { kind: "deactivated" };

// Identity, then Portal, then status. Order matters for which message a
// refusal screen shows: an account with no staff row is told it is not a city
// employee; an account of another role is told which Portal to use, even if
// it is also deactivated (that Portal will tell it so); only an account of
// this Portal's role has its status checked.
export function judgeStaffProfile(profile: StaffRoleProfile | null, portalRole: StaffRole): RoleVerdict {
  const role = profile?.role ?? null;

  if (!isStaffRole(role)) {
    return { kind: "not-an-employee" };
  }
  if (role !== portalRole) {
    return { kind: "wrong-portal", role };
  }
  return profile?.status === "active" ? { kind: "allow" } : { kind: "deactivated" };
}

/**
 * Whether a Portal's refusal screen ends the session: only a deactivated
 * account's, and then in this browser only (signOut({ scope: "local" })).
 * Every Portal shares one session cookie, so ending another Portal's account
 * (or a citizen's) on a refusal screen ended it in its own Portal too — and on
 * every device, signOut()'s default (issue #19). Nothing is gained by ending
 * it: this guard already keeps it off every page of the refusing Portal.
 */
export function refusalEndsSession(verdict: Exclude<RoleVerdict, { kind: "allow" }>): boolean {
  return verdict.kind === "deactivated";
}

// Matches the path exactly, or as a segment prefix ("<path>/..."). A bare
// startsWith would read "/admin/login-history" as the login page.
function matchesPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function portalFor(pathname: string, portals: readonly PortalRow[] = PORTALS): PortalRow | null {
  return portals.find((portal) => matchesPath(pathname, portal.prefix)) ?? null;
}

function isIdle(portal: PortalRow, lastActivity: number | undefined, now: number): boolean {
  // A missing clock fails open: the alternative signs out every session that
  // predates it. A clock in the future (an NTP correction) gives a negative
  // age, which is not idle.
  if (portal.idleTimeoutMs === null || lastActivity === undefined) {
    return false;
  }
  return now - lastActivity > portal.idleTimeoutMs;
}

export function decideRequest(input: GuardInput, portals: readonly PortalRow[] = PORTALS): GuardDecision {
  const { pathname, hasSession, profile, lastActivity, now } = input;

  const portal = portalFor(pathname, portals);
  if (!portal) return { kind: "allow" };

  const { prefix } = portal;
  const loginPath = `${prefix}/login`;
  const forbiddenPath = `${prefix}/forbidden`;

  // The invite flow builds its session from an emailed token: gating it would
  // bounce an invited employee before they can set a password, and the
  // account doing so does not have its role confirmed yet.
  if (matchesPath(pathname, `${prefix}/accept-invite`)) return { kind: "allow" };

  const idleSignOut: GuardDecision = {
    kind: "redirect",
    to: `${loginPath}?reason=${IDLE_SIGNOUT_REASON}`,
    signOut: true,
  };

  const isLogin = matchesPath(pathname, loginPath);

  // Login is never refused, or a refused account bounced there would bounce
  // forever. A row that sends a signed-in visit on into the Portal ends an
  // idle session here instead (below): bounced into the Portal it timed out
  // of, it would only be sent back. It cannot loop — the sign-out lands on
  // login with no session, which is served.
  const loginRedirect = portal.signedInLoginRedirect;
  if (isLogin && (!hasSession || loginRedirect === null)) return { kind: "allow" };

  if (!hasSession) return { kind: "redirect", to: loginPath };

  // Every Portal shares one session cookie and one idle clock, so this Portal's
  // timeout ends only a session of its own role: a responder quiet for twenty
  // minutes — inside Responder's hour — who opens a Staff page is refused
  // there, not signed out of this browser (issue #19). The role is read only
  // for an idle session, and a failed read ends it, as before the role mattered.
  if (isIdle(portal, lastActivity, now)) {
    if (!profile) return { kind: "read-profile" };
    if (!profile.ok || profile.profile?.role === portal.role) return idleSignOut;
  }

  // Only this Portal's own role is sent on in from login — a deactivated one
  // too, whose forbidden page tells it so; the status is not checked here.
  // Another role's account (or a citizen's) sent on in would land on
  // forbidden; it is shown the form instead, its session kept (issue #19). A
  // failed read is not an answer, and the form is harmless, so it is served.
  if (isLogin && loginRedirect !== null) {
    if (!profile) return { kind: "read-profile" };
    return profile.ok && profile.profile?.role === portal.role
      ? { kind: "redirect", to: loginRedirect }
      : { kind: "allow" };
  }

  // Forbidden is where refusals land; role-checking it would loop.
  if (matchesPath(pathname, forbiddenPath)) return { kind: "allow" };

  if (!profile) return { kind: "read-profile" };

  // A failed read is not an answer. Taken as "no staff row" it would tell an
  // active employee they are not one.
  if (!profile.ok) {
    return portal.onProfileReadError === "unavailable"
      ? { kind: "unavailable" }
      : { kind: "redirect", to: forbiddenPath };
  }

  return judgeStaffProfile(profile.profile, portal.role).kind === "allow"
    ? { kind: "allow" }
    : { kind: "redirect", to: forbiddenPath };
}
