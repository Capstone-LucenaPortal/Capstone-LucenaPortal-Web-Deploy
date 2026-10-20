// src/portals/responder/lib/security-headers.ts
//
// Response headers for every Responder route (/responder and below),
// consumed by next.config.ts. Scoped to /responder so each Portal keeps its
// own headers and CSP (workspace ADR 0006). Kept here as a plain function
// (rather than inline in the config) so the header set is unit-testable —
// next.config.ts is never imported by Vitest.
//
// Scope notes:
// - CSP script-src carries 'unsafe-inline' because the App Router injects
//   inline bootstrap scripts. The strict alternative is a per-request nonce
//   emitted from the request guard (src/proxy.ts); adopt that if the portal
//   ever renders user-authored HTML (today nothing does — no
//   dangerouslySetInnerHTML).
// - style-src carries 'unsafe-inline' for inline style attributes (e.g. the
//   profile avatar preview, the pool card and the ticket clock).
// - img-src adds the Supabase project because citizen and after photos render
//   as plain <img> from Storage signed URLs (see photo-grid.tsx); blob: covers
//   the profile photo preview before upload. (Copied from the Admin portal,
//   which shows no Storage images and so omits this.)
// - connect-src is the portal's entire egress surface: itself plus the one
//   Supabase project. Anything else the browser tries to call is blocked,
//   which is the point.
// - Permissions-Policy camera=() does not affect the after-photo uploader: its
//   capture="environment" file input hands off to the OS camera, not
//   getUserMedia. The ticket's map link is a navigation, which CSP does not
//   govern.
// - HSTS only has effect over HTTPS; it is harmless on localhost.

interface SecurityHeaderOptions {
  supabaseUrl: string | undefined;
  dev: boolean;
}

export function securityHeaders({ supabaseUrl, dev }: SecurityHeaderOptions) {
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])];
  const supabase = supabaseUrl ? [supabaseUrl] : [];
  const connectSrc = [
    "'self'",
    ...supabase,
    // Dev server HMR and the error overlay talk over websockets.
    ...(dev ? ["ws:", "wss:"] : []),
  ];

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${["'self'", "data:", "blob:", ...supabase].join(" ")}`,
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
