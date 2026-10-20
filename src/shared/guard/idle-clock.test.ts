import { readIdleClock } from "@/shared/guard/idle-clock";

// Ported from the Staff Portal's readServerIdleClock tests. The clock now
// reports the last activity in server time; whether that is idle is the
// guard's decision (src/shared/guard/decide.ts), per Portal.

const NOW = 1_800_000_000_000;
const SKEW = 20 * 60 * 1000;

describe("readIdleClock", () => {
  it("anchors the offset on the first reading and reports no activity time", () => {
    const clientNow = NOW - SKEW; // a desk PC twenty minutes slow
    expect(readIdleClock(String(clientNow), undefined, NOW)).toEqual({ offset: SKEW });
  });

  it("reads a slow browser's activity in server time", () => {
    const clientActivity = NOW - SKEW - 60_000;
    expect(readIdleClock(String(clientActivity), String(SKEW), NOW)).toEqual({
      lastActivity: NOW - 60_000,
    });
  });

  it("reads a fast browser's activity in server time, not as the future", () => {
    const clientActivity = NOW + SKEW - 60_000;
    expect(readIdleClock(String(clientActivity), String(-SKEW), NOW)).toEqual({
      lastActivity: NOW - 60_000,
    });
  });

  it("fails open, without anchoring, when no activity has been recorded", () => {
    expect(readIdleClock(undefined, undefined, NOW)).toEqual({});
    expect(readIdleClock(undefined, String(SKEW), NOW)).toEqual({});
  });

  it("fails open on an unusable activity value", () => {
    expect(readIdleClock("", undefined, NOW)).toEqual({});
    expect(readIdleClock("not-a-number", String(SKEW), NOW)).toEqual({});
    expect(readIdleClock("0", String(SKEW), NOW)).toEqual({});
  });

  it("re-anchors when the offset is unusable", () => {
    expect(readIdleClock(String(NOW - SKEW), "garbage", NOW)).toEqual({ offset: SKEW });
  });
});
