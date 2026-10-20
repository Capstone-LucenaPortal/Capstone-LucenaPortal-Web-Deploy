import { describe, expect, it } from "vitest";
import { toThreshold } from "./config";

describe("toThreshold", () => {
  it("converts a percentage to a fraction", () => {
    expect(toThreshold(50)).toBe(0.5);
    expect(toThreshold(75)).toBe(0.75);
  });

  it("falls back when the value is missing", () => {
    // A failed config read must degrade to today's behaviour, not to zero —
    // a zero threshold would flag every armed incident as at risk.
    expect(toThreshold(null)).toBe(0.5);
    expect(toThreshold(undefined)).toBe(0.5);
  });

  it("falls back on a nonsensical value", () => {
    expect(toThreshold(0)).toBe(0.5);
    expect(toThreshold(-10)).toBe(0.5);
    expect(toThreshold(500)).toBe(0.5);
  });
});
