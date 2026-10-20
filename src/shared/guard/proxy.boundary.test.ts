// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { guardRequest as middleware } from "@/shared/guard/proxy";
import { citizenAuthCookieName } from "@/shared/supabase/session-cookie";

// Ported from the Staff Portal's middleware.boundary.test.ts (MRG-04), on
// Staff's row.
//
// ISO-6 end to end: the real @supabase/ssr, with only the network stubbed.
// proxy.test.ts proves the adapter strips what it is handed; this proves
// what the library actually hands it — a 400-day cookie on every token
// refresh — never reaches the browser.

const SUPABASE_URL = "http://localhost:54321";
const AUTH_COOKIE = "sb-localhost-auth-token";
const NOW_S = 1_800_000_000;

const USER = { id: "staff-1", aud: "authenticated", role: "authenticated", email: "staff@lucena.gov" };

function session(expiresAt: number, accessToken: string) {
  return {
    access_token: accessToken,
    refresh_token: `refresh-${accessToken}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: USER,
  };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

// The role gate's read of my_staff_profile, as PostgREST answers it: the rows
// RLS lets the caller see. An active Staff employee by default.
const ACTIVE_STAFF = { id: USER.id, full_name: "Juan Dela Cruz", email: USER.email, role: "staff", status: "active" };
let profileRows: unknown[] = [ACTIVE_STAFF];

beforeEach(() => {
  profileRows = [ACTIVE_STAFF];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW_S * 1000);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/token?grant_type=refresh_token")) return json(session(NOW_S + 3600, "fresh"));
      if (url.endsWith("/user")) return json(USER);
      if (url.includes("/rest/v1/my_staff_profile")) return json(profileRows);
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("middleware with the real Supabase client", () => {
  it("sends a refreshed auth cookie with no Max-Age or Expires", async () => {
    const request = new NextRequest("http://localhost:3000/staff/dashboard");
    // An expired access token, so getUser() has to refresh it.
    request.cookies.set(AUTH_COOKIE, JSON.stringify(session(NOW_S - 60, "stale")));

    const response = await middleware(request);

    const setCookie = response.headers.getSetCookie().find((c) => c.startsWith(`${AUTH_COOKIE}=`));
    expect(setCookie).toBeDefined();
    expect(setCookie).not.toMatch(/Max-Age|Expires/i);
  });

  // ISO-10: a response that sets an auth cookie must not be cached, or a CDN
  // or proxy can serve one person's session to the next. The library names
  // the headers; the middleware has to put them on the wire.
  it("marks a response carrying a refreshed auth cookie as uncacheable", async () => {
    const request = new NextRequest("http://localhost:3000/staff/dashboard");
    request.cookies.set(AUTH_COOKIE, JSON.stringify(session(NOW_S - 60, "stale")));

    const response = await middleware(request);

    expect(response.headers.get("cache-control")).toMatch(/no-store/);
    expect(response.headers.get("cache-control")).toMatch(/private/);
  });

  // S6-15 through the real query builder: the view's answer, not a fake's,
  // decides the gate. RLS returns a citizen no row at all.
  it("serves an active Staff employee and refuses a citizen", async () => {
    const request = () => {
      const r = new NextRequest("http://localhost:3000/staff/dashboard");
      r.cookies.set(AUTH_COOKIE, JSON.stringify(session(NOW_S + 3600, "live")));
      return r;
    };

    expect((await middleware(request())).headers.get("location")).toBeNull();

    profileRows = [];
    const refused = await middleware(request());
    expect(new URL(refused.headers.get("location")!).pathname).toBe("/staff/forbidden");
  });

  // Ported from the old Super-staff middleware's boundary test: the same gate
  // through Super-staff's row.
  it("serves an active Super Staff employee and refuses a citizen", async () => {
    profileRows = [{ ...ACTIVE_STAFF, full_name: "Maria Santos", role: "super_staff" }];
    const request = () => {
      const r = new NextRequest("http://localhost:3000/super-staff/accounts");
      r.cookies.set(AUTH_COOKIE, JSON.stringify(session(NOW_S + 3600, "live")));
      return r;
    };

    expect((await middleware(request())).headers.get("location")).toBeNull();

    profileRows = [];
    const refused = await middleware(request());
    expect(new URL(refused.headers.get("location")!).pathname).toBe("/super-staff/forbidden");
  });

  // Ported from the old Responder middleware's boundary test: the same gate
  // through Responder's row.
  it("serves an active responder and refuses a citizen", async () => {
    profileRows = [{ ...ACTIVE_STAFF, full_name: "Maria Santos", role: "responder" }];
    const request = () => {
      const r = new NextRequest("http://localhost:3000/responder/pool");
      r.cookies.set(AUTH_COOKIE, JSON.stringify(session(NOW_S + 3600, "live")));
      return r;
    };

    expect((await middleware(request())).headers.get("location")).toBeNull();

    profileRows = [];
    const refused = await middleware(request());
    expect(new URL(refused.headers.get("location")!).pathname).toBe("/responder/forbidden");
  });

  // ADR 0007: the citizen session lives in its own cookie, and the guard reads
  // only the default staff one. A citizen signed in on a shared browser is
  // nobody to a staff-side Portal — signed out, not merely forbidden.
  it.each(["/staff/dashboard", "/responder/pool"])(
    "treats a request to %s carrying only the citizen cookie as signed out",
    async (path) => {
      const request = new NextRequest(`http://localhost:3000${path}`);
      request.cookies.set(citizenAuthCookieName(SUPABASE_URL), JSON.stringify(session(NOW_S + 3600, "live")));

      const response = await middleware(request);

      const location = response.headers.get("location");
      expect(location).not.toBeNull();
      expect(new URL(location!).pathname).toBe(`/${path.split("/")[1]}/login`);
      expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining("/rest/v1/my_staff_profile"), expect.anything());
    },
  );
});
