import { describe, expect, it } from "vitest";
import { citizenAuthCookieName, toSessionScopedCookieOptions } from "@/shared/supabase/session-cookie";

// @supabase/ssr's own default: 400 days.
const SUPABASE_MAX_AGE = 400 * 24 * 60 * 60;

describe("toSessionScopedCookieOptions", () => {
  it("strips maxAge so the cookie is not persisted across browser restarts", () => {
    const result = toSessionScopedCookieOptions({ maxAge: SUPABASE_MAX_AGE, path: "/" });
    expect(result.maxAge).toBeUndefined();
  });

  it("strips expires for the same reason", () => {
    const result = toSessionScopedCookieOptions({ expires: new Date(Date.UTC(2027, 0, 1)), path: "/" });
    expect(result.expires).toBeUndefined();
  });

  it("leaves every other option untouched", () => {
    const result = toSessionScopedCookieOptions({
      maxAge: SUPABASE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: true,
    });
    expect(result).toEqual({ path: "/", sameSite: "lax", httpOnly: false, secure: true });
  });

  // @supabase/ssr deletes a cookie by writing it with maxAge 0. Stripping that
  // would turn a sign-out's deletion into an empty cookie that lives on until
  // the browser closes.
  it("keeps maxAge 0, which is how a cookie is deleted", () => {
    const result = toSessionScopedCookieOptions({ maxAge: 0, path: "/" });
    expect(result.maxAge).toBe(0);
  });

  it("does not mutate the input object", () => {
    const input = { maxAge: SUPABASE_MAX_AGE, path: "/" };
    toSessionScopedCookieOptions(input);
    expect(input.maxAge).toBe(SUPABASE_MAX_AGE);
  });
});

describe("citizenAuthCookieName", () => {
  it("names the citizen cookie after the project ref", () => {
    expect(citizenAuthCookieName("https://zqsqenfoszgcunvpqvvg.supabase.co")).toBe(
      "sb-zqsqenfoszgcunvpqvvg-citizen-auth-token",
    );
  });

  // The staff session keeps @supabase/ssr's default, sb-<ref>-auth-token
  // (ADR 0004). The two must never collide, or one sign-in overwrites the other.
  it("differs from the default staff cookie name", () => {
    expect(citizenAuthCookieName("https://zqsqenfoszgcunvpqvvg.supabase.co")).not.toBe(
      "sb-zqsqenfoszgcunvpqvvg-auth-token",
    );
  });

  it("derives the ref the way supabase-js does for a local stack", () => {
    expect(citizenAuthCookieName("http://localhost:54321")).toBe("sb-localhost-citizen-auth-token");
  });
});
