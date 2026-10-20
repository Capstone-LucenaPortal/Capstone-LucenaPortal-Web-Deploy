import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NO_DATE, formatManilaDate, formatManilaDateTime } from "./manila";

// A hosted Next.js server runs in UTC. Forcing the process zone to UTC means a
// dropped timeZone fails here even on a developer machine already on Manila
// time, which is how the bug hid (SCRUM-237).
describe("Manila formatters, whatever the process zone", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "UTC";
    // Node ignores a runtime TZ change inside a worker thread. If the pool
    // ever moves to threads, fail here rather than pass on a Manila machine.
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });

  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  describe("formatManilaDate", () => {
    it("names Manila's calendar day, not UTC's", () => {
      expect(formatManilaDate("2026-07-31T23:00:00Z")).toBe("August 1, 2026");
    });

    it("abbreviates the month in the medium style", () => {
      expect(formatManilaDate("2026-07-31T23:00:00Z", "medium")).toBe("Aug 1, 2026");
    });

    it("accepts epoch milliseconds and Date objects", () => {
      const instant = Date.UTC(2026, 6, 31, 23);
      expect(formatManilaDate(instant)).toBe("August 1, 2026");
      expect(formatManilaDate(new Date(instant))).toBe("August 1, 2026");
    });
  });

  describe("formatManilaDateTime", () => {
    it("shows Manila's clock, 8 hours ahead of UTC", () => {
      expect(formatManilaDateTime("2026-07-07T04:22:00Z")).toBe("July 7, 2026 at 12:22 PM");
    });

    it("crosses midnight into Manila's next day", () => {
      expect(formatManilaDateTime("2026-07-31T23:00:00Z", "medium")).toBe("Aug 1, 2026, 7:00 AM");
    });
  });

  describe("missing or unparseable input", () => {
    it.each([null, undefined, "", "not-a-date"])("renders %j as a dash rather than throwing", (value) => {
      expect(formatManilaDate(value)).toBe(NO_DATE);
      expect(formatManilaDateTime(value)).toBe(NO_DATE);
    });
  });
});
