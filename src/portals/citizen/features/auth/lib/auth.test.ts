import { describe, it, expect, vi } from 'vitest';

// The vitest environment for this project is 'node', which has no `localStorage` global.
// authService's mock-mode helpers (mockGet/mockSet/logout) read/write localStorage
// directly, so a minimal in-memory polyfill is installed here to let those code paths
// run under test (pattern copied from the top of services/bookingService.test.ts).
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
}
// authService's mock helpers also branch on `typeof window` for SSR-safety. Stub it so
// the browser-path code under test actually executes instead of short-circuiting.
if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
}

import {
  mapSignupToProfileParams,
  translateCompleteProfileError,
  MIN_ACCOUNT_AGE_YEARS, AuthError, authService,
  buildSignupMetadata, tryBuildProfileParamsFromMetadata,
  translateAuthError, RESET_LINK_UNUSABLE_MESSAGE,
} from '@/portals/citizen/features/auth/lib/auth';
import * as supabaseClientModule from '@/portals/citizen/lib/supabase/client';
import type { SignupData, CitizenProfileFields } from '@/portals/citizen/features/auth/types';

const base: SignupData = {
  fullName: 'Juan Rizal Dela Cruz',
  email: 'juan@example.com',
  password: 'Password123!',
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  middleName: 'Rizal',
  suffix: '',
  birthDate: '1990-01-15',
  genderCode: 'male',
  mobile: '09123456789',
  barangayCode: 'bocohan',
  street: 'Rizal Street',
  houseNo: '123',
  occupation: 'Software Engineer',
  worksInLucena: true,
  agreedToTerms: true,
};

describe('mapSignupToProfileParams', () => {
  it('maps required fields to p_* params', () => {
    const p = mapSignupToProfileParams(base);
    expect(p.p_first_name).toBe('Juan');
    expect(p.p_last_name).toBe('Dela Cruz');
    expect(p.p_birth_date).toBe('1990-01-15');
    expect(p.p_gender_code).toBe('male');
    expect(p.p_barangay_code).toBe('bocohan');
    expect(p.p_works_in_lucena).toBe(true);
  });

  it('collapses empty optional strings to null', () => {
    const p = mapSignupToProfileParams({ ...base, suffix: '', middleName: '   ' });
    expect(p.p_suffix).toBeNull();
    expect(p.p_middle_name).toBeNull();
  });

  it('throws AuthError when a required field is missing', () => {
    expect(() => mapSignupToProfileParams({ ...base, firstName: '' })).toThrow(AuthError);
    expect(() => mapSignupToProfileParams({ ...base, genderCode: '' })).toThrow(AuthError);
  });

  it('never emits p_email or p_citizen_id (identity comes from the JWT)', () => {
    const p = mapSignupToProfileParams(base);
    expect(p).not.toHaveProperty('p_email');
    expect(p).not.toHaveProperty('p_citizen_id');
  });

  it('sends p_terms_accepted: true when the checkbox was agreed to', () => {
    const p = mapSignupToProfileParams(base);
    expect(p.p_terms_accepted).toBe(true);
  });

  it('throws AuthError when terms were not agreed to (false or missing)', () => {
    expect(() => mapSignupToProfileParams({ ...base, agreedToTerms: false })).toThrow(AuthError);
    expect(() =>
      mapSignupToProfileParams({ ...base, agreedToTerms: undefined as unknown as boolean }),
    ).toThrow(AuthError);
  });

  it('throws AuthError when a name exceeds LIMITS.name', () => {
    expect(() => mapSignupToProfileParams({ ...base, firstName: 'a'.repeat(81) })).toThrow(AuthError);
    expect(() => mapSignupToProfileParams({ ...base, lastName: 'a'.repeat(81) })).toThrow(AuthError);
  });

  it('throws AuthError for a future birth date', () => {
    expect(() => mapSignupToProfileParams({ ...base, birthDate: '2999-01-01' })).toThrow(AuthError);
  });

  it('throws AuthError for a malformed mobile number when one is given', () => {
    expect(() => mapSignupToProfileParams({ ...base, mobile: '12345' })).toThrow(AuthError);
  });

  // Mobile is REQUIRED, not optional. Responders read `citizens.mobile` and
  // put a `tel:` "Call {name}" button in front of the person driving to the
  // incident; the signup modal has always marked it required with a visual `*`.
  // Accepting a blank one here was a mismatch between the mark and the rule.
  it('rejects a blank mobile', () => {
    expect(() => mapSignupToProfileParams({ ...base, mobile: '' })).toThrow(/Mobile number is required/i);
    expect(() => mapSignupToProfileParams({ ...base, mobile: '   ' })).toThrow(/Mobile number is required/i);
  });

  it('rejects a malformed mobile', () => {
    expect(() => mapSignupToProfileParams({ ...base, mobile: '12345' })).toThrow();
  });

  it('rejects an applicant under the minimum account age', () => {
    const tooYoung = new Date();
    tooYoung.setFullYear(tooYoung.getFullYear() - (MIN_ACCOUNT_AGE_YEARS - 1));
    const iso = tooYoung.toISOString().slice(0, 10);
    expect(() => mapSignupToProfileParams({ ...base, birthDate: iso })).toThrow(
      new RegExp(String(MIN_ACCOUNT_AGE_YEARS)),
    );
  });

  it('accepts a bare CitizenProfileFields object without email/password/fullName', () => {
    const minimal: CitizenProfileFields = {
      firstName: 'Maria', lastName: 'Santos',
      birthDate: '1995-05-20', genderCode: 'female',
      mobile: '09171234567',
      barangayCode: 'cotta', agreedToTerms: true,
    };
    const p = mapSignupToProfileParams(minimal);
    expect(p.p_first_name).toBe('Maria');
    expect(p.p_barangay_code).toBe('cotta');
    expect(p.p_mobile).toBe('09171234567');
  });
});

describe('translateCompleteProfileError', () => {
  // 22023 is the terms-consent guard. It used to fall through to the generic
  // branch, so a citizen who missed the checkbox read "Something went wrong."
  it('names the terms checkbox on a 22023 consent refusal', () => {
    expect(translateCompleteProfileError('22023', 'p_terms_accepted must be true')).toBe(
      'Please accept the Terms and Conditions to continue.',
    );
  });

  it('names the barangay on a 23503 foreign-key refusal', () => {
    expect(translateCompleteProfileError('23503', 'violates foreign key')).toMatch(/barangay/i);
  });

  it('sends a staff account to its own portal rather than a generic failure', () => {
    const msg = translateCompleteProfileError(undefined, 'this is already a staff account');
    expect(msg).toMatch(/staff account/i);
    expect(msg).toMatch(/portal/i);
  });

  it('never leaks raw Postgres text for an unrecognised failure', () => {
    const msg = translateCompleteProfileError('XX999', 'null value in column "barangay_code"');
    expect(msg).not.toMatch(/null value|column/i);
  });
});

describe('buildSignupMetadata / tryBuildProfileParamsFromMetadata round-trip', () => {
  it('round-trips: metadata written at signup can be read back into the same RPC params', () => {
    const meta = buildSignupMetadata(base);
    const params = tryBuildProfileParamsFromMetadata(meta);
    expect(params).not.toBeNull();
    expect(params!.p_first_name).toBe('Juan');
    expect(params!.p_barangay_code).toBe('bocohan');
    expect(params!.p_terms_accepted).toBe(true);
  });

  it('returns null when a required field is missing from metadata', () => {
    expect(tryBuildProfileParamsFromMetadata({ full_name: 'Juan Dela Cruz' })).toBeNull();
  });

  it('returns null for empty, null, or undefined metadata', () => {
    expect(tryBuildProfileParamsFromMetadata({})).toBeNull();
    expect(tryBuildProfileParamsFromMetadata(null)).toBeNull();
    expect(tryBuildProfileParamsFromMetadata(undefined)).toBeNull();
  });
});

describe('authService mock mode (no backend)', () => {
  it('signup returns a User and login round-trips', async () => {
    const u = await authService.signup(base);
    expect(u.email).toBe('juan@example.com');
    expect(u.name).toBe('Juan Rizal Dela Cruz');
    const u2 = await authService.login('juan@example.com', 'whatever');
    expect(u2.email).toBe('juan@example.com');
  });
});

describe('ensureCitizenProfile / completeProfile / getCurrentUserMetadata in mock mode (no backend)', () => {
  it('ensureCitizenProfile resolves "exists" when no backend is configured', async () => {
    expect(await authService.ensureCitizenProfile()).toBe('exists');
  });

  it('completeProfile resolves without throwing when no backend is configured', async () => {
    await expect(
      authService.completeProfile({
        firstName: 'Maria', lastName: 'Santos',
        birthDate: '1995-05-20', genderCode: 'female',
        barangayCode: 'cotta', agreedToTerms: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('getCurrentUserMetadata resolves null when no backend is configured', async () => {
    expect(await authService.getCurrentUserMetadata()).toBeNull();
  });
});

describe('translateAuthError', () => {
  it('collapses login failures into one message (no enumeration)', () => {
    expect(translateAuthError('Invalid login credentials', 'login')).toBe(
      'Incorrect email or password.',
    );
    expect(translateAuthError('Email not confirmed', 'login')).toBe(
      'Incorrect email or password.',
    );
  });
  it('passes through rate-limit guidance', () => {
    expect(translateAuthError('For security purposes, you can only request this after 60 seconds.', 'login')).toMatch(/wait/i);
  });
  it('maps signup duplicate to sign-in guidance without echoing internals', () => {
    const msg = translateAuthError('User already registered', 'signup');
    expect(msg).toMatch(/already/i);
    expect(msg).not.toMatch(/postgres|constraint|rpc/i);
  });
  it('falls back to a generic message for unknown raw errors', () => {
    expect(translateAuthError('duplicate key value violates unique constraint "citizens_pkey"', 'generic')).toBe(
      'Something went wrong. Please try again later.',
    );
  });
  it('maps network failures to connectivity guidance instead of "incorrect password" in login context', () => {
    expect(translateAuthError('Failed to fetch', 'login')).toBe(
      'Cannot reach the server. Please check your connection and try again.',
    );
    expect(translateAuthError('NetworkError when attempting to fetch resource', 'login')).toBe(
      'Cannot reach the server. Please check your connection and try again.',
    );
    expect(translateAuthError('fetch failed', 'login')).toBe(
      'Cannot reach the server. Please check your connection and try again.',
    );
    expect(translateAuthError('Load failed', 'login')).toBe(
      'Cannot reach the server. Please check your connection and try again.',
    );
  });
  it('maps network failures to connectivity guidance in signup/generic contexts too', () => {
    expect(translateAuthError('Failed to fetch', 'signup')).toBe(
      'Cannot reach the server. Please check your connection and try again.',
    );
    expect(translateAuthError('Failed to fetch', 'generic')).toBe(
      'Cannot reach the server. Please check your connection and try again.',
    );
  });
});

describe('changePassword (mock mode)', () => {
  it('refuses in mock mode instead of pretending to succeed', async () => {
    await expect(authService.changePassword('OldPass123', 'NewPass456')).rejects.toThrow(AuthError);
  });
  it('rejects a policy-violating new password before any network call', async () => {
    await expect(authService.changePassword('OldPass123', 'short')).rejects.toThrow(/8 characters/);
  });
});

describe('logout hygiene (mock mode)', () => {
  it('clears both the user and requests keys', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'USER-1', email: 'a@b.c', name: 'a' }));
    localStorage.setItem('requests', '[]');
    await authService.logout();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('requests')).toBeNull();
  });
});

describe('getCurrentUser storage corruption (mock mode)', () => {
  it('survives a corrupted user blob', async () => {
    localStorage.setItem('user', '{not json');
    await expect(authService.getCurrentUser()).resolves.toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});

describe('logout signOut failure (client mode)', () => {
  it('throws AuthError but still clears local storage artifacts', async () => {
    const fakeClient = {
      auth: {
        signOut: async () => ({ error: { message: 'network error' } }),
      },
    } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>;
    const spy = vi
      .spyOn(supabaseClientModule, 'getSupabaseClient')
      .mockReturnValue(fakeClient);
    localStorage.setItem('user', JSON.stringify({ id: 'USER-1', email: 'a@b.c', name: 'a' }));
    localStorage.setItem('requests', '[]');
    try {
      await expect(authService.logout()).rejects.toThrow(AuthError);
      expect(localStorage.getItem('user')).toBeNull();
      expect(localStorage.getItem('requests')).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('onAuthChange event pass-through (client mode)', () => {
  it('forwards the raw Supabase auth event name to the callback', () => {
    let capturedListener: ((event: string, session: unknown) => void) | undefined;
    const fakeClient = {
      auth: {
        onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
          capturedListener = listener;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
    } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>;
    const spy = vi
      .spyOn(supabaseClientModule, 'getSupabaseClient')
      .mockReturnValue(fakeClient);
    try {
      const calls: Array<[unknown, string | undefined]> = [];
      authService.onAuthChange((u, event) => calls.push([u, event]));
      capturedListener!('PASSWORD_RECOVERY', { user: { id: 'USER-1', email: 'a@b.c' } });
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toBe('PASSWORD_RECOVERY');
      expect(calls[0][0]).toMatchObject({ id: 'USER-1' });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('updatePassword without a recovery session (client mode)', () => {
  // The regression this pins: a reset link opened in a browser that doesn't
  // hold the PKCE code verifier yields no session, so supabase-js rejects
  // updateUser locally with "Auth session missing!" — which fell through to
  // "Something went wrong. Please try again later." and gave the citizen
  // nothing to act on.
  it('tells the citizen the link is unusable and to request a new one', async () => {
    const fakeClient = {
      auth: {
        updateUser: async () => ({
          data: { user: null },
          error: { name: 'AuthSessionMissingError', message: 'Auth session missing!' },
        }),
      },
    } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>;
    const spy = vi
      .spyOn(supabaseClientModule, 'getSupabaseClient')
      .mockReturnValue(fakeClient);
    try {
      await expect(authService.updatePassword('Newpass123')).rejects.toThrow(
        RESET_LINK_UNUSABLE_MESSAGE,
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('ensureCitizenProfile read failure (client mode)', () => {
  // The regression this pins: the my_profile read can 401 while a freshly
  // exchanged session is still being attached. The error was discarded, the
  // null row read as "no citizens row", and an existing citizen mid-reset was
  // routed to /complete-signup. A failed read is transient, not "incomplete".
  it('rejects instead of reporting an existing citizen as incomplete', async () => {
    const getUser = vi.fn();
    const fakeClient = {
      from: () => ({
        select: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { code: '42501', message: 'permission denied for view my_profile' },
          }),
        }),
      }),
      auth: { getUser },
    } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>;
    const spy = vi
      .spyOn(supabaseClientModule, 'getSupabaseClient')
      .mockReturnValue(fakeClient);
    try {
      await expect(authService.ensureCitizenProfile()).rejects.toThrow();
      expect(getUser).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
