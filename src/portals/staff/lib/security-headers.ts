// src/portals/staff/lib/security-headers.ts
//
// Response headers for every Staff route (/staff and below), consumed by
// next.config.ts. Scoped to /staff so each Portal keeps its own headers and
// CSP (system ADR 0006 in Central-System-Documents/docs/adr/, the merge
// preserves each Portal's behaviour; not this folder's ADR 0006). Kept here as a plain function
// (rather than inline in the config) so the header set is unit-testable —
// next.config.ts is never imported by Vitest.
//
// Scope notes:
// - CSP script-src carries 'unsafe-inline' because the App Router injects
//   inline bootstrap scripts. The strict alternative is a per-request nonce
//   emitted from the request guard (src/proxy.ts); adopt that if the portal
//   ever renders user-authored HTML (today nothing does — no
//   dangerouslySetInnerHTML).
// - style-src carries 'unsafe-inline' for inline style attributes, which
//   React and Next's own components emit.
// - The document proxy routes (src/portals/staff/lib/http/gated-document.ts)
//   set their own sandboxed CSP on citizen uploads, so /staff/api is kept out
//   of this CSP; see securityHeaderRoutes below.
// - connect-src is the portal's entire egress surface: itself plus the one
//   Supabase project. Anything else the browser tries to call is blocked,
//   which is the point.
// - HSTS only has effect over HTTPS; it is harmless on localhost.

interface SecurityHeaderOptions {
  supabaseUrl: string | undefined;
  dev: boolean;
}

export function securityHeaders({ supabaseUrl, dev }: SecurityHeaderOptions) {
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])];
  const connectSrc = [
    "'self'",
    ...(supabaseUrl ? [supabaseUrl] : []),
    // Dev server HMR and the error overlay talk over websockets.
    ...(dev ? ["ws:", "wss:"] : []),
  ];

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
}

// next.config.ts headers() rules. Next only applies a route handler's header
// when the config has not already set it, so a config CSP on /staff/api would
// win over the sandboxed CSP the document proxy sets on citizen uploads. Route
// handlers own their CSP; they still get every other header.
export function securityHeaderRoutes(options: SecurityHeaderOptions) {
  const headers = securityHeaders(options);
  return [
    // "/staff/(...)" does not match the Portal root itself.
    { source: "/staff", headers },
    { source: "/staff/((?!api/).*)", headers },
    {
      source: "/staff/api/(.*)",
      headers: headers.filter((h) => h.key !== "Content-Security-Policy"),
    },
  ];
}
