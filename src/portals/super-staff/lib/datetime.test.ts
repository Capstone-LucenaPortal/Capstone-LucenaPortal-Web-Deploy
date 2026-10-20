import { describe, expect, it } from "vitest";
import { isoToLocalInput, localInputToIso } from "./datetime";

/**
 * The shape under test is the one PostgREST actually returns.
 *
 * `platform_posts.start_at` is `timestamptz` and the database's `TimeZone` is
 * `UTC`, so a stored instant comes back normalised to `+00:00` —
 * `2026-07-20T09:30:00+00:00`, never `+08:00`. These helpers used to be tested
 * against the `+08:00` shape, which is why a round trip that silently
 * subtracted eight hours per save stayed green (ticket 11).
 */

describe("isoToLocalInput", () => {
  it("converts a stored UTC instant to Manila wall clock", () => {
    // 09:30 UTC is 17:30 in Manila; the input must show what a human here reads.
    expect(isoToLocalInput("2026-07-20T09:30:00+00:00")).toBe(
      "2026-07-20T17:30",
    );
  });

  it("crosses the date boundary the offset pushes it over", () => {
    // 20:00 UTC on the 20th is 04:00 on the 21st in Manila.
    expect(isoToLocalInput("2026-07-20T20:00:00+00:00")).toBe(
      "2026-07-21T04:00",
    );
  });

  it("leaves an instant already expressed in the PH offset alone", () => {
    expect(isoToLocalInput("2026-07-16T09:00:00+08:00")).toBe(
      "2026-07-16T09:00",
    );
  });

  it("returns empty string for null", () => {
    expect(isoToLocalInput(null)).toBe("");
  });

  it("fails loudly on an unparseable stored value rather than blanking it", () => {
    // Returning "" here would be worse than throwing: a blank start passes
    // `validateAnnouncement`, so the next save would send `p_start_at: null`
    // and clear a live publish window without anyone seeing an error.
    expect(() => isoToLocalInput("not a timestamp")).toThrow(RangeError);
  });
});

describe("localInputToIso", () => {
  it("appends seconds and the PH offset", () => {
    expect(localInputToIso("2026-07-16T09:00")).toBe(
      "2026-07-16T09:00:00+08:00",
    );
  });

  it("returns null for empty string", () => {
    expect(localInputToIso("")).toBeNull();
  });
});

describe("the round trip a save performs", () => {
  it("round-trips a stored ISO without drift", () => {
    // The shape the database returns, not the one the portal writes.
    const iso = "2026-07-20T09:30:00+00:00";
    const back = localInputToIso(isoToLocalInput(iso));
    // Same instant, re-expressed in the offset the portal writes with.
    expect(back).toBe("2026-07-20T17:30:00+08:00");
    expect(Date.parse(back!)).toBe(Date.parse(iso));
  });

  it("stays put across repeated saves", () => {
    // What made the drift compound: `timestamptz` re-normalises whatever the
    // portal writes back to UTC, so the next load hands the helper a fresh
    // `+00:00` string and it loses another eight hours. Four saves, 32 hours.
    const asPostgrestReturnsIt = (iso: string) =>
      new Date(iso).toISOString().replace(/\.\d{3}Z$/, "+00:00");

    const stored = "2026-08-22T01:00:00+00:00";
    let current = stored;
    for (let save = 0; save < 4; save++) {
      current = asPostgrestReturnsIt(localInputToIso(isoToLocalInput(current))!);
    }
    expect(current).toBe(stored);
  });
});
