import { describe, expect, it } from "vitest";
import {
  CLOCK_OFFSET_COOKIE,
  IDLE_TIMEOUT_MS,
  LAST_ACTIVITY_COOKIE,
  isIdleExpired,
  markActivity,
  restartIdleClock,
} from "@/portals/responder/lib/supabase/idle-timeout";

const NOW = 1_800_000_000_000;

describe("IDLE_TIMEOUT_MS", () => {
  // The policy itself, pinned. ISO-6 (ISO/IEC 27002:2022 A.5.17, A.8.5).
  it("is sixty minutes", () => {
    expect(IDLE_TIMEOUT_MS).toBe(60 * 60 * 1000);
  });
});

describe("isIdleExpired", () => {
  it("is false while the session is inside the idle window", () => {
    expect(isIdleExpired(String(NOW - 1000), NOW)).toBe(false);
    expect(isIdleExpired(String(NOW - IDLE_TIMEOUT_MS), NOW)).toBe(false);
  });

  it("is true once the idle window has elapsed", () => {
    expect(isIdleExpired(String(NOW - IDLE_TIMEOUT_MS - 1), NOW)).toBe(true);
  });

  // Fails open on purpose: the alternative signs out every session that
  // predates the cookie existing. The absolute backstop is the session-scoped
  // auth cookie and the Supabase refresh-token expiry, not this clock.
  it("is false when no timestamp has been recorded yet", () => {
    expect(isIdleExpired(undefined, NOW)).toBe(false);
    expect(isIdleExpired("", NOW)).toBe(false);
    expect(isIdleExpired("not-a-number", NOW)).toBe(false);
    expect(isIdleExpired("0", NOW)).toBe(false);
  });

  // A backwards clock jump would otherwise yield a negative age that can never
  // exceed the cap, quietly disabling the timeout for the rest of the session.
  it("is false when the recorded time is in the future", () => {
    expect(isIdleExpired(String(NOW + 60_000), NOW)).toBe(false);
  });
});

describe("markActivity", () => {
  it("records the moment in a session-scoped cookie readable by every tab", () => {
    markActivity(NOW);

    expect(document.cookie).toContain(`${LAST_ACTIVITY_COOKIE}=${NOW}`);
  });

  it("writes the cookie with no lifetime, so it dies with the browser session", () => {
    const writes: string[] = [];
    // Shadow the prototype's accessor to see the raw Set-Cookie string, which
    // the real one parses away.
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: (value: string) => writes.push(value),
    });
    try {
      markActivity(NOW);
    } finally {
      Reflect.deleteProperty(document, "cookie");
    }

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/Path=\//);
    expect(writes[0]).not.toMatch(/Max-Age|Expires/i);
  });
});

describe("restartIdleClock", () => {
  it("moves the clock and drops the old offset, so sign-in re-measures the gap", () => {
    document.cookie = `${CLOCK_OFFSET_COOKIE}=123; Path=/`;

    restartIdleClock(NOW);

    expect(document.cookie).toContain(`${LAST_ACTIVITY_COOKIE}=${NOW}`);
    expect(document.cookie).not.toContain(CLOCK_OFFSET_COOKIE);
  });
});
