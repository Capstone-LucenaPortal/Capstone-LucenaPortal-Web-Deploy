import { describe, expect, it, vi } from "vitest";
import { formatDeadline, parseDeadlineState } from "./deadline";

describe("parseDeadlineState", () => {
  it.each(["on_track", "at_risk", "overdue"] as const)("accepts %s", (state) => {
    expect(parseDeadlineState(state)).toBe(state);
  });

  it("keeps null, which means the clock is not running", () => {
    expect(parseDeadlineState(null)).toBeNull();
  });

  /**
   * The database computes the state (l80). A value outside its vocabulary is
   * evidence the view changed under the portal, and degrading it to "no state"
   * would hide exactly the warning this column exists to show.
   */
  it("refuses a value the database does not produce", () => {
    expect(() => parseDeadlineState("breached")).toThrow(/deadline_state/);
    // an inherited key is not in the vocabulary either
    expect(() => parseDeadlineState("toString")).toThrow(/deadline_state/);
  });
});

describe("formatDeadline", () => {
  // 2026-10-13T09:30Z is 17:30 in Manila, and still the 13th: a browser in
  // UTC would show 09:30. 2026-10-13T20:00Z is already the 14th in Manila.
  it("shows the deadline in Manila time, whatever the browser's zone", () => {
    expect(formatDeadline("2026-10-13T09:30:00Z")).toMatch(/October 13, 2026/);
    expect(formatDeadline("2026-10-13T09:30:00Z")).toMatch(/05:30\s*PM/i);
    expect(formatDeadline("2026-10-13T20:00:00Z")).toMatch(/October 14, 2026/);
  });

  /**
   * The output assertions above pass vacuously on a machine whose own zone is
   * Manila — every developer's — and the worker's default zone cannot be
   * changed mid-process. So assert the option is requested, the way
   * admin/lib/dates.test.ts does (and for the reasons it records).
   */
  it("always requests the Asia/Manila zone explicitly, never the host default", () => {
    const RealDateTimeFormat = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (
      ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
    ) {
      return new RealDateTimeFormat(...args);
    });
    try {
      formatDeadline("2026-10-13T09:30:00Z");
      expect(spy).toHaveBeenCalledWith(
        "en-PH",
        expect.objectContaining({ timeZone: "Asia/Manila" }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
