import { describe, expect, it } from "vitest";
import { formatCurrency, splitMoney } from "./money";

describe("formatCurrency", () => {
  it("formats pesos with two decimals and separators", () => {
    expect(formatCurrency(115000)).toBe("₱115,000.00");
    expect(formatCurrency(0)).toBe("₱0.00");
  });

  it("renders an absent figure rather than zero", () => {
    // A booking awaiting a quote has total_fee = NULL. Showing ₱0.00 there
    // would read as "free", which is the one thing it does not mean.
    expect(formatCurrency(null)).toBe("—");
  });
});

describe("splitMoney", () => {
  it("mirrors booking_money: round the downpayment, subtract for the balance", () => {
    expect(splitMoney(115000, 50)).toEqual({
      downpaymentAmount: 57500,
      balanceAmount: 57500,
    });
  });

  it("keeps the two halves summing to the total exactly", () => {
    // booking_money() subtracts rather than rounding twice, precisely so a
    // centavo is never lost or invented. 12,345.67 at 50% is the case that
    // catches a naive second round().
    const { downpaymentAmount, balanceAmount } = splitMoney(12345.67, 50);
    expect(downpaymentAmount).toBe(6172.84);
    expect(balanceAmount).toBe(6172.83);
    expect(downpaymentAmount! + balanceAmount!).toBeCloseTo(12345.67, 2);
  });

  it("handles a 100% downpayment, which produces a zero balance", () => {
    // verify_payment branches on balance_amount = 0 and skips `confirmed`
    // entirely, so this is a real configuration, not a theoretical one.
    expect(splitMoney(50000, 100)).toEqual({
      downpaymentAmount: 50000,
      balanceAmount: 0,
    });
  });

  it("returns nulls for an unpriced booking", () => {
    expect(splitMoney(null, 50)).toEqual({
      downpaymentAmount: null,
      balanceAmount: null,
    });
  });
});
