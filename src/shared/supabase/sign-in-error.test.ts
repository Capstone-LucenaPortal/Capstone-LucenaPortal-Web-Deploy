import { describe, expect, it } from "vitest";
import { AuthApiError, AuthRetryableFetchError, AuthWeakPasswordError } from "@supabase/supabase-js";
import { newPasswordErrorMessage, signInErrorMessage } from "@/shared/supabase/sign-in-error";

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

describe("newPasswordErrorMessage", () => {
  // Accept-invite never shows Supabase's own text (#87): a raw "AAL2 session
  // is required…" left a resent link's employee with nothing to act on.
  it.each([
    ["Failed to fetch", 0, "Cannot reach the server. Check your connection and try again."],
    ["Service Unavailable", 503, "Cannot reach the server. Check your connection and try again."],
  ])("blames the connection on %s (%i)", (message, status, expected) => {
    expect(newPasswordErrorMessage(new AuthRetryableFetchError(message, status))).toBe(expected);
  });

  // A 500 is the auth server failing, not the password.
  it("blames the server for a 500", () => {
    expect(
      newPasswordErrorMessage(new AuthApiError("Database error updating user", 500, "unexpected_failure")),
    ).toBe("Cannot reach the server. Check your connection and try again.");
  });

  it("says to wait when rate-limited", () => {
    expect(
      newPasswordErrorMessage(new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit")),
    ).toBe("Too many attempts. Wait a minute and try again.");
  });

  it("asks for a different password when it is the current one", () => {
    expect(
      newPasswordErrorMessage(
        new AuthApiError("New password should be different from the old password.", 422, "same_password"),
      ),
    ).toBe("Choose a password different from your current one.");
  });

  it("repeats the password rules for one the server calls weak", () => {
    expect(
      newPasswordErrorMessage(new AuthWeakPasswordError("Password should be at least 8 characters.", 422, ["length"])),
    ).toBe("At least 8 characters, with at least one letter and one number.");
  });

  it("asks for the authenticator code when the session is password-only", () => {
    expect(
      newPasswordErrorMessage(
        new AuthApiError("AAL2 session is required to update email or password when MFA is enabled.", 401, "insufficient_aal"),
      ),
    ).toBe("Enter your authenticator code before setting a new password.");
  });

  it.each([
    ["User not found", 404, "user_not_found"],
    ["Session expired", 403, "session_expired"],
    ["Something new", 400, undefined],
  ])("gives one generic line for %s", (message, status, code) => {
    expect(newPasswordErrorMessage(new AuthApiError(message, status, code))).toBe(
      "Could not set your password. Try again, or ask your Super Staff to send a new link.",
    );
  });
});
