// src/portals/citizen/lib/security-headers.ts
//
// Response headers for every Citizen route, consumed by next.config.ts. Kept
// here as plain functions so the header set is unit-testable — next.config.ts
// is never imported by Vitest.

// Relative, not @/: next.config.ts loads this file outside the app's aliases.
import { PORTAL_PREFIX } from '../../../shared/guard/portals';

// Origins the app actually uses (audit 2026-08-18):
//  - Supabase project (XHR/websocket/storage)   → connect-src
//  - api.open-meteo.com (WeatherWidget)         → connect-src
//  - www.google.com (Maps embed)                → frame-src
//  - www.facebook.com (page-plugin IFRAME feed) → frame-src ONLY
// The social network's JS SDK stays removed: the homepage feed is an iframe
// sandboxed on the provider's origin, so script-src grants it nothing.
// 'unsafe-inline' in script-src is required by App Router inline bootstrap
// scripts until a nonce-based CSP (middleware) is introduced; foreign-origin
// script injection is still blocked.

// Pin the Supabase directives to this deployment's project when env is
// present; the wildcard fallback only applies to env-less (mock/dev) builds,
// where the CSP header is not emitted anyway.
export function supabaseOriginFrom(url: string | undefined): string | null {
  const trimmed = url?.replace(/\/+$/, '');
  return trimmed ? trimmed : null;
}

/**
 * Builds the policy. Exported so `security-headers.test.ts` can assert the
 * directives directly — the previous inline constant could only be checked by
 * reading it, and the img-src gap below survived precisely because the manual
 * CSP-violation sweep on the security ops checklist was never run.
 */
export function buildCsp(supabaseUrl: string | undefined): string {
  const origin = supabaseOriginFrom(supabaseUrl);
  const connect = origin
    ? `${origin} ${origin.replace(/^https:/, 'wss:')}`
    : 'https://*.supabase.co wss://*.supabase.co';

  // Storage objects are served from the project origin over plain HTTPS GETs,
  // so they are governed by img-src, NOT by the connect-src above. Without this
  // every image `siteContentUrl()` resolves — event heroes, announcement
  // images, anything the LGU uploads to the `site-content` bucket — was
  // silently blocked in production while working fine in dev, where no CSP
  // header is emitted at all.
  const img = origin
    ? `'self' data: blob: ${origin}`
    : "'self' data: blob: https://*.supabase.co";

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img}`,
    "font-src 'self'",
    `connect-src 'self' ${connect} https://api.open-meteo.com`,
    'frame-src https://www.google.com https://www.facebook.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

interface SecurityHeaderOptions {
  supabaseUrl: string | undefined;
  dev: boolean;
}

export function securityHeaders({ supabaseUrl, dev }: SecurityHeaderOptions) {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    // CSP only in production builds: `next dev` needs eval/websocket allowances
    // for HMR that we refuse to bake into the policy.
    ...(dev ? [] : [{ key: 'Content-Security-Policy', value: buildCsp(supabaseUrl) }]),
  ];
}

/**
 * next.config.ts headers() rules. The Citizen Portal owns the root (ADR 0005),
 * so its headers — and its CSP, with the weather, map and social-feed origins —
 * go to every path except the staff-side Portals' prefixes, which send their
 * own (ADR 0006). `/staffing` is still a citizen path: a prefix only counts as
 * a whole segment.
 */
export function securityHeaderRoutes(options: SecurityHeaderOptions) {
  const staffSide = Object.values(PORTAL_PREFIX)
    .map((prefix) => prefix.slice(1))
    .join('|');
  return [{ source: `/((?!(?:${staffSide})(?:/|$)).*)`, headers: securityHeaders(options) }];
}
