// src/portals/super-staff/lib/security-headers.ts
//
// Response headers for every Super-staff route (/super-staff and below),
// consumed by next.config.ts. Scoped to /super-staff so each Portal keeps its
// own headers and CSP (system ADR 0006 in Central-System-Documents/docs/adr/,
// the merge preserves each Portal's behaviour). Kept here as a plain function (rather than
// inline in the config) so the header set is unit-testable — next.config.ts
// is never imported by Vitest.
//
// Scope notes:
// - CSP script-src carries 'unsafe-inline' because the App Router injects
//   inline bootstrap scripts. The strict alternative is a per-request nonce
//   emitted from the request guard (src/proxy.ts); adopt that if the portal
//   ever renders user-authored HTML (today nothing does — no
//   dangerouslySetInnerHTML).
// - style-src carries 'unsafe-inline' for inline style attributes (e.g. the
//   announcement and event colour swatches' backgroundColor).
// - img-src adds the Supabase project because announcement and site-content
//   images are rendered straight from Storage public URLs, including the
//   preview right after upload. data: and blob: are kept as harmless
//   defaults; nothing here uses them today.
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
  const supabaseSources = supabaseUrl ? [supabaseUrl] : [];
  const connectSrc = [
    "'self'",
    ...supabaseSources,
    // Dev server HMR and the error overlay talk over websockets.
    ...(dev ? ["ws:", "wss:"] : []),
  ];

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${["'self'", "data:", "blob:", ...supabaseSources].join(" ")}`,
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
