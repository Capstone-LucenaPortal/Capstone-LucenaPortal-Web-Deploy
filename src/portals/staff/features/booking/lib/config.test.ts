import { describe, expect, it } from "vitest";
import { toDownpaymentPct } from "./config";

describe("toDownpaymentPct", () => {
  it("passes a stored percentage through", () => {
    expect(toDownpaymentPct(50)).toBe(50);
    expect(toDownpaymentPct(20)).toBe(20);
    // 100% is legal and meaningful: verify_payment branches on a zero balance.
    expect(toDownpaymentPct(100)).toBe(100);
  });

  it("falls back to the stored default when unreadable", () => {
    expect(toDownpaymentPct(null)).toBe(50);
    expect(toDownpaymentPct(undefined)).toBe(50);
  });

  it("refuses a nonsensical value", () => {
    // A zero would preview a downpayment of nothing on the quote screen and
    // make it look as though the citizen owes the full amount in person.
    expect(toDownpaymentPct(0)).toBe(50);
    expect(toDownpaymentPct(-10)).toBe(50);
    expect(toDownpaymentPct(500)).toBe(50);
  });
});
