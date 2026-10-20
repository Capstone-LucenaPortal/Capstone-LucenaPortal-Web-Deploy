/**
 * Peso formatting, and the mirror of booking_money().
 *
 * formatCurrency moved here from the deleted pricing.ts. Nothing else in that
 * file survived: getBaseFee and getDownpayment computed a fee from a rate table
 * in TypeScript, which is now the database's job.
 */

const PESO = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** An absent figure renders as an em dash. ₱0.00 would read as "free". */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return PESO.format(amount);
}

/**
 * Postgres `round(numeric, 2)` is half-away-from-zero. Fees are always
 * positive, so Math.round on the scaled value agrees with it — but only if the
 * scaling does not drift first. Number.EPSILON absorbs the case where
 * x * 100 lands a hair under the .5 boundary in binary floating point.
 *
 * The stakes are one centavo on a display preview; the stored figures come
 * from the database. This exists so the preview does not disagree with what
 * lands a moment later.
 */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Pure mirror of booking_money(p_total_fee).
 *
 * Note what it does NOT do: it does not round the balance. The server computes
 * `p_total_fee - v_dp` for exactly the reason its own comment gives — rounding
 * both halves independently can lose or gain a centavo, and record_balance_
 * payment then refuses the settlement because the amount is not an exact match.
 */
export function splitMoney(
  totalFee: number | null,
  downpaymentPct: number,
): { downpaymentAmount: number | null; balanceAmount: number | null } {
  if (totalFee === null) {
    return { downpaymentAmount: null, balanceAmount: null };
  }
  const downpaymentAmount = round2((totalFee * downpaymentPct) / 100);
  return {
    downpaymentAmount,
    balanceAmount: round2(totalFee - downpaymentAmount),
  };
}
