import { getSupabaseClient } from '@/portals/citizen/lib/supabase/client';
import { validatePassword } from '@/portals/citizen/features/auth/lib/password-policy';
import { LIMITS, fieldTooLong, birthDateError, phMobileError } from '@/portals/citizen/lib/validation';
import type { User, SignupData, CitizenProfileFields } from '@/portals/citizen/features/auth/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const USER_KEY = 'user';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Raw Supabase auth error text → citizen-facing copy. Login failures are
 * deliberately indistinguishable (wrong email vs wrong password vs unconfirmed)
 * to prevent account enumeration from the login form. */
export function translateAuthError(message: string, context: 'login' | 'signup' | 'generic'): string {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('too many') || m.includes('after 60 seconds') || m.includes('security purposes')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (/fetch|network|load failed/i.test(message)) {
    return 'Cannot reach the server. Please check your connection and try again.';
  }
  if (context === 'login') return 'Incorrect email or password.';
  if (context === 'signup') {
    if (m.includes('already registered') || m.includes('already exists')) {
      // Known tradeoff: signup inherently confirms existence. Mitigated by the
      // auth rate limits + CAPTCHA required in the ops checklist (Task 16 / X-3).
      return 'An account with this email already exists. Please sign in instead.';
    }
    if (m.includes('password')) return 'That password was not accepted. ' + 'Please choose a different one.';
    if (m.includes('invalid') && m.includes('email')) return 'Please enter a valid email address.';
  }
  return 'Something went wrong. Please try again later.';
}

/**
 * A reset link that yields no recovery session. The app uses the PKCE flow, so
 * the link only works in the browser that requested it — that browser holds
 * the code verifier. Opened anywhere else (another browser or profile, a phone,
 * a mail app's built-in browser), or after it expires, the link is silently
 * ignored and there is no session to set a password with.
 */
export const RESET_LINK_UNUSABLE_MESSAGE =
  'This password reset link has expired or was opened in a different browser from the one ' +
  'you requested it in. Please request a new link and open it in this same browser.';

/** Pure: SignupData → create_citizen_profile RPC params. Email comes from the JWT, not here. */
/**
 * Minimum age to hold a citizen portal account.
 *
 * POLICY — NOT AN ENGINEERING CONSTANT. 18 is used here because it matches the
 * gate the Yellow Card application already enforces, and because under RA 10173
 * a minor cannot give valid consent to the processing this account performs.
 * It is deliberately a single named constant rather than an inline literal so
 * the LGU can ratify or change it in one line. This is listed as an open item
 * in the DB repo's citizen-surface follow-ups; until it is ratified, treat the
 * value as provisional — but note that leaving NO gate (the previous state,
 * where `birthDateError` was called with no `minAgeYears`) let a minor create a
 * full account, which is not a neutral default.
 */
export const MIN_ACCOUNT_AGE_YEARS = 18;

/**
 * Pure: a `create_citizen_profile` errcode -> a sentence written for a citizen.
 *
 * `22023` is the terms-consent guard (`p_terms_accepted` not explicitly true).
 * It used to fall through to the generic branch, so a citizen who missed the
 * checkbox was told "Something went wrong" and had nothing to act on.
 */
export function translateCompleteProfileError(
  code: string | undefined,
  message: string,
): string {
  if (code === '22023') {
    return 'Please accept the Terms and Conditions to continue.';
  }
  if (code === '23503') {
    return 'That barangay is no longer available. Please choose another.';
  }
  if (message.toLowerCase().includes('staff account')) {
    return 'This account is registered as a staff account. Please sign in at your own portal instead.';
  }
  return translateAuthError(message, 'generic');
}

export function mapSignupToProfileParams(data: CitizenProfileFields) {
  if (!data.firstName?.trim()) throw new AuthError('First name is required.');
  if (!data.lastName?.trim()) throw new AuthError('Last name is required.');
  if (!data.birthDate) throw new AuthError('Birth date is required.');
  if (!data.genderCode) throw new AuthError('Sex is required.');
  // A fast client-side check, mirroring the checkbox already gating the form.
  // The real, unbypassable enforcement is server-side: create_citizen_profile
  // rejects (22023) unless p_terms_accepted is explicitly true.
  if (data.agreedToTerms !== true) {
    throw new AuthError('You must agree to the Terms and Conditions and Privacy Policy.');
  }
  // Required, not optional. Responders read `citizens.mobile` and put a `tel:`
  // "Call {name}" button in front of the person driving to the incident, so a
  // profile with no number silently degrades their arrival. The signup modal
  // has always marked it required with a visual `*`; this closes the mismatch
  // between that mark and what was actually enforced.
  if (!data.mobile?.trim()) throw new AuthError('Mobile number is required.');
  const problem =
    fieldTooLong('First name', data.firstName.trim(), LIMITS.name) ??
    fieldTooLong('Last name', data.lastName.trim(), LIMITS.name) ??
    birthDateError(data.birthDate, { minAgeYears: MIN_ACCOUNT_AGE_YEARS }) ??
    phMobileError(data.mobile.trim());
  if (problem) throw new AuthError(problem);
  const orNull = (v?: string) => (v && v.trim() ? v.trim() : null);
  return {
    p_first_name: data.firstName.trim(),
    p_last_name: data.lastName.trim(),
    p_birth_date: data.birthDate,
    p_gender_code: data.genderCode,
    p_middle_name: orNull(data.middleName),
    p_suffix: orNull(data.suffix),
    p_mobile: orNull(data.mobile),
    p_barangay_code: orNull(data.barangayCode),
    p_street: orNull(data.street),
    p_house_no: orNull(data.houseNo),
    p_occupation: orNull(data.occupation),
    p_works_in_lucena: typeof data.worksInLucena === 'boolean' ? data.worksInLucena : null,
    p_terms_accepted: data.agreedToTerms === true,
  };
}

/** Pure: everything signup() stashes in Supabase's own user_metadata, since no
 * session/RPC access exists yet when email confirmation is pending. Read back
 * by tryBuildProfileParamsFromMetadata using the exact same keys. */
export function buildSignupMetadata(data: SignupData): Record<string, unknown> {
  return {
    full_name: data.fullName,
    firstName: data.firstName,
    lastName: data.lastName,
    middleName: data.middleName ?? null,
    suffix: data.suffix ?? null,
    birthDate: data.birthDate,
    genderCode: data.genderCode,
    mobile: data.mobile ?? null,
    barangayCode: data.barangayCode,
    street: data.street ?? null,
    houseNo: data.houseNo ?? null,
    occupation: data.occupation ?? null,
    worksInLucena: typeof data.worksInLucena === 'boolean' ? data.worksInLucena : null,
    agreedToTerms: data.agreedToTerms,
  };
}

/** Pure: reconstruct create_citizen_profile params from stashed signup metadata.
 * Returns null if a required field is missing/invalid — the caller's signal to
 * fall back to a manual completion form instead of guessing. */
export function tryBuildProfileParamsFromMetadata(
  meta: Record<string, unknown> | null | undefined,
): ReturnType<typeof mapSignupToProfileParams> | null {
  if (!meta) return null;
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
  const fields: CitizenProfileFields = {
    firstName: str(meta.firstName) ?? '',
    lastName: str(meta.lastName) ?? '',
    middleName: str(meta.middleName),
    suffix: str(meta.suffix),
    birthDate: str(meta.birthDate) ?? '',
    genderCode: str(meta.genderCode) ?? '',
    mobile: str(meta.mobile),
    barangayCode: str(meta.barangayCode) ?? '',
    street: str(meta.street),
    houseNo: str(meta.houseNo),
    occupation: str(meta.occupation),
    worksInLucena: bool(meta.worksInLucena),
    agreedToTerms: bool(meta.agreedToTerms) ?? false,
  };
  try {
    return mapSignupToProfileParams(fields);
  } catch {
    return null;
  }
}

interface SupabaseAuthUser {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

function toUser(u: SupabaseAuthUser): User {
  const meta = u.user_metadata ?? {};
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : '';
  return {
    id: u.id,
    email: u.email ?? '',
    name: fullName || (u.email ? u.email.split('@')[0] : ''),
  };
}

// ── mock helpers (used only when no backend is configured) ────────────────
function mockGet(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}
function mockSet(user: User | null): void {
  if (typeof window === 'undefined') return;
  if (user === null) localStorage.removeItem(USER_KEY);
  else localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Once the citizens row exists, the signup PII stash in user_metadata has
 * served its purpose. Null it out so it stops riding in JWT claims and
 * localStorage. full_name stays (display name). Best-effort: a failure here
 * must not break auth. */
async function scrubSignupMetadata(client: SupabaseClient): Promise<void> {
  try {
    const { data } = await client.auth.getUser();
    const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
    if (!meta || meta.birthDate == null) return; // already scrubbed
    await client.auth.updateUser({
      data: {
        firstName: null, lastName: null, middleName: null, suffix: null,
        birthDate: null, genderCode: null, mobile: null, barangayCode: null,
        street: null, houseNo: null, occupation: null, worksInLucena: null,
        agreedToTerms: null,
      },
    });
  } catch {
    /* best-effort */
  }
}

export const authService = {
  async login(email: string, password: string): Promise<User> {
    const client = getSupabaseClient();
    if (!client) {
      const user: User = { id: `USER-${Date.now()}`, email, name: email.split('@')[0] };
      mockSet(user);
      return user;
    }
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new AuthError(translateAuthError(error.message, 'login'));
    return toUser(data.user as SupabaseAuthUser);
  },

  async signup(data: SignupData): Promise<User> {
    const client = getSupabaseClient();
    if (!client) {
      const user: User = { id: `USER-${Date.now()}`, email: data.email, name: data.fullName };
      mockSet(user);
      return user;
    }
    const params = mapSignupToProfileParams(data); // validate before the network call
    const { data: signUp, error } = await client.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: buildSignupMetadata(data),
        emailRedirectTo:
          typeof window !== 'undefined' ? `${window.location.origin}/complete-signup` : undefined,
      },
    });
    if (error) throw new AuthError(translateAuthError(error.message, 'signup'));
    // create_citizen_profile needs a session (email in the JWT). signUp returns
    // one only when email confirmation is off. With it on (the Sandbox's
    // setting), there is no session yet: fail closed with a clear message instead
    // of returning a user the caller would treat as signed in. The profile is
    // created from user_metadata once the email link lands on /complete-signup.
    if (!signUp.session) {
      throw new AuthError('Account created. Please check your email to confirm your address, then sign in.');
    }
    const { error: rpcError } = await client.rpc('create_citizen_profile', params);
    if (rpcError && !rpcError.message.toLowerCase().includes('already')) {
      throw new AuthError('Your account was created, but your profile could not be saved. Please sign in and complete your profile.');
    }
    return toUser(signUp.user as SupabaseAuthUser);
  },

  async logout(): Promise<void> {
    const client = getSupabaseClient();
    try {
      if (client) {
        const { error } = await client.auth.signOut();
        if (error) {
          throw new AuthError('Sign-out did not fully complete. Please close your browser to end the session.');
        }
      }
    } finally {
      // Shared/kiosk machines: never leave the previous user's data behind,
      // even when signOut fails or we are in mock mode.
      if (typeof window !== 'undefined') {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem('requests');
      }
    }
  },

  async getCurrentUser(): Promise<User | null> {
    const client = getSupabaseClient();
    if (!client) return mockGet();
    const { data } = await client.auth.getUser();
    return data.user ? toUser(data.user as SupabaseAuthUser) : null;
  },

  async sendPasswordReset(email: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new AuthError(translateAuthError(error.message, 'generic'));
  },

  async updatePassword(newPassword: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) {
      // supabase-js rejects locally, before any request, when the recovery
      // link never produced a session (see RESET_LINK_UNUSABLE_MESSAGE).
      if (error.name === 'AuthSessionMissingError') throw new AuthError(RESET_LINK_UNUSABLE_MESSAGE);
      throw new AuthError(translateAuthError(error.message, 'generic'));
    }
  },

  /**
   * Reauthenticate with the current password, then set the new one. Unlike the
   * recovery flow (updatePassword), this is the signed-in flow and MUST prove
   * possession of the current password first.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const policyError = validatePassword(newPassword);
    if (policyError) throw new AuthError(policyError);
    const client = getSupabaseClient();
    if (!client) {
      throw new AuthError('Password changes need the online service and are unavailable right now.');
    }
    const { data } = await client.auth.getUser();
    const email = data.user?.email;
    if (!email) throw new AuthError('Your session has expired. Please sign in again.');
    const { error: reauthError } = await client.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (reauthError) throw new AuthError('Your current password is incorrect.');
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw new AuthError('Could not update your password right now. Please try again later.');
  },

  /**
   * Subscribe to session changes. Returns an unsubscribe fn. No-op without a
   * backend. The second callback argument is Supabase's raw auth event name
   * (e.g. 'SIGNED_IN', 'PASSWORD_RECOVERY') — most callers ignore it; the app
   * uses 'PASSWORD_RECOVERY' to flag a session that only proves mail access,
   * not a real sign-in (see AuthContext's isPasswordRecovery).
   */
  onAuthChange(cb: (user: User | null, event?: string) => void): () => void {
    const client = getSupabaseClient();
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((event, session) => {
      cb(session?.user ? toUser(session.user as SupabaseAuthUser) : null, event);
    });
    return () => data.subscription.unsubscribe();
  },

  /**
   * Best-effort: if the caller has a session but no citizens row, try to finish
   * create_citizen_profile from what signup() stashed in user_metadata. Safe to
   * call repeatedly (idempotent via the "already has a profile" RPC error).
   */
  async ensureCitizenProfile(): Promise<'exists' | 'completed' | 'incomplete' | 'not-a-citizen'> {
    const client = getSupabaseClient();
    if (!client) return 'exists';

    // A failed read is not "no row". It can 401 while a freshly exchanged
    // session is still being attached, and reading that as "no citizens row"
    // sent an existing citizen to /complete-signup. Throw instead — the caller
    // leaves the citizen where they are and retries on the next auth change.
    const { data: existing, error: readError } = await client
      .from('my_profile')
      .select('id')
      .maybeSingle();
    if (readError) throw new AuthError(translateAuthError(readError.message, 'generic'));
    if (existing) {
      await scrubSignupMetadata(client);
      return 'exists';
    }

    // No citizens row. Before assuming an unfinished signup, check whether this
    // is a STAFF account that signed into the wrong portal — the two look
    // identical from here, because every `my_*` view a staff account reads
    // returns HTTP 200 with `[]` rather than an error.
    //
    // Without this check the caller saw 'incomplete', sent a police officer or
    // a City Hall clerk to /complete-signup, and only when they submitted did
    // `assert_single_identity` finally refuse. Detecting it up front is both
    // faster and the only way to name the right portal to them.
    //
    // A read failure here is deliberately NOT treated as "is staff": the
    // fallthrough below is the safe answer for a citizen on a flaky network,
    // and a genuine staff account will still be stopped by
    // `assert_single_identity` at submit time.
    const { data: staffRow } = await client.from('my_staff_profile').select('id').maybeSingle();
    if (staffRow) return 'not-a-citizen';

    const { data: userData } = await client.auth.getUser();
    if (!userData.user) return 'exists';

    const params = tryBuildProfileParamsFromMetadata(
      userData.user.user_metadata as Record<string, unknown> | null | undefined,
    );
    if (!params) return 'incomplete';

    const { error } = await client.rpc('create_citizen_profile', params);
    if (!error) {
      await scrubSignupMetadata(client);
      return 'completed';
    }
    const message = error.message.toLowerCase();
    if (message.includes('already')) return 'exists';
    if (message.includes('staff account')) return 'not-a-citizen';
    return 'incomplete';
  },

  /** Manual fallback: called by the /complete-signup form when auto-completion
   * couldn't recover enough from user_metadata. Requires an existing session. */
  async completeProfile(fields: CitizenProfileFields): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const params = mapSignupToProfileParams(fields); // throws AuthError on invalid input
    const { error } = await client.rpc('create_citizen_profile', params);
    if (error && !error.message.toLowerCase().includes('already')) {
      throw new AuthError(translateCompleteProfileError(error.code, error.message));
    }
    // Success or the benign "already has a profile" case: the citizens row now
    // exists, so scrub the PII stashed in user_metadata immediately rather than
    // waiting for the next ensureCitizenProfile() call to catch it.
    await scrubSignupMetadata(client);
  },

  /** Raw session metadata, for best-effort form pre-fill only (not validated).
   * null when no backend or no session. */
  async getCurrentUserMetadata(): Promise<Record<string, unknown> | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data } = await client.auth.getUser();
    return (data.user?.user_metadata as Record<string, unknown> | undefined) ?? null;
  },
};
