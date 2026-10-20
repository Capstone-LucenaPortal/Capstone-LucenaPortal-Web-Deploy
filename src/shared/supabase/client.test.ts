import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CookieOptions } from "@supabase/ssr";
import { createClient } from "@/shared/supabase/client";

// ISO-6 at the browser client's cookie adapter: whatever @supabase/ssr asks
// to write, the browser must be handed a session-scoped cookie.

type CookieToSet = { name: string; value: string; options: CookieOptions };
type Adapter = { getAll(): { name: string; value: string }[]; setAll(cookies: CookieToSet[]): void };

let adapter: Adapter;

vi.mock("@supabase/ssr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@supabase/ssr")>()),
  createBrowserClient: (_url: string, _key: string, options: { cookies: Adapter }) => {
    adapter = options.cookies;
    return {};
  },
}));

const SUPABASE_MAX_AGE = 400 * 24 * 60 * 60;
let writes: string[];

beforeEach(() => {
  writes = [];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => "sb-auth-token=existing",
    set: (value: string) => writes.push(value),
  });
  return () => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(document, "cookie");
  };
});

// ISO-10: a missing variable must stop the client being built, by name,
// rather than surface later as an opaque fetch error inside supabase-js.
describe("browser Supabase client environment", () => {
  it("refuses to build without the project URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("refuses to build without the anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});

describe("browser Supabase client cookies", () => {
  it("writes auth cookies with no Max-Age, so they die with the browser", () => {
    createClient();
    adapter.setAll([
      { name: "sb-auth-token", value: "fresh", options: { path: "/", sameSite: "lax", maxAge: SUPABASE_MAX_AGE } },
    ]);

    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain("sb-auth-token=fresh");
    expect(writes[0]).not.toMatch(/Max-Age|Expires/i);
  });

  it("still deletes a cookie on sign-out", () => {
    createClient();
    adapter.setAll([{ name: "sb-auth-token", value: "", options: { path: "/", maxAge: 0 } }]);

    expect(writes[0]).toMatch(/Max-Age=0/);
  });

  it("reads cookies from the document", () => {
    createClient();

    expect(adapter.getAll()).toEqual([{ name: "sb-auth-token", value: "existing" }]);
  });
});
