import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isoToLocalInput } from "./datetime";
import { formatDate, formatDateTime } from "./utils";

// A hosted Next.js server runs in UTC. Forcing the process zone to UTC means a
// dropped timeZone fails here even on a developer machine already on Manila
// time, which is how the bug hid (ticket 12).
describe("Manila time zone, whatever the process zone", () => {
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

  it("formatDateTime shows Manila's clock, 8 hours ahead of UTC", () => {
    expect(formatDateTime("2026-07-07T04:22:00Z")).toBe("Jul 7, 2026, 12:22 PM");
  });

  it("formatDateTime crosses midnight into Manila's next day", () => {
    expect(formatDateTime("2026-07-31T23:00:00Z")).toBe("Aug 1, 2026, 7:00 AM");
  });

  it("formatDate names Manila's calendar day, not UTC's", () => {
    expect(formatDate("2026-07-31T23:00:00Z")).toBe("Aug 1, 2026");
  });

  it("a list view and the editor agree on the day near midnight", () => {
    // The list shows formatDate; the editor's datetime-local shows isoToLocalInput.
    const stored = "2026-07-31T23:00:00+00:00";
    expect(isoToLocalInput(stored).slice(0, 10)).toBe("2026-08-01");
    expect(formatDate(stored)).toBe("Aug 1, 2026");
  });
});
