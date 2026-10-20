import { describe, expect, it } from "vitest";
import { buildBookingCard, type BookingPreviewRow } from "./dashboard-card";

const now = new Date("2026-08-11T12:00:00+08:00");

function row(over: Partial<BookingPreviewRow> = {}): BookingPreviewRow {
  return {
    id: "bk-1",
    reference_number: "BK-2026-000037",
    event_title: "Barangay Fiesta",
    status: "awaiting_quote",
    submitted_at: "2026-08-11T09:00:00+08:00",
    ...over,
  };
}

const totals = {
  awaitingQuote: 2,
  paymentVerification: 3,
  balanceOutstanding: 3,
};

describe("buildBookingCard", () => {
  it("carries the three counts through untouched", () => {
    const card = buildBookingCard({ ...totals, rows: [], now });
    expect(card.awaitingQuote).toBe(2);
    expect(card.paymentVerification).toBe(3);
    expect(card.balanceOutstanding).toBe(3);
  });

  it("does not derive the counts from the preview rows", () => {
    // rows is only the first few. Counting them would silently cap every
    // figure at the preview limit.
    const card = buildBookingCard({
      ...totals,
      rows: [row(), row({ id: "bk-2" })],
      now,
    });
    expect(card.awaitingQuote).toBe(2);
    expect(card.preview).toHaveLength(2);
  });

  it("caps the preview at two", () => {
    const card = buildBookingCard({
      ...totals,
      rows: [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })],
      now,
    });
    expect(card.preview).toHaveLength(2);
  });

  it("flags the longest-waiting awaiting_quote booking as overdue", () => {
    // Decision 8: slow quoting has to be visible as a staff problem rather
    // than resolved by dropping the citizen's reservation.
    const card = buildBookingCard({
      ...totals,
      rows: [row({ submitted_at: "2026-08-08T09:00:00+08:00" })],
      now,
    });
    expect(card.preview[0].tag).toEqual({
      text: "quote overdue",
      tone: "critical",
    });
  });

  it("does not call a fresh quote request overdue", () => {
    const card = buildBookingCard({
      ...totals,
      rows: [row({ submitted_at: "2026-08-11T09:00:00+08:00" })],
      now,
    });
    expect(card.preview[0].tag).toEqual({ text: "needs quote", tone: "warning" });
  });

  it("only calls a QUOTE overdue, never a payment or a balance", () => {
    // The other two are not waiting on a decision anyone has been slow about
    // in the same way; a confirmed booking's balance is due when the citizen
    // comes in.
    const old = "2026-01-01T09:00:00+08:00";
    const card = buildBookingCard({
      ...totals,
      rows: [
        row({ id: "a", status: "payment_verification", submitted_at: old }),
        row({ id: "b", status: "confirmed", submitted_at: old }),
      ],
      now,
    });
    expect(card.preview[0].tag.text).toBe("verify payment");
    expect(card.preview[1].tag.text).toBe("balance due");
  });

  it("tags a Tier Claim waiting on review in words, not as a raw status", () => {
    // awaiting_tier_review joined Needs Action with SCRUM-198.
    const card = buildBookingCard({
      ...totals,
      rows: [row({ status: "awaiting_tier_review" })],
      now,
    });
    expect(card.preview[0].tag).toEqual({ text: "review tier claim", tone: "warning" });
  });

  it("names the booking by its event title", () => {
    const card = buildBookingCard({ ...totals, rows: [row()], now });
    expect(card.preview[0].label).toBe("Barangay Fiesta");
  });

  it("falls back to the reference when there is no title", () => {
    const card = buildBookingCard({
      ...totals,
      rows: [row({ event_title: null })],
      now,
    });
    expect(card.preview[0].label).toBe("BK-2026-000037");
  });

  it("survives a row with no submitted_at", () => {
    const card = buildBookingCard({
      ...totals,
      rows: [row({ submitted_at: null })],
      now,
    });
    expect(card.preview[0].tag.text).toBe("needs quote");
  });

  it("produces an empty preview when nothing needs action", () => {
    const card = buildBookingCard({
      awaitingQuote: 0,
      paymentVerification: 0,
      balanceOutstanding: 0,
      rows: [],
      now,
    });
    expect(card.preview).toEqual([]);
  });
});
