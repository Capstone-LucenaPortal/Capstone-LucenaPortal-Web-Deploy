import { describe, expect, it } from "vitest";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { signInErrorMessage } from "@/shared/supabase/sign-in-error";

describe("signInErrorMessage", () => {
  // ISO-9: offline, or with the auth server down, the official was told their
  // password was wrong. Status 0 is a fetch that threw (offline); 503 is a
  // gateway with the auth server down. Neither reached the credential check.
  it.each([
    ["Failed to fetch", 0],
    ["Service Unavailable", 503],
  ])("blames the connection on %s (%i)", (message, status) => {
    expect(signInErrorMessage(new AuthRetryableFetchError(message, status))).toBe(
      "Cannot reach the server. Check your connection and try again.",
    );
  });

  // The limit applies whether or not the email exists, so naming it gives
  // nothing away about the account.
  it("says to wait when rate-limited", () => {
    expect(
      signInErrorMessage(
        new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit"),
      ),
    ).toBe("Too many attempts. Wait a minute and try again.");
  });

  // Distinguishing "no such account" from "wrong password" tells an attacker
  // which employee emails are real, so every credential failure reads alike.
  it.each([
    ["Invalid login credentials", 400, "invalid_credentials"],
    ["Email not confirmed", 400, "email_not_confirmed"],
    ["User is banned", 403, "user_banned"],
  ])("gives one generic message for %s", (message, status, code) => {
    expect(signInErrorMessage(new AuthApiError(message, status, code))).toBe(
      "Incorrect email or password.",
    );
  });
});
