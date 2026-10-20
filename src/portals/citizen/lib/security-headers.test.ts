import { describe, it, expect } from 'vitest';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import { buildCsp, securityHeaderRoutes, securityHeaders, supabaseOriginFrom } from './security-headers';

const PROJECT = 'https://zqsqenfoszgcunvpqvvg.supabase.co';

describe('supabaseOriginFrom', () => {
  it('strips trailing slashes so the origin concatenates cleanly', () => {
    expect(supabaseOriginFrom(`${PROJECT}/`)).toBe(PROJECT);
    expect(supabaseOriginFrom(`${PROJECT}///`)).toBe(PROJECT);
  });

  it('is null when no project URL is configured', () => {
    expect(supabaseOriginFrom(undefined)).toBeNull();
    expect(supabaseOriginFrom('')).toBeNull();
  });
});

describe('buildCsp img-src', () => {
  // The regression this pins: storage objects are plain HTTPS GETs governed by
  // img-src, not by connect-src. Without the origin here, every image
  // siteContentUrl() resolves is silently blocked in production while working
  // fine in dev, where no CSP header is emitted at all.
  it('includes the Supabase project origin', () => {
    const directive = directiveOf(buildCsp(PROJECT), 'img-src');
    expect(directive).toContain(PROJECT);
  });

  it('still allows self, data: and blob: for local and preview images', () => {
    const directive = directiveOf(buildCsp(PROJECT), 'img-src');
    expect(directive).toContain("'self'");
    expect(directive).toContain('data:');
    expect(directive).toContain('blob:');
  });

  it('falls back to the supabase.co wildcard when no project is configured', () => {
    expect(directiveOf(buildCsp(undefined), 'img-src')).toContain('https://*.supabase.co');
  });
});

describe('buildCsp other directives', () => {
  it('keeps the websocket origin in connect-src', () => {
    const directive = directiveOf(buildCsp(PROJECT), 'connect-src');
    expect(directive).toContain(PROJECT);
    expect(directive).toContain('wss://zqsqenfoszgcunvpqvvg.supabase.co');
    expect(directive).toContain('https://api.open-meteo.com');
  });

  it('does not grant script-src to any foreign origin', () => {
    const directive = directiveOf(buildCsp(PROJECT), 'script-src');
    expect(directive).not.toContain('supabase');
    expect(directive).not.toContain('facebook');
    expect(directive).not.toContain('google');
  });

  it('keeps the framing and object lockdowns', () => {
    const csp = buildCsp(PROJECT);
    expect(directiveOf(csp, 'frame-ancestors')).toContain("'none'");
    expect(directiveOf(csp, 'object-src')).toContain("'none'");
    expect(directiveOf(csp, 'base-uri')).toContain("'self'");
  });
});

describe('securityHeaders', () => {
  const keys = (dev: boolean) => securityHeaders({ supabaseUrl: PROJECT, dev }).map((h) => h.key);

  it('sends the CSP in production builds', () => {
    const csp = securityHeaders({ supabaseUrl: PROJECT, dev: false }).find(
      (h) => h.key === 'Content-Security-Policy',
    );
    expect(csp?.value).toBe(buildCsp(PROJECT));
  });

  // `next dev` needs eval/websocket allowances for HMR that the policy refuses.
  it('sends no CSP under next dev', () => {
    expect(keys(true)).not.toContain('Content-Security-Policy');
  });

  it('sends the other headers either way', () => {
    for (const dev of [true, false]) {
      expect(keys(dev)).toEqual(
        expect.arrayContaining([
          'X-Content-Type-Options',
          'X-Frame-Options',
          'Referrer-Policy',
          'Permissions-Policy',
          'Strict-Transport-Security',
        ]),
      );
    }
  });
});

/**
 * The Citizen Portal owns the root (ADR 0005), so its headers apply to every
 * path except the staff-side Portals', which send their own (ADR 0006). The
 * sources are compiled the way Next compiles a headers() source at runtime.
 */
describe('securityHeaderRoutes', () => {
  const routes = securityHeaderRoutes({ supabaseUrl: PROJECT, dev: false });
  const matchesCitizen = (path: string) =>
    routes.some(({ source }) => getPathMatch(source, { strict: true, removeUnnamedParams: true })(path) !== false);

  it('covers every citizen address, the manifest and the sitemap', () => {
    for (const path of [
      '/',
      '/about',
      '/announcements',
      '/citizens-charter',
      '/complete-signup',
      '/dashboard',
      '/events-calendar',
      '/explore-lucena',
      '/incident',
      '/lcc',
      '/news',
      '/privacy',
      '/profile',
      '/receipt/LCC-2026-0001',
      '/reset-password',
      '/terms',
      '/verify',
      '/yellow-card',
      '/yellow-card/YC-1/revise',
      '/manifest.webmanifest',
      '/sitemap.xml',
      // A citizen path that merely starts with a prefix's letters.
      '/staffing',
      '/administrator',
      '/responders',
    ]) {
      expect(matchesCitizen(path), path).toBe(true);
    }
  });

  it('leaves the staff-side Portals to their own headers', () => {
    for (const prefix of ['/admin', '/staff', '/super-staff', '/responder']) {
      for (const path of [prefix, `${prefix}/`, `${prefix}/login`, `${prefix}/a/b`]) {
        expect(matchesCitizen(path), path).toBe(false);
      }
    }
  });

  it('carries the Citizen header set', () => {
    for (const { headers } of routes) {
      expect(headers).toEqual(securityHeaders({ supabaseUrl: PROJECT, dev: false }));
    }
  });
});

/** Exact directive lookup — `csp.includes('img-src ...')` would also match the
 * tail of another directive's value. */
function directiveOf(csp: string, name: string): string {
  const found = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `));
  if (!found) throw new Error(`CSP has no ${name} directive: ${csp}`);
  return found;
}
