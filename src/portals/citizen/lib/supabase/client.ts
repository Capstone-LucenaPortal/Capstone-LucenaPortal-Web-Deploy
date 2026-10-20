import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sessionScopedDocumentCookies } from '@/shared/supabase/client';
import { citizenAuthCookieName } from '@/shared/supabase/session-cookie';

let client: SupabaseClient | null = null;

export class BackendNotConfiguredError extends Error {
  constructor() {
    super('This service is temporarily unavailable. Please try again later.');
    this.name = 'BackendNotConfiguredError';
    // Technical detail for operators/logs only — never shown to citizens. Pages
    // catch this class (and Error generally) and render err.message directly,
    // so the message itself must stay citizen-safe; this is where the real
    // cause goes instead.
    console.error(
      'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing from this ' +
        'production build; refusing to run in mock mode.',
    );
  }
}

export function isBackendConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Before ADR 0007 the session lived in localStorage under supabase-js's
 * default key. Nothing is migrated: the citizen signs in again, and the old
 * token and PKCE verifier are removed so they don't sit there for good.
 * Best-effort — storage can be blocked, and that must not stop the client.
 */
function removeLegacyLocalStorageSession(url: string) {
  const legacyKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  try {
    localStorage.removeItem(legacyKey);
    localStorage.removeItem(`${legacyKey}-code-verifier`);
  } catch {
    // Nothing to clean up that we can reach.
  }
}

/**
 * Returns a memoized Supabase browser client, or null when the env is not
 * configured. Mock mode stays supported for development and the test suite,
 * but a production build without env fails closed instead of silently
 * authenticating everyone.
 *
 * The session lives in the citizen's own session-scoped cookie, not the
 * staff-side one (ADR 0004, 0007), so closing the browser ends it and a
 * citizen and a staff sign-in in one browser never overwrite each other.
 * PKCE is createBrowserClient's default.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    if (process.env.NODE_ENV === 'production') throw new BackendNotConfiguredError();
    return null;
  }
  if (!client) {
    removeLegacyLocalStorageSession(url);
    client = createBrowserClient(url, anonKey, {
      cookies: sessionScopedDocumentCookies,
      cookieOptions: { name: citizenAuthCookieName(url) },
      // @supabase/ssr caches one browser client per page whatever its cookie
      // name; sharing it would hand the citizen the staff client. This module
      // memoizes on its own.
      isSingleton: false,
    });
  }
  return client;
}
