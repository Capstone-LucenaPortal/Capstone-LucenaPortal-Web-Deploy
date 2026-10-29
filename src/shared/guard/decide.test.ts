import { decideRequest, type GuardInput, type ProfileRead } from "@/shared/guard/decide";
import type { PortalRow } from "@/shared/guard/portals";

const NOW = 1_800_000_000_000;
const MINUTE = 60 * 1000;

const ok = (role: string | null, status: string | null = "active"): ProfileRead => ({
  ok: true,
  profile: role === null ? null : { role, status },
});
const noStaffRow: ProfileRead = { ok: true, profile: null };
const readFailed: ProfileRead = { ok: false };

type Row = [name: string, input: Partial<GuardInput> & { pathname: string }, expected: ReturnType<typeof decideRequest>];

function runRows(rows: Row[], portals?: readonly PortalRow[]) {
  it.each(rows)("%s", (_name, input, expected) => {
    expect(decideRequest({ hasSession: false, now: NOW, ...input }, portals)).toEqual(expected);
  });
}

describe("decideRequest — paths outside every staff prefix", () => {
  runRows([
    ["passes the citizen root through", { pathname: "/" }, { kind: "allow" }],
    ["passes a citizen page through", { pathname: "/dashboard" }, { kind: "allow" }],
    ["passes a root-level /login through", { pathname: "/login" }, { kind: "allow" }],
    ["does not read /administrator as /admin", { pathname: "/administrator" }, { kind: "allow" }],
    ["does not read /admin-help as /admin", { pathname: "/admin-help", hasSession: true }, { kind: "allow" }],
    ["does not read /staffing as /staff", { pathname: "/staffing", hasSession: true }, { kind: "allow" }],
  ]);
});

// Admin's row: role admin, no idle timeout, a failed profile read → forbidden,
// a signed-in visit to login is served as today. Rows ported from the old
// src/portals/admin/lib/supabase/access.test.ts (decideAccess, requiresRoleCheck).
describe("decideRequest — Admin (/admin)", () => {
  runRows([
    // No session.
    ["sends unauthenticated visitors to login", { pathname: "/admin/dashboard" }, { kind: "redirect", to: "/admin/login" }],
    ["sends an unauthenticated visit to the Portal root to login", { pathname: "/admin" }, { kind: "redirect", to: "/admin/login" }],
    ["lets unauthenticated visitors reach the login page", { pathname: "/admin/login" }, { kind: "allow" }],
    ["lets unauthenticated visitors reach the accept-invite page", { pathname: "/admin/accept-invite" }, { kind: "allow" }],
    ["sends an unauthenticated visit to forbidden to login", { pathname: "/admin/forbidden" }, { kind: "redirect", to: "/admin/login" }],
    ["still exempts a nested segment under /login", { pathname: "/admin/login/help" }, { kind: "allow" }],
    ["still exempts a nested segment under /accept-invite", { pathname: "/admin/accept-invite/step-2" }, { kind: "allow" }],
    // Anchoring: a bare string prefix would read these as login / accept-invite.
    ["does not treat /login-history as public", { pathname: "/admin/login-history" }, { kind: "redirect", to: "/admin/login" }],
    ["does not treat /accept-invite-history as public", { pathname: "/admin/accept-invite-history" }, { kind: "redirect", to: "/admin/login" }],

    // Session, exempt from the role check.
    ["lets authenticated users reach the login page without a role check", { pathname: "/admin/login", hasSession: true }, { kind: "allow" }],
    ["lets an authenticated (not-yet-admin) account reach accept-invite", { pathname: "/admin/accept-invite", hasSession: true }, { kind: "allow" }],
    ["lets authenticated non-admins reach the forbidden page itself", { pathname: "/admin/forbidden", hasSession: true }, { kind: "allow" }],

    // Session, role check needed.
    ["asks for the profile before serving an admin page", { pathname: "/admin/dashboard", hasSession: true }, { kind: "read-profile" }],
    ["asks for the profile on /login-history", { pathname: "/admin/login-history", hasSession: true }, { kind: "read-profile" }],
    ["asks for the profile on /accept-invite-history", { pathname: "/admin/accept-invite-history", hasSession: true }, { kind: "read-profile" }],
    ["lets an active admin through to admin pages", { pathname: "/admin/dashboard", hasSession: true, profile: ok("admin") }, { kind: "allow" }],
    ["lets an active admin through to the Portal root", { pathname: "/admin", hasSession: true, profile: ok("admin") }, { kind: "allow" }],
    ["sends an authenticated citizen (no staff row) to forbidden", { pathname: "/admin/dashboard", hasSession: true, profile: noStaffRow }, { kind: "redirect", to: "/admin/forbidden" }],
    ["sends an unrecognised role to forbidden", { pathname: "/admin/dashboard", hasSession: true, profile: ok("bogus") }, { kind: "redirect", to: "/admin/forbidden" }],
    ["sends a non-admin staff account to forbidden", { pathname: "/admin/yellow-card", hasSession: true, profile: ok("super_staff") }, { kind: "redirect", to: "/admin/forbidden" }],
    ["sends a deactivated admin to forbidden", { pathname: "/admin/dashboard", hasSession: true, profile: ok("admin", "inactive") }, { kind: "redirect", to: "/admin/forbidden" }],
    ["sends a non-admin to forbidden from /login-history", { pathname: "/admin/login-history", hasSession: true, profile: ok("super_staff") }, { kind: "redirect", to: "/admin/forbidden" }],
    ["sends a failed profile read to forbidden", { pathname: "/admin/dashboard", hasSession: true, profile: readFailed }, { kind: "redirect", to: "/admin/forbidden" }],

    // No idle timeout: a clock long stale changes nothing.
    ["ignores a stale activity clock", { pathname: "/admin/dashboard", hasSession: true, profile: ok("admin"), lastActivity: NOW - 24 * 60 * MINUTE }, { kind: "allow" }],
  ]);
});

// Staff's row: role staff, 15-minute idle timeout, a failed profile read → 503,
// a signed-in visit to login is served as today. Rows ported from the old
// Staff middleware's tests (src/middleware.test.ts: its role gate, idle
// timeout and matcher cases; the wire-level cases are proxy.test.ts's).
describe("decideRequest — Staff (/staff)", () => {
  runRows([
    // No session. The old matcher left login and accept-invite unguarded.
    ["sends unauthenticated visitors to login", { pathname: "/staff/dashboard" }, { kind: "redirect", to: "/staff/login" }],
    ["sends an unauthenticated visit to the Portal root to login", { pathname: "/staff" }, { kind: "redirect", to: "/staff/login" }],
    ["lets unauthenticated visitors reach the login page", { pathname: "/staff/login" }, { kind: "allow" }],
    ["lets unauthenticated visitors reach the accept-invite page", { pathname: "/staff/accept-invite" }, { kind: "allow" }],
    ["still exempts a nested segment under /accept-invite", { pathname: "/staff/accept-invite/confirm" }, { kind: "allow" }],
    ["gates /forbidden, so a signed-out visitor is sent to sign in", { pathname: "/staff/forbidden" }, { kind: "redirect", to: "/staff/login" }],
    ["gates the document routes", { pathname: "/staff/api/booking/documents/1" }, { kind: "redirect", to: "/staff/login" }],
    ["does not treat /login-history as public", { pathname: "/staff/login-history" }, { kind: "redirect", to: "/staff/login" }],
    ["sends no session to a plain login, not to the idle sign-out", { pathname: "/staff/dashboard", lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/staff/login" }],

    // Session, exempt from the role check.
    ["serves login to a signed-in visit, as before", { pathname: "/staff/login", hasSession: true }, { kind: "allow" }],
    ["serves /forbidden to the account it refuses", { pathname: "/staff/forbidden", hasSession: true }, { kind: "allow" }],

    // Idle timeout: 15 minutes, for this Portal's own role only. The clock is
    // one cookie shared by every Portal, so another role's session is not this
    // Portal's to time out (issue #19): it is refused, not signed out.
    ["serves a session whose last activity is inside the window", { pathname: "/staff/dashboard", hasSession: true, profile: ok("staff"), lastActivity: NOW - 15 * MINUTE }, { kind: "allow" }],
    ["ends an idle session and sends it to login with the reason", { pathname: "/staff/dashboard", hasSession: true, profile: ok("staff"), lastActivity: NOW - 15 * MINUTE - 1 }, { kind: "redirect", to: "/staff/login?reason=idle", signOut: true }],
    ["reads the role of an idle session before ending it", { pathname: "/staff/dashboard", hasSession: true, lastActivity: NOW - 16 * MINUTE }, { kind: "read-profile" }],
    ["ends an idle session of a deactivated account of this Portal's role", { pathname: "/staff/dashboard", hasSession: true, profile: ok("staff", "inactive"), lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/staff/login?reason=idle", signOut: true }],
    ["ends an idle session whose role cannot be read", { pathname: "/staff/dashboard", hasSession: true, profile: readFailed, lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/staff/login?reason=idle", signOut: true }],
    ["refuses an idle session of another role without ending it", { pathname: "/staff/dashboard", hasSession: true, profile: ok("responder"), lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/staff/forbidden" }],
    ["serves forbidden to an idle session of another role without ending it", { pathname: "/staff/forbidden", hasSession: true, profile: ok("responder"), lastActivity: NOW - 16 * MINUTE }, { kind: "allow" }],
    ["fails open when no activity has been recorded", { pathname: "/staff/dashboard", hasSession: true, profile: ok("staff") }, { kind: "allow" }],

    // Session, role check needed.
    ["asks for the profile before serving a Staff page", { pathname: "/staff/dashboard", hasSession: true }, { kind: "read-profile" }],
    ["serves an active Staff employee", { pathname: "/staff/dashboard", hasSession: true, profile: ok("staff") }, { kind: "allow" }],
    ["sends an employee of another portal to forbidden", { pathname: "/staff/dashboard", hasSession: true, profile: ok("admin") }, { kind: "redirect", to: "/staff/forbidden" }],
    ["sends a citizen, who has no staff row, to forbidden", { pathname: "/staff/api/booking/reservations", hasSession: true, profile: noStaffRow }, { kind: "redirect", to: "/staff/forbidden" }],
    ["sends a deactivated Staff employee to forbidden", { pathname: "/staff/yellow-card", hasSession: true, profile: ok("staff", "inactive") }, { kind: "redirect", to: "/staff/forbidden" }],
    ["refuses a failed profile read with a 503, without a verdict", { pathname: "/staff/dashboard", hasSession: true, profile: readFailed }, { kind: "unavailable" }],
  ]);
});

// Super-staff's row: role super_staff, 15-minute idle timeout, a failed
// profile read → 503, a signed-in visit to login by a Super Staff account
// goes on to the accounts pool. Rows ported from the old Super-staff
// middleware's tests (src/middleware.test.ts:
// its role gate, idle timeout and matcher cases; the wire-level cases were the
// same as Staff's and are proxy.test.ts's).
describe("decideRequest — Super-staff (/super-staff)", () => {
  runRows([
    // No session. The old matcher left login and accept-invite unguarded.
    ["sends unauthenticated visitors to login", { pathname: "/super-staff/accounts" }, { kind: "redirect", to: "/super-staff/login" }],
    ["sends an unauthenticated visit to the Portal root to login", { pathname: "/super-staff" }, { kind: "redirect", to: "/super-staff/login" }],
    ["judges /super-staff by its own row, not /staff's", { pathname: "/super-staff/dashboard" }, { kind: "redirect", to: "/super-staff/login" }],
    ["lets unauthenticated visitors reach the login page", { pathname: "/super-staff/login" }, { kind: "allow" }],
    ["lets unauthenticated visitors reach the accept-invite page", { pathname: "/super-staff/accept-invite" }, { kind: "allow" }],
    ["still exempts a nested segment under /accept-invite", { pathname: "/super-staff/accept-invite/confirm" }, { kind: "allow" }],
    ["gates /forbidden, so a signed-out visitor is sent to sign in", { pathname: "/super-staff/forbidden" }, { kind: "redirect", to: "/super-staff/login" }],
    ["does not treat /login-history as public", { pathname: "/super-staff/login-history" }, { kind: "redirect", to: "/super-staff/login" }],
    ["gates the audit log", { pathname: "/super-staff/audit-log" }, { kind: "redirect", to: "/super-staff/login" }],
    ["sends no session to a plain login, not to the idle sign-out", { pathname: "/super-staff/accounts", lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/super-staff/login" }],

    // A signed-in visit to login goes on into the Portal only for its own
    // role. Any other account is shown the form, its session kept (issue #19):
    // sent on in, it would land on forbidden.
    ["asks for the role of a signed-in visit to login", { pathname: "/super-staff/login", hasSession: true }, { kind: "read-profile" }],
    ["sends a Super Staff employee off the sign-in form to the accounts pool", { pathname: "/super-staff/login", hasSession: true, profile: ok("super_staff") }, { kind: "redirect", to: "/super-staff/accounts" }],
    ["serves the sign-in form to a Staff employee, session kept", { pathname: "/super-staff/login", hasSession: true, profile: ok("staff") }, { kind: "allow" }],
    ["serves the sign-in form to a responder idle past this Portal's 15 minutes, session kept", { pathname: "/super-staff/login", hasSession: true, profile: ok("responder"), lastActivity: NOW - 20 * MINUTE }, { kind: "allow" }],
    ["ends an idle Super Staff session that arrives at the sign-in form", { pathname: "/super-staff/login", hasSession: true, profile: ok("super_staff"), lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/super-staff/login?reason=idle", signOut: true }],

    // Session, exempt from the role check.
    ["serves /forbidden to the account it refuses", { pathname: "/super-staff/forbidden", hasSession: true }, { kind: "allow" }],

    // Idle timeout: 15 minutes, for this Portal's own role only. The clock is
    // one cookie shared by every Portal, so another role's session is not this
    // Portal's to time out (issue #19): it is refused, not signed out.
    ["serves a session whose last activity is inside the window", { pathname: "/super-staff/accounts", hasSession: true, profile: ok("super_staff"), lastActivity: NOW - 15 * MINUTE }, { kind: "allow" }],
    ["ends an idle session and sends it to login with the reason", { pathname: "/super-staff/accounts", hasSession: true, profile: ok("super_staff"), lastActivity: NOW - 15 * MINUTE - 1 }, { kind: "redirect", to: "/super-staff/login?reason=idle", signOut: true }],
    ["reads the role of an idle session before ending it", { pathname: "/super-staff/accounts", hasSession: true, lastActivity: NOW - 16 * MINUTE }, { kind: "read-profile" }],
    ["ends an idle session of a deactivated account of this Portal's role", { pathname: "/super-staff/accounts", hasSession: true, profile: ok("super_staff", "inactive"), lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/super-staff/login?reason=idle", signOut: true }],
    ["ends an idle session whose role cannot be read", { pathname: "/super-staff/accounts", hasSession: true, profile: readFailed, lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/super-staff/login?reason=idle", signOut: true }],
    ["refuses an idle session of another role without ending it", { pathname: "/super-staff/accounts", hasSession: true, profile: ok("responder"), lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/super-staff/forbidden" }],
    ["serves forbidden to an idle session of another role without ending it", { pathname: "/super-staff/forbidden", hasSession: true, profile: ok("responder"), lastActivity: NOW - 16 * MINUTE }, { kind: "allow" }],
    ["fails open when no activity has been recorded", { pathname: "/super-staff/accounts", hasSession: true, profile: ok("super_staff") }, { kind: "allow" }],

    // Session, role check needed.
    ["asks for the profile before serving a Super-staff page", { pathname: "/super-staff/accounts", hasSession: true }, { kind: "read-profile" }],
    ["serves an active Super Staff employee", { pathname: "/super-staff/accounts", hasSession: true, profile: ok("super_staff") }, { kind: "allow" }],
    ["sends an employee of another portal to forbidden", { pathname: "/super-staff/accounts", hasSession: true, profile: ok("staff") }, { kind: "redirect", to: "/super-staff/forbidden" }],
    ["sends a citizen, who has no staff row, to forbidden", { pathname: "/super-staff/audit-log", hasSession: true, profile: noStaffRow }, { kind: "redirect", to: "/super-staff/forbidden" }],
    ["sends a deactivated Super Staff employee to forbidden", { pathname: "/super-staff/accounts", hasSession: true, profile: ok("super_staff", "inactive") }, { kind: "redirect", to: "/super-staff/forbidden" }],
    ["refuses a failed profile read with a 503, without a verdict", { pathname: "/super-staff/accounts", hasSession: true, profile: readFailed }, { kind: "unavailable" }],

    // Super-staff's row does not admit a Staff employee, nor Staff's a Super Staff one.
    ["sends a Super Staff employee on /staff to Staff's forbidden page", { pathname: "/staff/dashboard", hasSession: true, profile: ok("super_staff") }, { kind: "redirect", to: "/staff/forbidden" }],
  ]);
});

// Responder's row: role responder, 60-minute idle timeout, a failed profile
// read → 503, a signed-in visit to login by a responder goes on to the pool.
// Rows ported from the old Responder route gate
// (src/features/auth/lib/route-gate.test.ts) and middleware's tests (src/middleware.test.ts: its role gate, idle timeout and
// matcher cases; the wire-level cases are proxy.test.ts's).
describe("decideRequest — Responder (/responder)", () => {
  runRows([
    // No session. The old matcher left accept-invite unguarded.
    ["turns a signed-out visitor away from a portal page", { pathname: "/responder/pool" }, { kind: "redirect", to: "/responder/login" }],
    ["turns a signed-out visitor away from a nested portal page", { pathname: "/responder/incidents/inc-4501" }, { kind: "redirect", to: "/responder/login" }],
    ["sends an unauthenticated visit to the Portal root to login", { pathname: "/responder" }, { kind: "redirect", to: "/responder/login" }],
    ["lets a signed-out visitor reach the sign-in form", { pathname: "/responder/login" }, { kind: "allow" }],
    ["turns a signed-out visitor away from /forbidden", { pathname: "/responder/forbidden" }, { kind: "redirect", to: "/responder/login" }],
    ["never bounces the invite flow, signed out", { pathname: "/responder/accept-invite" }, { kind: "allow" }],
    ["never bounces the invite flow, signed in", { pathname: "/responder/accept-invite", hasSession: true }, { kind: "allow" }],
    ["still exempts a nested segment under /accept-invite", { pathname: "/responder/accept-invite/confirm" }, { kind: "allow" }],
    // Anchoring: a bare string prefix would read these as login / accept-invite.
    ["treats a path that merely starts with login as a portal page", { pathname: "/responder/login-help" }, { kind: "redirect", to: "/responder/login" }],
    ["asks for the role on a path that merely starts with login", { pathname: "/responder/login-help", hasSession: true }, { kind: "read-profile" }],
    ["gates a look-alike of the invite flow", { pathname: "/responder/accept-invite-anything" }, { kind: "redirect", to: "/responder/login" }],
    ["sends no session to a plain login, not to the idle sign-out", { pathname: "/responder/pool", lastActivity: NOW - 61 * MINUTE }, { kind: "redirect", to: "/responder/login" }],

    // A signed-in visit to login goes on to the pool only for a responder.
    // Any other account is shown the form, its session kept (issue #19): sent
    // on into the pool, it would land on forbidden.
    ["asks for the role of a signed-in visit to the sign-in form", { pathname: "/responder/login", hasSession: true }, { kind: "read-profile" }],
    ["sends a responder off the sign-in form to the pool", { pathname: "/responder/login", hasSession: true, profile: ok("responder") }, { kind: "redirect", to: "/responder/pool" }],
    ["sends a deactivated responder on to the pool, whose forbidden page says why", { pathname: "/responder/login", hasSession: true, profile: ok("responder", "inactive") }, { kind: "redirect", to: "/responder/pool" }],
    ["serves the sign-in form to an employee of another portal, session kept", { pathname: "/responder/login", hasSession: true, profile: ok("admin") }, { kind: "allow" }],
    ["serves the sign-in form to a citizen, session kept", { pathname: "/responder/login", hasSession: true, profile: noStaffRow }, { kind: "allow" }],
    ["serves the sign-in form when the role cannot be read, not a 503", { pathname: "/responder/login", hasSession: true, profile: readFailed }, { kind: "allow" }],
    ["ends an idle session that arrives at the sign-in form, not bounce it into the pool", { pathname: "/responder/login", hasSession: true, profile: ok("responder"), lastActivity: NOW - 61 * MINUTE }, { kind: "redirect", to: "/responder/login?reason=idle", signOut: true }],
    ["sends a live responder session on the sign-in form to the pool", { pathname: "/responder/login", hasSession: true, profile: ok("responder"), lastActivity: NOW - 59 * MINUTE }, { kind: "redirect", to: "/responder/pool" }],

    // Session, exempt from the role check.
    ["serves /forbidden to the account it refuses", { pathname: "/responder/forbidden", hasSession: true }, { kind: "allow" }],

    // Idle timeout: 60 minutes, for this Portal's own role only. The clock is
    // one cookie shared by every Portal, so another role's session is not this
    // Portal's to time out (issue #19): it is refused, not signed out.
    ["serves a session whose last activity is inside the window", { pathname: "/responder/pool", hasSession: true, profile: ok("responder"), lastActivity: NOW - 60 * MINUTE }, { kind: "allow" }],
    ["ends an idle session and sends it to login with the reason", { pathname: "/responder/pool", hasSession: true, profile: ok("responder"), lastActivity: NOW - 60 * MINUTE - 1 }, { kind: "redirect", to: "/responder/login?reason=idle", signOut: true }],
    ["reads the role of an idle session before ending it", { pathname: "/responder/pool", hasSession: true, lastActivity: NOW - 61 * MINUTE }, { kind: "read-profile" }],
    ["ends an idle session of a deactivated account of this Portal's role", { pathname: "/responder/pool", hasSession: true, profile: ok("responder", "inactive"), lastActivity: NOW - 61 * MINUTE }, { kind: "redirect", to: "/responder/login?reason=idle", signOut: true }],
    ["ends an idle session whose role cannot be read", { pathname: "/responder/pool", hasSession: true, profile: readFailed, lastActivity: NOW - 61 * MINUTE }, { kind: "redirect", to: "/responder/login?reason=idle", signOut: true }],
    ["refuses an idle session of another role without ending it", { pathname: "/responder/pool", hasSession: true, profile: ok("staff"), lastActivity: NOW - 61 * MINUTE }, { kind: "redirect", to: "/responder/forbidden" }],
    ["serves forbidden to an idle session of another role without ending it", { pathname: "/responder/forbidden", hasSession: true, profile: ok("staff"), lastActivity: NOW - 61 * MINUTE }, { kind: "allow" }],
    ["keeps a session idle past Staff's 15 minutes", { pathname: "/responder/my-ticket", hasSession: true, profile: ok("responder"), lastActivity: NOW - 16 * MINUTE }, { kind: "allow" }],
    ["fails open when no activity has been recorded", { pathname: "/responder/pool", hasSession: true, profile: ok("responder") }, { kind: "allow" }],

    // Session, role check needed.
    ["asks for the role of a signed-in visitor on a portal page", { pathname: "/responder/pool", hasSession: true }, { kind: "read-profile" }],
    ["asks for the role at the Portal root too, before it redirects into the pool", { pathname: "/responder", hasSession: true }, { kind: "read-profile" }],
    ["serves an active responder", { pathname: "/responder/pool", hasSession: true, profile: ok("responder") }, { kind: "allow" }],
    ["sends an employee of another portal to forbidden", { pathname: "/responder/pool", hasSession: true, profile: ok("staff") }, { kind: "redirect", to: "/responder/forbidden" }],
    ["sends a citizen, who has no staff row, to forbidden", { pathname: "/responder/incidents/inc-4501", hasSession: true, profile: noStaffRow }, { kind: "redirect", to: "/responder/forbidden" }],
    ["sends a deactivated responder to forbidden", { pathname: "/responder/my-ticket", hasSession: true, profile: ok("responder", "inactive") }, { kind: "redirect", to: "/responder/forbidden" }],
    ["refuses a failed profile read with a 503, without a verdict", { pathname: "/responder/pool", hasSession: true, profile: readFailed }, { kind: "unavailable" }],

    // Responder's row does not admit another role's employee, nor theirs a responder.
    ["sends a responder on /staff to Staff's forbidden page", { pathname: "/staff/dashboard", hasSession: true, profile: ok("responder") }, { kind: "redirect", to: "/staff/forbidden" }],
    ["sends a Staff employee on /responder to Responder's forbidden page", { pathname: "/responder/pool", hasSession: true, profile: ok("staff") }, { kind: "redirect", to: "/responder/forbidden" }],
  ]);
});

// The row fields, exercised on a fixture table carrying the values the Staff
// and Responder rows ship with (MRG-04, MRG-06), so the Responder fields are
// covered before its row lands. Not the shipped table.
const FIXTURE_PORTALS: readonly PortalRow[] = [
  { prefix: "/staff", role: "staff", idleTimeoutMs: 15 * MINUTE, onProfileReadError: "unavailable", signedInLoginRedirect: null },
  { prefix: "/responder", role: "responder", idleTimeoutMs: 60 * MINUTE, onProfileReadError: "unavailable", signedInLoginRedirect: "/responder/pool" },
];

describe("decideRequest — row fields, on a fixture table", () => {
  runRows(
    [
      // Idle timeout.
      ["serves a session inside the idle window", { pathname: "/staff/dashboard", hasSession: true, profile: ok("staff"), lastActivity: NOW - 15 * MINUTE }, { kind: "allow" }],
      ["signs out a session idle past the window, to login with the idle reason", { pathname: "/staff/dashboard", hasSession: true, profile: ok("staff"), lastActivity: NOW - 15 * MINUTE - 1 }, { kind: "redirect", to: "/staff/login?reason=idle", signOut: true }],
      ["checks idleness before the role's status", { pathname: "/staff/dashboard", hasSession: true, profile: ok("staff", "inactive"), lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/staff/login?reason=idle", signOut: true }],
      ["signs out an idle session of the row's role on forbidden too", { pathname: "/staff/forbidden", hasSession: true, profile: ok("staff"), lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/staff/login?reason=idle", signOut: true }],
      ["reads the role of an idle session before ending it", { pathname: "/staff/forbidden", hasSession: true, lastActivity: NOW - 16 * MINUTE }, { kind: "read-profile" }],
      ["applies only the row's own role's timeout", { pathname: "/staff/dashboard", hasSession: true, profile: ok("responder"), lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/staff/forbidden" }],
      ["applies each row's own timeout", { pathname: "/responder/pool", hasSession: true, profile: ok("responder"), lastActivity: NOW - 59 * MINUTE }, { kind: "allow" }],
      ["signs out a Responder idle past 60 minutes", { pathname: "/responder/pool", hasSession: true, profile: ok("responder"), lastActivity: NOW - 61 * MINUTE }, { kind: "redirect", to: "/responder/login?reason=idle", signOut: true }],
      ["fails open when no activity has been recorded", { pathname: "/staff/dashboard", hasSession: true, profile: ok("staff") }, { kind: "allow" }],
      ["does not read a clock in the future as idle", { pathname: "/staff/dashboard", hasSession: true, profile: ok("staff"), lastActivity: NOW + MINUTE }, { kind: "allow" }],
      ["sends no session to login, not to the idle sign-out", { pathname: "/staff/dashboard", lastActivity: NOW - 16 * MINUTE }, { kind: "redirect", to: "/staff/login" }],
      ["serves login to a stale clock with no session", { pathname: "/staff/login", lastActivity: NOW - 16 * MINUTE }, { kind: "allow" }],

      // A failed profile read.
      ["answers a failed profile read with a 503, session intact", { pathname: "/staff/dashboard", hasSession: true, profile: readFailed }, { kind: "unavailable" }],

      // Role, per row.
      ["lets an active staff account into /staff", { pathname: "/staff/dashboard", hasSession: true, profile: ok("staff") }, { kind: "allow" }],
      ["refuses a staff account on /responder to that Portal's forbidden page", { pathname: "/responder/pool", hasSession: true, profile: ok("staff") }, { kind: "redirect", to: "/responder/forbidden" }],
      ["refuses a deactivated responder", { pathname: "/responder/pool", hasSession: true, profile: ok("responder", "inactive") }, { kind: "redirect", to: "/responder/forbidden" }],

      // A signed-in visit to login.
      ["reads the role of a signed-in visit to /responder/login", { pathname: "/responder/login", hasSession: true }, { kind: "read-profile" }],
      ["sends that row's own role on to the pool", { pathname: "/responder/login", hasSession: true, profile: ok("responder") }, { kind: "redirect", to: "/responder/pool" }],
      ["serves /responder/login to another role's signed-in visit", { pathname: "/responder/login", hasSession: true, profile: ok("staff") }, { kind: "allow" }],
      ["serves /responder/login to a visitor with no session", { pathname: "/responder/login" }, { kind: "allow" }],
      ["serves /staff/login to a signed-in visit, as that row says", { pathname: "/staff/login", hasSession: true }, { kind: "allow" }],

      // Prefixes without a row pass through.
      ["passes a prefix the table has no row for through", { pathname: "/admin/dashboard" }, { kind: "allow" }],
    ],
    FIXTURE_PORTALS,
  );
});
