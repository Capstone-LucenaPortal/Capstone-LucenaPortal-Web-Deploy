import { describe, expect, it } from "vitest";
import { navDot, reachabilityStatus } from "./status";

describe("reachabilityStatus", () => {
  it("is ok at 500 ms, warning just over it, critical just over 2 s", () => {
    expect(reachabilityStatus({ ok: true, db_ok: true, ms: 500 })).toBe("ok");
    expect(reachabilityStatus({ ok: true, db_ok: true, ms: 501 })).toBe("warning");
    expect(reachabilityStatus({ ok: true, db_ok: true, ms: 2000 })).toBe("warning");
    expect(reachabilityStatus({ ok: true, db_ok: true, ms: 2001 })).toBe("critical");
  });

  it("is critical when the database or the app is unreachable, however fast", () => {
    expect(reachabilityStatus({ ok: true, db_ok: false, ms: 40 })).toBe("critical");
    expect(reachabilityStatus({ ok: false, db_ok: false, ms: 0 })).toBe("critical");
  });

  it("is critical when /api/health could not be reached at all", () => {
    expect(reachabilityStatus(null)).toBe("critical");
  });
});

describe("navDot", () => {
  it("is amber for warning and red for critical", () => {
    expect(navDot("warning")).toBe("amber");
    expect(navDot("critical")).toBe("red");
  });

  it("shows nothing when all is ok", () => {
    expect(navDot("ok")).toBeNull();
  });

  // super_system_health() answers null to anyone who is not a super_staff,
  // and a failed read must not paint the nav either.
  it("shows nothing when there is no snapshot", () => {
    expect(navDot(null)).toBeNull();
  });
});
