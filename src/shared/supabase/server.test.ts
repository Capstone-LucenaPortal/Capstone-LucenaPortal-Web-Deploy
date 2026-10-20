import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CookieOptions } from "@supabase/ssr";
import { createClient } from "@/shared/supabase/server";

// ISO-6 at the server client's cookie adapter: a token refreshed during a
// server action must not come back as a 400-day cookie.

type CookieToSet = { name: string; value: string; options: CookieOptions };
type Adapter = { setAll(cookies: CookieToSet[]): void };

let adapter: Adapter;
const set = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set }),
}));

vi.mock("@supabase/ssr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@supabase/ssr")>()),
  createServerClient: (_url: string, _key: string, options: { cookies: Adapter }) => {
    adapter = options.cookies;
    return {};
  },
}));

const SUPABASE_MAX_AGE = 400 * 24 * 60 * 60;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  return () => {
    vi.unstubAllEnvs();
  };
});

// ISO-10: a missing variable must stop the client being built, by name,
// rather than surface later as an opaque fetch error inside supabase-js.
describe("server Supabase client environment", () => {
  it("refuses to build without the project URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    await expect(createClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("refuses to build without the anon key", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(createClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});

describe("server Supabase client cookies", () => {
  it("writes auth cookies with no Max-Age, so they die with the browser", async () => {
    await createClient();
    adapter.setAll([
      { name: "sb-auth-token", value: "fresh", options: { path: "/", sameSite: "lax", maxAge: SUPABASE_MAX_AGE } },
    ]);

    expect(set).toHaveBeenCalledWith("sb-auth-token", "fresh", { path: "/", sameSite: "lax" });
  });
});
