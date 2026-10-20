import { describe, expect, it } from "vitest";
import {
  deskMoves,
  type DeskMoves,
  type TierReview,
} from "./desk-moves";
import type {
  Booking,
  BookingDocument,
  BookingPayment,
} from "../types";
import type { StaffUser } from "@/portals/staff/features/auth/types";

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: "bk-1",
    reference_number: "BK-2026-000031",
    status: "awaiting_payment",
    cancellation_reason: null,
    event_title: "Dela Cruz Family 50th Wedding Anniversary",
    event_type_label: "Wedding",
    venue_code: "atrium",
    venue_label: "Atrium",
    rate_tier: "commercial",
    tier_verified: false,
    organization_name: null,
    contact_person: "Juan Dela Cruz",
    estimated_headcount: 350,
    event_date: "2026-09-14",
    start_time: "09:00:00",
    duration_hours: 8,
    total_fee: 40800,
    balance_amount: 20400,
    hold_expires_at: null,
    submitted_at: "2026-08-09T07:55:20+00:00",
    unverified_payment_count: 0,
    event_type_code: "wedding",
    classification_code: "commercial",
    special_requirements: null,
    contact_number: "09171234567",
    email_address: "juan.testcitizen@gmail.com",
    is_resident: false,
    origin_barangay_code: null,
    origin_locality: null,
    rehearsal_rate_type: null,
    downpayment_pct: 50,
    downpayment_amount: 20400,
    quoted_by_name: null,
    quoted_at: null,
    terms_accepted_at: "2026-08-09T07:55:20+00:00",
    confirmed_at: null,
    balance_settled_at: null,
    completed_at: null,
    payment_count: 0,
    document_count: 0,
    tier_review_look: null,
    tier_review_since: null,
    tier_revision_reason: null,
    ...over,
  };
}

function payment(over: Partial<BookingPayment> = {}): BookingPayment {
  return {
    id: "pay-1",
    kind: "downpayment",
    method: "gcash",
    amount: 20400,
    gcash_reference: "0009988776",
    official_receipt_no: null,
    paid_at: "2026-08-10T09:00:00+08:00",
    submitted_at: "2026-08-10T09:01:00+08:00",
    recorded_by_name: null,
    verified_by_name: null,
    verified_at: null,
    rejected_reason: null,
    receipt_document_id: "doc-2",
    ...over,
  };
}

function document(over: Partial<BookingDocument> = {}): BookingDocument {
  return {
    id: "doc-1",
    kind: "org_document",
    payment_id: null,
    uploaded_at: "2026-08-09T08:00:00+08:00",
    mime_type: "application/pdf",
    size_bytes: 120000,
    verified_by_name: null,
    verified_at: null,
    superseded_by: null,
    ...over,
  };
}

function staff(is_supervisor: boolean): StaffUser {
  return {
    id: is_supervisor ? "staff-1" : "staff-2",
    email: "staff@lucena.gov.ph",
    full_name: "Maria Santos",
    role: "staff",
    department: "Convention Center",
    assignedModules: ["booking"],
    is_supervisor,
    created_at: "2026-01-01T00:00:00+08:00",
  };
}

/** 11 August 2026, mid-morning in Manila. Every row below is measured against it. */
const NOW = new Date("2026-08-11T10:00:00+08:00");

/**
 * Every gate shut. Each row spreads this and names only the gates it opens, so
 * a row reads as "this is what the desk can do here" rather than as six lines
 * of `false`. Nothing is lost by it: the assertion is `toEqual` against the
 * whole record, so a gate a row forgets to open still fails the row.
 */
const NOTHING: DeskMoves = {
  quoting: false,
  reviewingDocument: null,
  verifyingPayment: [],
  recordingBalance: { kind: "none" },
  rejecting: false,
  completing: false,
  anyOpen: false,
};

/** The undecided downpayment several of the rows below share. */
const undecided = payment();

/** A payment whose accept nothing holds. */
const OPEN = { kind: "open" } as const;

/**
 * The review gate as most rows see it: a document on file, on its first look.
 */
function claim(over: Partial<TierReview> = {}): TierReview {
  return {
    hasOrgDocument: true,
    decline: "revise",
    ...over,
  };
}

/** A discounted booking waiting on Tier Review: no Hold, a queue stamp. */
const inTierReview: Partial<Booking> = {
  status: "awaiting_tier_review",
  rate_tier: "discounted",
  hold_expires_at: null,
  tier_review_since: "2026-08-10T09:00:00+08:00",
};

interface Row {
  name: string;
  booking?: Partial<Booking>;
  payments?: BookingPayment[];
  documents?: BookingDocument[];
  supervisor?: boolean;
  expected: DeskMoves;
}

/**
 * Status × rate tier × supervisor × ledger state, in one table.
 *
 * These rows are where the six gates are asserted. Until #52 five of them were
 * asserted by rendering the detail page and looking for a button, which is an
 * expensive way to test a boolean and could not reach the combinations below
 * at all — a discounted booking at four statuses, a ledger holding a rejected
 * downpayment, a confirmed booking with no quoted balance.
 */
const rows: Row[] = [
  {
    name: "quotes and rejects a commercial booking awaiting its quote",
    booking: { status: "awaiting_quote", total_fee: null, balance_amount: null },
    expected: { ...NOTHING, quoting: true, rejecting: true, anyOpen: true },
  },
  {
    name: "quotes an accepted Full Facility claim, and reviews nothing more",
    // review_booking(accept) sends a discounted Full Facility booking on to
    // Quote. The claim is decided; the price is what is left (l77b).
    booking: {
      status: "awaiting_quote",
      rate_tier: "discounted",
      tier_verified: true,
      total_fee: null,
    },
    documents: [document({ verified_at: "2026-08-10T10:00:00+08:00" })],
    expected: { ...NOTHING, quoting: true, rejecting: true, anyOpen: true },
  },
  {
    name: "reviews a Tier Claim on its first look, offering a Revision Request",
    // SCRUM-198. The first look cannot reject: a blurry scan earns a Revision
    // Request, not full price. Which look this is is the server's to say.
    booking: { ...inTierReview, tier_review_look: 1 },
    documents: [document()],
    expected: {
      ...NOTHING,
      reviewingDocument: claim({ decline: "revise" }),
      rejecting: true,
      anyOpen: true,
    },
  },
  {
    name: "reviews a Resubmission on its second look, offering a reject",
    booking: {
      ...inTierReview,
      tier_review_look: 2,
      tier_revision_reason: "The scan is unreadable.",
    },
    documents: [
      document({ id: "doc-old", superseded_by: "doc-new" }),
      document({ id: "doc-new" }),
    ],
    expected: {
      ...NOTHING,
      reviewingDocument: claim({ decline: "reject" }),
      rejecting: true,
      anyOpen: true,
    },
  },
  {
    name: "falls back to the Revision Request when the server reports no look",
    // Fail safe: the RPC refuses the wrong one of revise/reject anyway, and
    // offering a correction is the choice that costs the citizen nothing.
    booking: { ...inTierReview, tier_review_look: null },
    documents: [document()],
    expected: {
      ...NOTHING,
      reviewingDocument: claim({ decline: "revise" }),
      rejecting: true,
      anyOpen: true,
    },
  },
  {
    name: "does not count a superseded organisation document as the current one",
    booking: { ...inTierReview, tier_review_look: 1 },
    documents: [document({ id: "doc-old", superseded_by: "doc-new" })],
    expected: {
      ...NOTHING,
      reviewingDocument: claim({ hasOrgDocument: false }),
      rejecting: true,
      anyOpen: true,
    },
  },
  {
    name: "does not count a GCash receipt as an organisation document",
    booking: { ...inTierReview, tier_review_look: 1 },
    documents: [document({ id: "doc-2", kind: "gcash_receipt" })],
    expected: {
      ...NOTHING,
      reviewingDocument: claim({ hasOrgDocument: false }),
      rejecting: true,
      anyOpen: true,
    },
  },
  {
    name: "offers no review while a Revision Request waits on the citizen, only the reject",
    // awaiting_resubmission is the organiser's turn. reject_booking stays for
    // abuse (l77b); review_booking refuses outside awaiting_tier_review.
    booking: {
      status: "awaiting_resubmission",
      rate_tier: "discounted",
      hold_expires_at: "2026-08-14T10:00:00+08:00",
      tier_revision_reason: "The scan is unreadable.",
    },
    documents: [document()],
    expected: { ...NOTHING, rejecting: true, anyOpen: true },
  },
  {
    name: "offers only the reject on a discounted booking still waiting for its document",
    // `pending` is reachable since l77b: a discounted booking between submit
    // and its upload. Nothing to review yet, but staff can still end it.
    booking: {
      status: "pending",
      rate_tier: "discounted",
      hold_expires_at: "2026-08-12T10:00:00+08:00",
    },
    payments: [undecided],
    documents: [document()],
    expected: { ...NOTHING, rejecting: true, anyOpen: true },
  },
  {
    name: "offers no review once the claim is decided and payment is due",
    booking: { status: "awaiting_payment", rate_tier: "discounted", tier_verified: true },
    documents: [document({ verified_at: "2026-08-10T10:00:00+08:00" })],
    expected: { ...NOTHING, rejecting: true, anyOpen: true },
  },
  {
    name: "offers no discount review on a commercial booking — there is no claim",
    booking: { status: "awaiting_payment", rate_tier: "commercial" },
    documents: [document()],
    expected: { ...NOTHING, rejecting: true, anyOpen: true },
  },
  {
    name: "verifies the payment on an accepted claim, with no review beside it",
    // The normal path since l77b: the claim was decided before any money, so
    // payment verification never meets an undecided one.
    booking: {
      status: "payment_verification",
      rate_tier: "discounted",
      tier_verified: true,
    },
    payments: [undecided],
    documents: [document({ verified_at: "2026-08-10T10:00:00+08:00" })],
    expected: {
      ...NOTHING,
      verifyingPayment: [{ payment: undecided, accept: OPEN }],
      rejecting: true,
      anyOpen: true,
    },
  },
  {
    name: "holds a payment for an amount the booking no longer asks for",
    // l71's backstop: a reprice landing mid-payment leaves a downpayment at the
    // old price, and verify_payment refuses to accept it.
    booking: { status: "payment_verification", downpayment_amount: 20400 },
    payments: [payment({ amount: 10200 })],
    expected: {
      ...NOTHING,
      verifyingPayment: [
        {
          payment: payment({ amount: 10200 }),
          accept: { kind: "blocked", reason: "amount_stale" },
        },
      ],
      rejecting: true,
      anyOpen: true,
    },
  },
  {
    name: "stops reviewing the claim once the payment is verified",
    // confirmed. review_booking refuses everything outside
    // awaiting_tier_review (42501), and repricing here would rewrite an
    // amount the city has receipted.
    booking: {
      status: "confirmed",
      rate_tier: "discounted",
      balance_amount: null,
    },
    documents: [document()],
    expected: { ...NOTHING },
  },
  {
    name: "verifies every undecided downpayment, one control each",
    // verify_payment takes a payment id, and a booking can carry more than one
    // attempt.
    booking: { status: "payment_verification" },
    payments: [undecided, payment({ id: "pay-2" })],
    expected: {
      ...NOTHING,
      verifyingPayment: [
        { payment: undecided, accept: OPEN },
        { payment: payment({ id: "pay-2" }), accept: OPEN },
      ],
      rejecting: true,
      anyOpen: true,
    },
  },
  {
    name: "treats a verified downpayment as decided",
    booking: { status: "payment_verification" },
    payments: [payment({ verified_at: "2026-08-10T11:00:00+08:00" })],
    expected: { ...NOTHING, rejecting: true, anyOpen: true },
  },
  {
    name: "treats a rejected downpayment as decided too",
    // Undecided means NEITHER verified nor rejected. A bounced receipt is
    // waiting on the citizen, not on this desk.
    booking: { status: "payment_verification" },
    payments: [payment({ rejected_reason: "Reference number does not match." })],
    expected: { ...NOTHING, rejecting: true, anyOpen: true },
  },
  {
    name: "does not offer to verify a balance payment as if it were a downpayment",
    booking: { status: "payment_verification" },
    payments: [payment({ id: "pay-bal", kind: "balance", method: "cash" })],
    expected: { ...NOTHING, rejecting: true, anyOpen: true },
  },
  {
    name: "ignores an undecided downpayment on a booking past the review",
    booking: { status: "confirmed" },
    payments: [undecided],
    supervisor: true,
    expected: {
      ...NOTHING,
      recordingBalance: { kind: "open", amount: 20400 },
      anyOpen: true,
    },
  },
  {
    name: "hands a supervisor the balance to record, with the amount beside it",
    booking: { status: "confirmed", balance_amount: 20400 },
    supervisor: true,
    expected: {
      ...NOTHING,
      recordingBalance: { kind: "open", amount: 20400 },
      anyOpen: true,
    },
  },
  {
    name: "blocks a clerk from the same balance, and the card still opens",
    // The trap this module was written for. A plain boolean here leaves a
    // non-supervisor with no open gate, no Actions card, and no sentence on
    // screen saying why the control is absent.
    booking: { status: "confirmed", balance_amount: 20400 },
    supervisor: false,
    expected: {
      ...NOTHING,
      recordingBalance: { kind: "blocked", reason: "supervisor_only" },
      anyOpen: true,
    },
  },
  {
    name: "offers no balance to record when none has been quoted",
    booking: { status: "confirmed", balance_amount: null },
    supervisor: true,
    expected: { ...NOTHING },
  },
  {
    name: "offers nothing on a confirmed booking to a clerk with no balance quoted",
    booking: { status: "confirmed", balance_amount: null },
    supervisor: false,
    expected: { ...NOTHING },
  },
  {
    name: "completes a fully paid booking whose event has passed",
    booking: { status: "fully_paid", event_date: "2026-08-10" },
    expected: { ...NOTHING, completing: true, anyOpen: true },
  },
  {
    name: "does not complete a booking on its own event day",
    // complete_booking compares against the Manila calendar date, so an event
    // happening today is not over yet.
    booking: { status: "fully_paid", event_date: "2026-08-11" },
    expected: { ...NOTHING },
  },
  {
    name: "does not complete an event still to come",
    booking: { status: "fully_paid", event_date: "2026-09-14" },
    expected: { ...NOTHING },
  },
  {
    name: "does not complete a confirmed booking, however old the event",
    booking: { status: "confirmed", event_date: "2026-08-10", balance_amount: null },
    supervisor: true,
    expected: { ...NOTHING },
  },
  {
    name: "never rejects past the commit line — a confirmed booking",
    // Decision 6, and the thing most likely to be quietly relaxed later.
    booking: { status: "confirmed", balance_amount: null },
    expected: { ...NOTHING },
  },
  {
    name: "offers nothing at all on a completed booking",
    booking: { status: "completed", event_date: "2026-08-10" },
    expected: { ...NOTHING },
  },
  {
    name: "offers nothing at all on a cancelled booking",
    booking: {
      status: "cancelled",
      cancellation_reason: "expired_unpaid",
      event_date: "2026-08-10",
    },
    expected: { ...NOTHING },
  },
];

describe("deskMoves", () => {
  for (const row of rows) {
    it(row.name, () => {
      expect(
        deskMoves({
          booking: booking(row.booking),
          payments: row.payments ?? [],
          documents: row.documents ?? [],
          user: staff(row.supervisor ?? true),
          now: NOW,
        }),
      ).toEqual(row.expected);
    });
  }

  it("counts the supervisor-blocked balance as an open gate", () => {
    // Said once more outside the table, because it is the one place where
    // `anyOpen` is not simply "some control will render" — the thing that
    // renders is a sentence, and it is the route's.
    const moves = deskMoves({
      booking: booking({ status: "confirmed", balance_amount: 20400 }),
      payments: [],
      documents: [],
      user: staff(false),
      now: NOW,
    });
    expect(moves.recordingBalance).toEqual({
      kind: "blocked",
      reason: "supervisor_only",
    });
    expect(moves.anyOpen).toBe(true);
  });

  it("reads its moment from the argument rather than the wall clock", () => {
    // ADR-0005: the render-top makes the clock and hands it over. A module
    // that reached for `new Date()` would answer differently on the day the
    // event happens, and this assertion would be impossible to write.
    const bk = booking({ status: "fully_paid", event_date: "2026-08-11" });
    const args = { payments: [], documents: [], user: staff(true) };
    expect(deskMoves({ booking: bk, ...args, now: NOW }).completing).toBe(false);
    expect(
      deskMoves({
        booking: bk,
        ...args,
        now: new Date("2026-08-12T00:30:00+08:00"),
      }).completing,
    ).toBe(true);
  });
});
