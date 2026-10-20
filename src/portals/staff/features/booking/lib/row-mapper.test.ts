import { describe, expect, it } from "vitest";
import {
  countByStatus,
  toBooking,
  toDocument,
  toEvent,
  toPayment,
  toQueueItem,
  type StaffBookingQueueRow,
  type StaffBookingRow,
} from "./row-mapper";

function queueRow(over: Partial<StaffBookingQueueRow> = {}): StaffBookingQueueRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    reference_number: "BK-2026-000031",
    status: "awaiting_payment",
    cancellation_reason: null,
    event_title: "Foundation Day",
    event_type_label: "Conference",
    venue_code: "atrium",
    venue_label: "Atrium",
    rate_tier: "commercial",
    tier_verified: false,
    organization_name: "Lucena Chamber",
    contact_person: "Ana Reyes",
    estimated_headcount: 400,
    event_date: "2026-09-14",
    start_time: "08:00:00",
    duration_hours: 8,
    total_fee: 40800,
    balance_amount: 20400,
    hold_expires_at: "2026-08-14T10:00:00+08:00",
    submitted_at: "2026-08-11T10:00:00+08:00",
    unverified_payment_count: 0,
    tier_review_since: null,
    ...over,
  };
}

describe("toQueueItem", () => {
  it("passes a complete row through", () => {
    expect(toQueueItem(queueRow()).reference_number).toBe("BK-2026-000031");
  });

  it("throws when id is missing", () => {
    // id keys the row and builds its link. A row without one is not degraded
    // data, it is evidence the query is wrong.
    expect(() => toQueueItem(queueRow({ id: null }))).toThrow(/no id/);
  });

  it("throws when status is missing", () => {
    // status decides which of six controls render. Guessing would offer an
    // operator a button the RPC will refuse.
    expect(() => toQueueItem(queueRow({ status: null }))).toThrow(/no status/);
  });

  it("throws when rate_tier is missing", () => {
    // The tier decides whether a discount claim needs verifying at all.
    expect(() => toQueueItem(queueRow({ rate_tier: null }))).toThrow(/no rate tier/);
  });

  it("keeps a null total_fee as null, never as zero", () => {
    // An awaiting_quote booking has no price yet. Coercing to 0 would render
    // it as free and, worse, make the quote screen look already answered.
    const item = toQueueItem(
      queueRow({ status: "awaiting_quote", total_fee: null, balance_amount: null }),
    );
    expect(item.total_fee).toBeNull();
    expect(item.balance_amount).toBeNull();
  });

  it("degrades cosmetic nulls rather than throwing", () => {
    const item = toQueueItem(
      queueRow({
        event_title: null,
        venue_label: null,
        event_type_label: null,
        reference_number: null,
      }),
    );
    expect(item.event_title).toBe("Untitled event");
    expect(item.venue_label).toBe("Unknown venue");
    expect(item.event_type_label).toBe("—");
    expect(item.reference_number).toBe("—");
  });

  it("treats a null tier_verified as unverified", () => {
    // Fail safe: an unreadable verification state must never present a
    // discount as substantiated.
    expect(toQueueItem(queueRow({ tier_verified: null })).tier_verified).toBe(false);
  });

  it("treats a null unverified_payment_count as zero", () => {
    expect(
      toQueueItem(queueRow({ unverified_payment_count: null }))
        .unverified_payment_count,
    ).toBe(0);
  });
});

describe("toBooking", () => {
  function detailRow(over: Partial<StaffBookingRow> = {}): StaffBookingRow {
    return {
      ...queueRow(),
      event_type_code: "conference",
      classification_code: "commercial",
      special_requirements: null,
      contact_number: "0917-000-0000",
      email_address: "ana@example.com",
      is_resident: true,
      origin_barangay_code: "cotta",
      origin_locality: null,
      rehearsal_rate_type: null,
      downpayment_pct: 50,
      downpayment_amount: 20400,
      quoted_by_name: null,
      quoted_at: null,
      terms_accepted_at: "2026-08-11T10:00:00+08:00",
      confirmed_at: null,
      balance_settled_at: null,
      completed_at: null,
      payment_count: 0,
      document_count: 0,
      tier_review_look: null,
      tier_revision_reason: null,
      ...over,
    };
  }

  it("returns null for a null row", () => {
    // notFound() is the page's job, not the mapper's.
    expect(toBooking(null)).toBeNull();
  });

  it("carries the detail fields", () => {
    expect(toBooking(detailRow())?.email_address).toBe("ana@example.com");
  });

  it("zero-fills both counts", () => {
    // The third count, unverified_payment_count, lives on the queue shape and
    // is covered above.
    const booking = toBooking(detailRow({ payment_count: null, document_count: null }));
    expect(booking?.payment_count).toBe(0);
    expect(booking?.document_count).toBe(0);
  });
});

describe("toPayment", () => {
  it("throws when amount is missing", () => {
    // A payment row with no amount cannot be reconciled against
    // balance_amount, and record_balance_payment demands an exact match.
    expect(() =>
      toPayment({
        id: "p1",
        kind: "downpayment",
        method: "gcash",
        amount: null,
        gcash_reference: "ABC",
        official_receipt_no: null,
        paid_at: null,
        submitted_at: "2026-08-11T10:00:00+08:00",
        recorded_by_name: null,
        verified_by_name: null,
        verified_at: null,
        rejected_reason: null,
        receipt_document_id: null,
      }),
    ).toThrow(/no amount/);
  });

  it("keeps receipt_document_id null when no proof was attached", () => {
    // A balance recorded at the cashier's window has an OR number and no
    // uploaded image. The receipt button must not render for it.
    const payment = toPayment({
      id: "p2",
      kind: "balance",
      method: "cash",
      amount: 20400,
      gcash_reference: null,
      official_receipt_no: "OR-9001",
      paid_at: "2026-09-01",
      submitted_at: "2026-09-01T09:00:00+08:00",
      recorded_by_name: "Juan Dela Cruz",
      verified_by_name: "Juan Dela Cruz",
      verified_at: "2026-09-01T09:00:00+08:00",
      rejected_reason: null,
      receipt_document_id: null,
    });
    expect(payment.receipt_document_id).toBeNull();
    expect(payment.official_receipt_no).toBe("OR-9001");
  });
});

describe("toDocument", () => {
  it("throws when uploaded_at is null", () => {
    // staff_booking_documents filters `uploaded_at is not null`. A null here
    // means the query hit something other than that view.
    expect(() =>
      toDocument({
        id: "d1",
        kind: "org_document",
        payment_id: null,
        uploaded_at: null,
        mime_type: null,
        size_bytes: null,
        verified_by_name: null,
        verified_at: null,
        superseded_by: null,
      }),
    ).toThrow(/uploaded_at/);
  });
});

describe("toEvent", () => {
  it("names an actor the view could not resolve", () => {
    const event = toEvent({
      id: "e1",
      event_type: "quoted",
      actor_role: null,
      actor_name: null,
      note: null,
      created_at: "2026-08-11T10:00:00+08:00",
    });
    expect(event.actor_name).toBe("Unknown");
    expect(event.actor_role).toBe("system");
  });

  it("keeps an event_type nobody has seen before", () => {
    // The column is text with no constraint. Dropping the row would hide a
    // real thing that happened; status.ts humanises the label instead.
    expect(
      toEvent({
        id: "e2",
        event_type: "slot_released",
        actor_role: "system",
        actor_name: "System",
        note: null,
        created_at: "2026-08-11T10:00:00+08:00",
      }).event_type,
    ).toBe("slot_released");
  });

  it("throws when event_type is missing entirely", () => {
    expect(() =>
      toEvent({
        id: "e3",
        event_type: null,
        actor_role: "staff",
        actor_name: "Juan",
        note: null,
        created_at: "2026-08-11T10:00:00+08:00",
      }),
    ).toThrow(/event_type/);
  });
});

describe("countByStatus", () => {
  it("counts every status and zero-fills the rest", () => {
    const counts = countByStatus([
      { status: "awaiting_quote" },
      { status: "confirmed" },
      { status: "confirmed" },
      { status: null },
    ]);
    expect(counts.confirmed).toBe(2);
    expect(counts.awaiting_quote).toBe(1);
    // Unreachable, and therefore always zero — but present, because the tab is.
    expect(counts.pending).toBe(0);
  });
});
