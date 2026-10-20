import { describe, expect, it } from "vitest";
import { securityHeaders } from "@/portals/responder/lib/security-headers";

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

  it("allows images from self, data/blob previews, and Supabase Storage only", () => {
    const csp = header(prod, "Content-Security-Policy");
    expect(csp).toContain(`img-src 'self' data: blob: ${SUPABASE_URL}`);
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
    expect(csp).toContain("img-src 'self' data: blob:;");
    expect(csp).not.toContain("undefined");
  });
});
