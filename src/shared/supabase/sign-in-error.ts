// src/shared/supabase/sign-in-error.ts
//
// The one message map for a failed signInWithPassword at the City employee
// sign-in (ADR 0009), and its siblings for a failed authenticator code and a
// refused new password on accept-invite, so they cannot drift apart. The
// Citizen Portal keeps its own translateAuthError: it matches on message text
// and has signup-specific branches.
import { isAuthApiError, isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { PASSWORD_RULES_TEXT } from "@/shared/auth/password-policy";

// A failed fetch, a 5xx or a 429 never reached the credential check, so
// naming it says nothing about the account (ISO-9); the rate limit applies
// whether or not the email exists.
const UNREACHED = "Cannot reach the server. Check your connection and try again.";

function unreachedMessage(error: AuthError): string | null {
  if (isAuthRetryableFetchError(error)) {
    return UNREACHED;
  }
  if (isAuthApiError(error) && error.status === 429) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return null;
}

export function signInErrorMessage(error: AuthError): string {
  const unreached = unreachedMessage(error);
  if (unreached) return unreached;
  // Every other failure gets one message: distinguishing "no such account"
  // from "wrong password" tells an attacker which employee emails are real.
  return "Incorrect email or password.";
}

/**
 * The message for a failed authenticator code (ADR 0009), at the sign-in's
 * code step and at enrolment alike. Offline and rate-limited read as on the
 * password step; anything else is a code that did not match, and the person
 * stays where they are to try again.
 */
export function authenticatorCodeErrorMessage(error: AuthError): string {
  return unreachedMessage(error) ?? "That code didn't match. Check your authenticator app and try again.";
}

/**
 * The message for a refused updateUser({ password }) on accept-invite, never
 * Supabase's own text (#87). insufficient_aal is an account with an
 * authenticator whose code is not in yet: the page goes back to its code step.
 */
export function newPasswordErrorMessage(error: AuthError): string {
  const unreached = unreachedMessage(error);
  if (unreached) return unreached;
  // auth-js retries only a 502, 503 or 504; a 500 is the auth server failing
  // too, never the password.
  if (isAuthApiError(error) && error.status >= 500) return UNREACHED;
  switch (error.code) {
    case "same_password":
      return "Choose a password different from your current one.";
    case "weak_password":
      return PASSWORD_RULES_TEXT;
    case "insufficient_aal":
      return "Enter your authenticator code before setting a new password.";
    default:
      return "Could not set your password. Try again, or ask your Super Staff to send a new link.";
  }
}
