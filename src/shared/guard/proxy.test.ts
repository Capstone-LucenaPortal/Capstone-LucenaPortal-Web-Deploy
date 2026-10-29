// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { guardRequest as middleware } from "@/shared/guard/proxy";
import { CLOCK_OFFSET_COOKIE, LAST_ACTIVITY_COOKIE } from "@/shared/guard/idle-clock";
import { IDLE_TIMEOUT_MS } from "@/portals/staff/lib/supabase/idle-timeout";

// Ported from the Staff Portal's middleware.test.ts (MRG-04): the request
// guard on Staff's row, end to end through its cookie adapter. Its matcher
// cases are now src/proxy.test.ts's; which paths are exempt is decided by
// decideRequest (src/shared/guard/decide.test.ts).
//
// The configuration boundary for ISO-6: what the middleware actually puts on
// the wire. @supabase/ssr is replaced by a fake that lets each test decide
// which cookies the library asks to write.

type CookieToSet = { name: string; value: string; options: CookieOptions };
type Adapter = { setAll(cookies: CookieToSet[], headers: Record<string, string>): void };

// What @supabase/ssr hands over alongside every cookie write.
const NO_CACHE = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

const getUser = vi.fn();
const signOut = vi.fn();
let adapter: Adapter;
let writesOnGetUser: CookieToSet[] = [];

// The my_staff_profile view, as the signed-in caller sees it. Each test sets
// the row; the default is an active Staff employee, who is admitted.
const ACTIVE_STAFF = {
  id: "11111111-1111-1111-1111-111111111111",
  full_name: "Juan Dela Cruz",
  email: "juan@lucena.gov",
  role: "staff",
  status: "active",
};
let profileRow: Record<string, unknown> | null = ACTIVE_STAFF;
let profileError: { message: string } | null = null;
const profileReads = vi.fn();

vi.mock("@supabase/ssr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@supabase/ssr")>()),
  createServerClient: (_url: string, _key: string, options: { cookies: Adapter }) => {
    adapter = options.cookies;
    return {
      auth: { getUser, signOut },
      from: (view: string) => ({
        select: () => ({
          maybeSingle: async () => {
            profileReads(view);
            return profileError ? { data: null, error: profileError } : { data: profileRow, error: null };
          },
        }),
      }),
    };
  },
}));

const NOW = 1_800_000_000_000;
const SUPABASE_MAX_AGE = 400 * 24 * 60 * 60;
const USER = { id: "staff-1" };

// Offset 0 by default: the browser and server agree, so each test reads in
// server time. The skew tests pass their own.
function requestTo(path: string, lastActivity?: number, offset: number | null = 0) {
  const request = new NextRequest(`http://localhost:3000${path}`);
  if (lastActivity !== undefined) {
    request.cookies.set(LAST_ACTIVITY_COOKIE, String(lastActivity));
  }
  if (offset !== null) {
    request.cookies.set(CLOCK_OFFSET_COOKIE, String(offset));
  }
  return request;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  writesOnGetUser = [];
  profileRow = ACTIVE_STAFF;
  profileError = null;
  getUser.mockImplementation(async () => {
    if (writesOnGetUser.length) adapter.setAll(writesOnGetUser, NO_CACHE);
    return { data: { user: USER } };
  });
  signOut.mockImplementation(async () => {
    adapter.setAll([{ name: "sb-auth-token", value: "", options: { path: "/", maxAge: 0 } }], NO_CACHE);
    return { error: null };
  });
  return () => {
    vi.unstubAllEnvs();
  };
});

// ISO-10: a missing variable must stop the request, by name, rather than
// surface later as an opaque fetch error inside supabase-js.
describe("middleware environment", () => {
  it("refuses to run without the project URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    await expect(middleware(requestTo("/staff/dashboard", NOW))).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("refuses to run without the anon key", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(middleware(requestTo("/staff/dashboard", NOW))).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});

describe("middleware session cookies", () => {
  it("writes refreshed auth cookies with no Max-Age, so they die with the browser", async () => {
    writesOnGetUser = [
      { name: "sb-auth-token", value: "fresh", options: { path: "/", sameSite: "lax", maxAge: SUPABASE_MAX_AGE } },
    ];

    const response = await middleware(requestTo("/staff/dashboard", NOW));

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sb-auth-token=fresh");
    expect(setCookie).not.toMatch(/Max-Age|Expires/i);
  });
});

describe("middleware idle timeout", () => {
  it("serves a session whose last activity is inside the window", async () => {
    const response = await middleware(requestTo("/staff/dashboard", NOW - IDLE_TIMEOUT_MS));

    expect(response.headers.get("location")).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("ends an idle session and sends it to the sign-in screen with the reason", async () => {
    const response = await middleware(requestTo("/staff/dashboard", NOW - IDLE_TIMEOUT_MS - 1));

    // Local scope: going idle at one desk must not sign the same person out
    // of the portal on every other device.
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(new URL(response.headers.get("location")!).pathname).toBe("/staff/login");
    expect(new URL(response.headers.get("location")!).search).toBe("?reason=idle");
  });

  it("carries the sign-out's cookie deletions on the redirect", async () => {
    const response = await middleware(requestTo("/staff/dashboard", NOW - IDLE_TIMEOUT_MS - 1));

    expect(response.headers.get("set-cookie")).toMatch(/sb-auth-token=;.*Max-Age=0/);
  });

  // ISO-10: the redirect sets auth cookies too, so it must not be cached.
  it("carries the sign-out's cache headers on the redirect", async () => {
    const response = await middleware(requestTo("/staff/dashboard", NOW - IDLE_TIMEOUT_MS - 1));

    expect(response.headers.get("cache-control")).toBe(NO_CACHE["Cache-Control"]);
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  // The revoke failing must not let the request through: the idle clock is
  // still stale, so every later request is refused the same way.
  it("refuses the request even when the sign-out call fails", async () => {
    signOut.mockResolvedValue({ error: { message: "network" } });

    const response = await middleware(requestTo("/staff/dashboard", NOW - IDLE_TIMEOUT_MS - 1));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/staff/login");
  });

  // Requests are not activity: the queue pages poll a server action, and a
  // request-driven clock would keep an unattended queue signed in forever.
  it("never moves the idle clock itself", async () => {
    const response = await middleware(requestTo("/staff/dashboard", NOW - 1000));

    expect(response.headers.get("set-cookie") ?? "").not.toContain(LAST_ACTIVITY_COOKIE);
  });

  // A desk PC running slow must not be signed out on every request.
  it("measures a skewed browser clock against the server once, then reads through it", async () => {
    const SKEW = 20 * 60 * 1000;
    const first = await middleware(requestTo("/staff/dashboard", NOW - SKEW, null));

    expect(first.headers.get("location")).toBeNull();
    expect(first.headers.get("set-cookie")).toContain(`${CLOCK_OFFSET_COOKIE}=${SKEW}`);
    expect(first.headers.get("set-cookie")).not.toMatch(/Max-Age|Expires/i);

    const later = await middleware(requestTo("/staff/dashboard", NOW - SKEW - 60_000, SKEW));
    expect(later.headers.get("location")).toBeNull();

    const idle = await middleware(requestTo("/staff/dashboard", NOW - SKEW - IDLE_TIMEOUT_MS - 1, SKEW));
    expect(new URL(idle.headers.get("location")!).search).toBe("?reason=idle");
  });

  it("fails open when no activity has been recorded", async () => {
    const response = await middleware(requestTo("/staff/dashboard"));

    expect(response.headers.get("location")).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("still sends a signed-out request to a plain /login", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const response = await middleware(requestTo("/staff/dashboard", NOW - IDLE_TIMEOUT_MS - 1));

    expect(new URL(response.headers.get("location")!).search).toBe("");
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("middleware signed-out redirect", () => {
  // A refresh that fails clears the auth cookie on its way out. The deletion,
  // and the cache headers that came with it, must reach the browser on the
  // redirect, or it keeps sending a dead token on every request.
  it("carries a failed refresh's cookie deletions and cache headers to /login", async () => {
    getUser.mockImplementation(async () => {
      adapter.setAll([{ name: "sb-auth-token", value: "", options: { path: "/", maxAge: 0 } }], NO_CACHE);
      return { data: { user: null } };
    });

    const response = await middleware(requestTo("/staff/dashboard", NOW));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/staff/login");
    expect(response.headers.get("set-cookie")).toMatch(/sb-auth-token=;.*Max-Age=0/);
    expect(response.headers.get("cache-control")).toBe(NO_CACHE["Cache-Control"]);
  });
});

// S6-15: a signed-in account that is not an active Staff employee is turned
// away before any portal page, bundle or API route is served to it.
describe("middleware role gate", () => {
  it("sends an employee of another portal to /forbidden", async () => {
    profileRow = { ...ACTIVE_STAFF, role: "admin" };

    const response = await middleware(requestTo("/staff/dashboard", NOW));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/staff/forbidden");
  });

  it("sends a citizen, who has no staff row, to /forbidden", async () => {
    profileRow = null;

    const response = await middleware(requestTo("/staff/api/booking/reservations", NOW));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/staff/forbidden");
  });

  it("sends a deactivated Staff employee to /forbidden", async () => {
    profileRow = { ...ACTIVE_STAFF, status: "inactive" };

    const response = await middleware(requestTo("/staff/yellow-card", NOW));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/staff/forbidden");
  });

  it("serves an active Staff employee", async () => {
    const response = await middleware(requestTo("/staff/dashboard", NOW));

    expect(response.headers.get("location")).toBeNull();
    expect(profileReads).toHaveBeenCalledWith("my_staff_profile");
  });

  // /forbidden is where the refusal lands; gating it would loop forever.
  it("serves /forbidden to the account it refuses", async () => {
    profileRow = null;

    const response = await middleware(requestTo("/staff/forbidden", NOW));

    expect(response.headers.get("location")).toBeNull();
  });

  it("refuses with the refreshed cookies and their cache headers on the redirect", async () => {
    profileRow = null;
    writesOnGetUser = [{ name: "sb-auth-token", value: "fresh", options: { path: "/" } }];

    const response = await middleware(requestTo("/staff/dashboard", NOW));

    expect(response.headers.get("set-cookie")).toContain("sb-auth-token=fresh");
    expect(response.headers.get("cache-control")).toBe(NO_CACHE["Cache-Control"]);
  });

  // A failed read is not an answer. Reading it as "no staff row" would tell
  // an active employee they are not one and AccessDenied would sign them out.
  it("refuses without a verdict or a sign-out when the role cannot be read", async () => {
    profileError = { message: "upstream timeout" };
    writesOnGetUser = [{ name: "sb-auth-token", value: "fresh", options: { path: "/" } }];

    const response = await middleware(requestTo("/staff/dashboard", NOW));

    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("sb-auth-token=fresh");
    expect(response.headers.get("cache-control")).toBe(NO_CACHE["Cache-Control"]);
  });

  // Issue #19: the idle clock is one cookie shared by every Portal, so Staff's
  // 15 minutes must not end a responder's session, which has an hour.
  it("refuses an idle session of another role without ending it", async () => {
    profileRow = { ...ACTIVE_STAFF, role: "responder" };

    const response = await middleware(requestTo("/staff/dashboard", NOW - IDLE_TIMEOUT_MS - 1));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/staff/forbidden");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("sends a signed-out request to /login without reading a profile", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const response = await middleware(requestTo("/staff/forbidden", NOW));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/staff/login");
    expect(profileReads).not.toHaveBeenCalled();
  });
});

// Ported from the old Responder middleware's tests: a row that sends a
// signed-in visit to login on into the Portal. That redirect replaces the
// response setAll wrote to, so whatever it wrote has to be carried across.
describe("middleware signed-in login redirect (Responder's row)", () => {
  const RESPONDER_IDLE_MS = 60 * 60 * 1000;

  beforeEach(() => {
    profileRow = { ...ACTIVE_STAFF, role: "responder" };
  });

  it("carries a refreshed token and its cache headers from /responder/login to the pool", async () => {
    writesOnGetUser = [
      { name: "sb-auth-token", value: "fresh", options: { path: "/", sameSite: "lax", maxAge: SUPABASE_MAX_AGE } },
    ];

    const response = await middleware(requestTo("/responder/login", NOW));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/responder/pool");
    expect(response.headers.get("set-cookie")).toContain("sb-auth-token=fresh");
    expect(response.headers.get("cache-control")).toBe(NO_CACHE["Cache-Control"]);
  });

  // Issue #19: sent on into the pool, a Staff session would land on
  // forbidden, which used to sign it out on every device.
  it("serves /responder/login to a Staff session and keeps it", async () => {
    profileRow = ACTIVE_STAFF;

    const response = await middleware(requestTo("/responder/login", NOW));

    expect(response.headers.get("location")).toBeNull();
    expect(profileReads).toHaveBeenCalledWith("my_staff_profile");
    expect(signOut).not.toHaveBeenCalled();
  });

  // An idle session must be ended there, not bounced into the Portal it timed
  // out of.
  it("ends an idle session that arrives at the sign-in screen", async () => {
    const response = await middleware(requestTo("/responder/login", NOW - RESPONDER_IDLE_MS - 1));

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/responder/login");
    expect(location.search).toBe("?reason=idle");
  });
});
