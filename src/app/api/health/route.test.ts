// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const SUPABASE_URL = "https://project.supabase.co";
const ANON_KEY = "anon-key";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("GET /api/health", () => {
  it("answers ok, db_ok and a whole-number ms, and nothing else", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["db_ok", "ms", "ok"]);
    expect(body.ok).toBe(true);
    expect(body.db_ok).toBe(true);
    expect(Number.isInteger(body.ms)).toBe(true);
    expect(body.ms).toBeGreaterThanOrEqual(0);
  });

  it("is never cached, so every poll measures a fresh round trip", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));

    const res = await GET();

    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("reports db_ok false when the database answers with an error", async () => {
    fetchMock.mockResolvedValue(new Response("upstream timeout", { status: 503 }));

    const body = await (await GET()).json();

    expect(body).toMatchObject({ ok: true, db_ok: false });
  });

  it("reports db_ok false without leaking the error when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.7:5432"));

    const res = await GET();
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toMatchObject({ ok: true, db_ok: false });
    expect(text).not.toContain("ECONNREFUSED");
  });

  it("probes the database with the public anon key only", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));

    await GET();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url).startsWith(`${SUPABASE_URL}/rest/v1/`)).toBe(true);
    const headers = new Headers(init?.headers);
    expect(headers.get("apikey")).toBe(ANON_KEY);
    expect(headers.get("authorization")).toBeNull();
  });
});
