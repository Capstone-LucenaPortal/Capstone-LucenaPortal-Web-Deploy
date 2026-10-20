import { requireEnv } from "@/shared/supabase/env";

describe("requireEnv", () => {
  it("returns the value when it is set", () => {
    expect(requireEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")).toBe(
      "https://example.supabase.co",
    );
  });

  it("throws a clear boot-time error naming the missing variable", () => {
    expect(() => requireEnv("NEXT_PUBLIC_SUPABASE_URL", undefined)).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
    expect(() => requireEnv("NEXT_PUBLIC_SUPABASE_URL", undefined)).toThrow(/\.env\.local/);
  });

  it("treats an empty string as missing", () => {
    expect(() => requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });
});
