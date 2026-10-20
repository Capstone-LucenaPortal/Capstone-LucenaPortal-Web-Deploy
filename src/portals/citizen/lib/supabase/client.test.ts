import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CookieOptions } from '@supabase/ssr';
import { getSupabaseClient } from '@/portals/citizen/lib/supabase/client';

type CookieToSet = { name: string; value: string; options: CookieOptions };
type Adapter = { getAll(): { name: string; value: string }[]; setAll(cookies: CookieToSet[]): void };
type BrowserClientOptions = { cookies: Adapter; cookieOptions?: { name?: string } };

let built: { url: string; key: string; options: BrowserClientOptions } | null = null;

vi.mock('@supabase/ssr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/ssr')>()),
  createBrowserClient: (url: string, key: string, options: BrowserClientOptions) => {
    built = { url, key, options };
    return {};
  },
}));

describe('getSupabaseClient', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('returns null when env vars are absent', () => {
    expect(getSupabaseClient()).toBeNull();
  });
});

// getSupabaseClient memoizes; re-import fresh per test.
async function freshModule() {
  vi.resetModules();
  return import('@/portals/citizen/lib/supabase/client');
}

describe('supabaseClient env gating', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  it('returns null in development when env is unset (mock mode)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const mod = await freshModule();
    expect(mod.getSupabaseClient()).toBeNull();
    expect(mod.isBackendConfigured()).toBe(false);
  });

  it('throws BackendNotConfiguredError in production when env is unset', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const mod = await freshModule();
    expect(() => mod.getSupabaseClient()).toThrow(mod.BackendNotConfiguredError);
  });

  it('returns a client when env is set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_test');
    const mod = await freshModule();
    expect(mod.getSupabaseClient()).not.toBeNull();
    expect(mod.isBackendConfigured()).toBe(true);
  });
});

// ADR 0007: the citizen session lives in its own session-scoped cookie, not
// in localStorage, so closing the browser on a shared machine ends it.
describe('citizen session cookie', () => {
  const SUPABASE_MAX_AGE = 400 * 24 * 60 * 60;
  const CITIZEN_COOKIE = 'sb-example-citizen-auth-token';
  let writes: string[];

  beforeEach(() => {
    built = null;
    writes = [];
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_test');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => `sb-example-auth-token=staff; ${CITIZEN_COOKIE}=citizen`,
      set: (value: string) => writes.push(value),
    });
    localStorage.clear();
    return () => {
      Reflect.deleteProperty(document, 'cookie');
      vi.restoreAllMocks();
    };
  });

  async function build() {
    const mod = await freshModule();
    mod.getSupabaseClient();
    return built!;
  }

  it('stores the session under the citizen cookie name, never the default one', async () => {
    const { options } = await build();
    expect(options.cookieOptions?.name).toBe(CITIZEN_COOKIE);
  });

  // @supabase/ssr caches ONE browser client per page, whatever its cookie
  // name. Sharing it would hand the citizen the staff client (or the reverse).
  it("opts out of @supabase/ssr's shared singleton", async () => {
    const { options } = await build();
    expect((options as { isSingleton?: boolean }).isSingleton).toBe(false);
  });

  it('writes the session cookie with no Max-Age or Expires', async () => {
    const { options } = await build();
    options.cookies.setAll([
      { name: CITIZEN_COOKIE, value: 'fresh', options: { path: '/', sameSite: 'lax', maxAge: SUPABASE_MAX_AGE } },
    ]);

    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain(`${CITIZEN_COOKIE}=fresh`);
    expect(writes[0]).not.toMatch(/Max-Age|Expires/i);
  });

  it('still deletes the cookie on sign-out', async () => {
    const { options } = await build();
    options.cookies.setAll([{ name: CITIZEN_COOKIE, value: '', options: { path: '/', maxAge: 0 } }]);

    expect(writes[0]).toMatch(/Max-Age=0/);
  });

  it('reads cookies from the document', async () => {
    const { options } = await build();
    expect(options.cookies.getAll()).toContainEqual({ name: CITIZEN_COOKIE, value: 'citizen' });
  });

  // Existing citizens are signed out once and sign in again; nothing is
  // migrated. Left in place, the old token would sit in localStorage for good.
  it('removes the old localStorage session and code verifier', async () => {
    localStorage.setItem('sb-example-auth-token', '{"access_token":"old"}');
    localStorage.setItem('sb-example-auth-token-code-verifier', 'old-verifier');
    localStorage.setItem('lucena_last_activity', '123');

    await build();

    expect(localStorage.getItem('sb-example-auth-token')).toBeNull();
    expect(localStorage.getItem('sb-example-auth-token-code-verifier')).toBeNull();
    expect(localStorage.getItem('lucena_last_activity')).toBe('123');
  });

  it('builds the client even when storage cannot be accessed', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    const { options } = await build();
    expect(options.cookieOptions?.name).toBe(CITIZEN_COOKIE);
  });
});
