import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { cn, formatDate, formatDateTime, formatFileSize } from "@/portals/staff/lib/utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("formatDate", () => {
  it("formats an ISO date string as a long-form en-PH date", () => {
    expect(formatDate("2026-07-07")).toBe("July 7, 2026");
  });
});

// A hosted Next.js server runs in UTC, and most of the Staff Portal renders
// there. Forcing the process zone to UTC means a dropped timeZone fails here
// even on a developer machine already on Manila time, which is how the bug hid.
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
    expect(formatDateTime("2026-07-07T04:22:00Z")).toBe("July 7, 2026 at 12:22 PM");
  });

  it("formatDateTime crosses midnight into Manila's next day", () => {
    expect(formatDateTime("2026-07-31T23:00:00Z")).toBe("August 1, 2026 at 07:00 AM");
  });

  it("formatDate names Manila's calendar day, not UTC's", () => {
    expect(formatDate("2026-07-31T23:00:00Z")).toBe("August 1, 2026");
  });
});

describe("formatFileSize", () => {
  it("reports plain bytes below a kilobyte", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("switches to whole kilobytes at 1024 bytes", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(204800)).toBe("200 KB");
  });

  it("rounds kilobytes to the nearest whole one, down as well as up", () => {
    expect(formatFileSize(1400)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("2 KB");
    expect(formatFileSize(2000)).toBe("2 KB");
  });

  it("switches to one-decimal megabytes at 1024 KB", () => {
    // The last byte below the switch rounds to a whole 1024 KB, so the
    // largest size this reports in KB reads as a megabyte. Pinned as-is.
    expect(formatFileSize(1024 * 1024 - 1)).toBe("1024 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });
});
