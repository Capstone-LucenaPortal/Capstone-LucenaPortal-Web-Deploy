// src/shared/supabase/sign-in-error.ts
//
// The one message map for a failed signInWithPassword, shared by the four
// employee logins (Admin, SuperStaff, Staff, Responder) so they cannot drift
// apart. The Citizen Portal keeps its own translateAuthError: it matches on
// message text and has signup-specific branches.
import { isAuthApiError, isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";

export function signInErrorMessage(error: AuthError): string {
  // A failed fetch, a 5xx or a 429 never reached the credential check, so
  // naming it says nothing about the account (ISO-9); the rate limit applies
  // whether or not the email exists.
  if (isAuthRetryableFetchError(error)) {
    return "Cannot reach the server. Check your connection and try again.";
  }
  if (isAuthApiError(error) && error.status === 429) {
    return "Too many attempts. Wait a minute and try again.";
  }
  // Every other failure gets one message: distinguishing "no such account"
  // from "wrong password" tells an attacker which employee emails are real.
  return "Incorrect email or password.";
}
