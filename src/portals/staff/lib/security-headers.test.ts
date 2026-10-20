import { describe, expect, it } from "vitest";
import { securityHeaderRoutes, securityHeaders } from "@/portals/staff/lib/security-headers";

const SUPABASE_URL = "https://zqsqenfoszgcunvpqvvg.supabase.co";

function header(headers: { key: string; value: string }[], key: string): string | undefined {
  return headers.find((h) => h.key === key)?.value;
}

describe("securityHeaders", () => {
  const prod = securityHeaders({ supabaseUrl: SUPABASE_URL, dev: false });

  it("sets HSTS with a long max-age and includeSubDomains", () => {
    const hsts = header(prod, "Strict-Transport-Security");
    expect(hsts).toMatch(/max-age=\d{7,}/);
    expect(hsts).toContain("includeSubDomains");
  });

  it("denies framing via both X-Frame-Options and CSP frame-ancestors", () => {
    expect(header(prod, "X-Frame-Options")).toBe("DENY");
    expect(header(prod, "Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("sets nosniff, a referrer policy, and a restrictive permissions policy", () => {
    expect(header(prod, "X-Content-Type-Options")).toBe("nosniff");
    expect(header(prod, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    const permissions = header(prod, "Permissions-Policy");
    expect(permissions).toContain("camera=()");
    expect(permissions).toContain("microphone=()");
    expect(permissions).toContain("geolocation=()");
  });

  it("locks CSP default-src to self and allows connections only to self and Supabase", () => {
    const csp = header(prod, "Content-Security-Policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(`connect-src 'self' ${SUPABASE_URL}`);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("does not allow unsafe-eval in production CSP", () => {
    expect(header(prod, "Content-Security-Policy")).not.toContain("unsafe-eval");
  });

  it("allows unsafe-eval and websockets in dev, for the dev overlay and HMR", () => {
    const dev = securityHeaders({ supabaseUrl: SUPABASE_URL, dev: true });
    const csp = header(dev, "Content-Security-Policy");
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
  });

  it("still emits a self-only connect-src when the Supabase URL is not configured", () => {
    const headers = securityHeaders({ supabaseUrl: undefined, dev: false });
    const csp = header(headers, "Content-Security-Policy");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("undefined");
  });
});

describe("securityHeaderRoutes", () => {
  const routes = securityHeaderRoutes({ supabaseUrl: SUPABASE_URL, dev: false });

  function route(source: string) {
    const match = routes.find((r) => r.source === source);
    if (!match) throw new Error(`no route for ${source}`);
    return match.headers;
  }

  it("gives pages the full header set, CSP included", () => {
    expect(route("/staff")).toEqual(securityHeaders({ supabaseUrl: SUPABASE_URL, dev: false }));
    expect(route("/staff/((?!api/).*)")).toEqual(securityHeaders({ supabaseUrl: SUPABASE_URL, dev: false }));
  });

  // Next only applies a route handler's header when the config has not already
  // set it, so a config CSP here would replace the sandboxed one that the
  // document proxy puts on citizen uploads.
  it("leaves CSP to route handlers under /api but still sends everything else", () => {
    const api = route("/staff/api/(.*)");
    expect(header(api, "Content-Security-Policy")).toBeUndefined();
    expect(header(api, "X-Frame-Options")).toBe("DENY");
    expect(header(api, "X-Content-Type-Options")).toBe("nosniff");
    expect(header(api, "Strict-Transport-Security")).toContain("includeSubDomains");
  });
});
