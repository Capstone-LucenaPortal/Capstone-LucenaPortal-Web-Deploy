import { afterEach, describe, expect, it, vi } from "vitest";
import {
  columnsOf,
  createTableFetch,
  createTestClient,
  requestTo,
} from "@/portals/staff/lib/supabase/testing";
import * as catalogs from "@/portals/staff/lib/supabase/catalogs";
import * as rateCard from "./rate-card";
import { getBookingDossier } from "./booking-dossier";
import type { RateCard } from "./rate-card";
import type {
  StaffBookingDocumentRow,
  StaffBookingEventRow,
  StaffBookingPaymentRow,
  StaffBookingQueueRow,
  StaffBookingRow,
} from "./row-mapper";

const BOOKING_ID = "000000bc-0000-4004-8000-000000000031";

/**
 * The same booking the detail page test renders, BK-2026-000031, on purpose:
 * a reader comparing an assertion here against one there is comparing the same
 * booking. That file holds the mapped `Booking`; this one holds the row it is
 * mapped from, because what is under test here is the request that fetches it.
 */
const CANNED_QUEUE_ROW: StaffBookingQueueRow = {
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
  tier_review_since: null,
};

const CANNED_BOOKING_ROW: StaffBookingRow = {
  ...CANNED_QUEUE_ROW,
  id: BOOKING_ID,
  event_type_code: "wedding",
  classification_code: "commercial",
  special_requirements: "Round tables for 350 guests.",
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
  payment_count: 1,
  document_count: 1,
  tier_review_look: null,
  tier_revision_reason: null,
};

const CANNED_PAYMENT_ROW: StaffBookingPaymentRow = {
  id: "payment-1",
  kind: "downpayment",
  method: "gcash",
  amount: 20400,
  gcash_reference: "9876543210",
  official_receipt_no: null,
  paid_at: "2026-08-10T02:14:00.000000+00:00",
  submitted_at: "2026-08-10T02:15:00.000000+00:00",
  recorded_by_name: null,
  verified_by_name: null,
  verified_at: null,
  rejected_reason: null,
  receipt_document_id: "document-2",
};

const CANNED_DOCUMENT_ROW: StaffBookingDocumentRow = {
  id: "document-1",
  kind: "org_document",
  payment_id: null,
  uploaded_at: "2026-08-09T08:10:00.000000+00:00",
  mime_type: "application/pdf",
  size_bytes: 512_000,
  verified_by_name: null,
  verified_at: null,
  superseded_by: null,
};

const CANNED_EVENT_ROW: StaffBookingEventRow = {
  id: "event-1",
  event_type: "submitted",
  actor_role: "citizen",
  actor_name: "Juan Dela Cruz",
  note: null,
  created_at: "2026-08-09T07:55:20.000000+00:00",
};

const BOOKINGS = "staff_bookings";
const PAYMENTS = "staff_booking_payments";
const DOCUMENTS = "staff_booking_documents";
const EVENTS = "staff_booking_events";

/** The one field of the catalogue this screen needs a label out of. */
const CLASSIFICATIONS = {
  commercial: "Commercial / Private",
  government: "Government",
};

/**
 * The card the screen prices against. The three keying rules that read it are
 * tested against it directly in rate-card.test.ts; here it only has to be a
 * card, so that the reference fee this dossier carries is a real one.
 */
const RATE_CARD: RateCard = {
  venueRates: {
    "atrium:commercial": {
      venue_code: "atrium",
      tier: "commercial",
      base_fee: 60000,
      extension_hourly: 9000,
      hourly_rate: null,
      requires_quote: false,
    },
  },
  venueIsHourly: { atrium: false, rehearsal_practice: true },
  rehearsalRates: {
    with_ac: { code: "with_ac", label: "With Air Conditioning", hourly_rate: 15000 },
  },
};

/**
 * All four tables answered, so one call drives every read the dossier makes.
 * The reads whose query shape is asserted below do not care what comes back,
 * only that they fired.
 *
 * This stays local while `createTableFetch` does not: it names this module's
 * four tables and this file's canned rows, so there is nothing in it two
 * dossiers could share. See carried-forward item 7.
 */
function createFullDossierFetch() {
  return createTableFetch({
    [BOOKINGS]: [CANNED_BOOKING_ROW],
    [PAYMENTS]: [CANNED_PAYMENT_ROW],
    [DOCUMENTS]: [CANNED_DOCUMENT_ROW],
    [EVENTS]: [CANNED_EVENT_ROW],
  });
}

/**
 * Two modules mocked beside the recording fetch, where Incidents mocks one.
 *
 * `getLabels` is `cache()`-wrapped and `getRateCard` fans out to three readers
 * that are, so neither can take a `db` seam — ADR-0001's rule. The rate card
 * therefore has to be a sibling module rather than three private readers in
 * this file: a `cache()`-wrapped reader inside the dossier module could take
 * neither the seam nor a module mock, and would be unreachable from any test.
 * See ADR-0006, and ADR-0003 on why one file using two mechanisms is forced
 * rather than untidy.
 */
function stubCatalogues({
  classifications = CLASSIFICATIONS,
  card = RATE_CARD,
}: { classifications?: Record<string, string>; card?: RateCard } = {}) {
  return {
    getLabels: vi.spyOn(catalogs, "getLabels").mockResolvedValue(classifications),
    getRateCard: vi.spyOn(rateCard, "getRateCard").mockResolvedValue(card),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getBookingDossier", () => {
  it("returns nothing when the booking does not exist or is not visible", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({});

    expect(await getBookingDossier(BOOKING_ID, createTestClient(fetch))).toBeNull();
  });

  /**
   * The two-phase guarantee. An id that resolves to nothing costs one round
   * trip, not five — and neither catalogue is read for a booking that is not
   * there.
   */
  it("does not fire the other reads when there is nothing to show", async () => {
    const { getLabels, getRateCard } = stubCatalogues();
    const { fetch, requests } = createTableFetch({});

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(requests.map((request) => request.table)).toEqual([BOOKINGS]);
    expect(getLabels).not.toHaveBeenCalled();
    expect(getRateCard).not.toHaveBeenCalled();
  });

  it("carries the booking, its ledger, its documents and its whole history", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    const dossier = await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(requests.map((request) => request.table).sort()).toEqual(
      [BOOKINGS, PAYMENTS, DOCUMENTS, EVENTS].sort(),
    );
    expect(dossier?.booking.reference_number).toBe("BK-2026-000031");
    expect(dossier?.payments).toHaveLength(1);
    expect(dossier?.payments[0].amount).toBe(20400);
    expect(dossier?.documents).toHaveLength(1);
    expect(dossier?.documents[0].kind).toBe("org_document");
    expect(dossier?.events).toHaveLength(1);
    expect(dossier?.events[0].actor_name).toBe("Juan Dela Cruz");
  });

  /**
   * Flat, and the labels named beside the booking rather than folded onto it.
   * Two things the route needs are absent on purpose: the current staff user
   * answers "who is looking", and the booking config is a fact about the
   * office rather than about this booking.
   */
  it("names the labels beside the booking rather than folding them onto it", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({ [BOOKINGS]: [CANNED_BOOKING_ROW] });

    const dossier = await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(Object.keys(dossier!).sort()).toEqual([
      "booking",
      "classificationLabel",
      "commercialReference",
      "documents",
      "events",
      "payments",
      "rateTypeLabel",
    ]);
    expect(dossier!.booking).not.toHaveProperty("classificationLabel");
  });

  it("labels the classification from the catalogue", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({ [BOOKINGS]: [CANNED_BOOKING_ROW] });

    const dossier = await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(dossier?.classificationLabel).toBe("Commercial / Private");
  });

  /**
   * From the rehearsal-rates view rather than a hand-written map — Super Staff
   * can rename or add a rate type. It is the one display string the rate card
   * carries, which is why it is resolved here and the fee rules are not.
   */
  it("labels the rehearsal rate type from the rate card", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({
      [BOOKINGS]: [{ ...CANNED_BOOKING_ROW, rehearsal_rate_type: "with_ac" }],
    });

    const dossier = await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(dossier?.rateTypeLabel).toBe("With Air Conditioning");
  });

  /**
   * Resolution is ours, presentation is the caller's. A null code has nothing
   * to resolve, so it stays null and the route supplies the em dash — the same
   * line that kept "None suggested" out of the Incidents dossier.
   */
  it("reports an absent code as null rather than as the screen's copy", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({
      [BOOKINGS]: [
        {
          ...CANNED_BOOKING_ROW,
          classification_code: null,
          rehearsal_rate_type: null,
        },
      ],
    });

    const dossier = await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(dossier?.classificationLabel).toBeNull();
    expect(dossier?.rateTypeLabel).toBeNull();
  });

  it("falls back to the raw code when the catalogue has no label for it", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({
      [BOOKINGS]: [
        {
          ...CANNED_BOOKING_ROW,
          classification_code: "civic",
          rehearsal_rate_type: "no_ac_dawn",
        },
      ],
    });

    const dossier = await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(dossier?.classificationLabel).toBe("civic");
    expect(dossier?.rateTypeLabel).toBe("no_ac_dawn");
  });

  /**
   * `getLabels` swallows its own read failure and returns an empty map, so a
   * catalogue the clerk cannot reach degrades to the raw code by the same route
   * a missing entry does. A blank field would hide that the booking is
   * classified at all.
   */
  it("falls back to the raw code when the catalogue read failed", async () => {
    stubCatalogues({ classifications: {} });
    const { fetch } = createTableFetch({ [BOOKINGS]: [CANNED_BOOKING_ROW] });

    const dossier = await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(dossier?.classificationLabel).toBe("commercial");
  });

  /**
   * The same booking priced at the COMMERCIAL tier, for the quote screen to
   * anchor against. Eight hours at the atrium: ₱60,000 for the first six, plus
   * two extension hours at ₱9,000.
   */
  it("prices the booking at the commercial tier", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({ [BOOKINGS]: [CANNED_BOOKING_ROW] });

    const dossier = await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(dossier?.commercialReference).toEqual({
      amount: 78000,
      requiresQuote: false,
      unknown: false,
    });
  });

  /**
   * Resolved for every booking, including one no quote form will ever render.
   * Making it conditional would put "which statuses can be quoted" inside the
   * dossier, and that belongs to the route's guard tables.
   */
  it("prices a booking that can no longer be quoted", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({
      [BOOKINGS]: [{ ...CANNED_BOOKING_ROW, status: "completed" }],
    });

    const dossier = await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(dossier?.commercialReference.amount).toBe(78000);
  });

  /**
   * Two ordinary first states, not failures: a booking nothing has been paid
   * against, and one with no document attached. The payments card renders its
   * own empty state.
   */
  it("reports no payments, documents or events as empty rather than as missing", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({ [BOOKINGS]: [CANNED_BOOKING_ROW] });

    const dossier = await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(dossier?.payments).toEqual([]);
    expect(dossier?.documents).toEqual([]);
    expect(dossier?.events).toEqual([]);
  });

  /**
   * A failed read must not be mistaken for a missing booking: that renders a
   * 404 over a row that is sitting right there.
   */
  it("raises when the booking read fails rather than reporting nothing to show", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({}, {
      table: BOOKINGS,
      message: "permission denied for view staff_bookings",
    });

    await expect(
      getBookingDossier(BOOKING_ID, createTestClient(fetch)),
    ).rejects.toThrow(/staff_bookings detail read failed: permission denied/);
  });

  /**
   * Partial degradation is rejected, as ADR-0003 decided. An empty ledger on a
   * booking whose row says a downpayment is waiting to be verified prints the
   * affirmative sentence "nobody has paid anything", on the screen where the
   * clerk decides whether the money arrived.
   */
  it("raises when the payment read fails rather than rendering an empty ledger", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({ [BOOKINGS]: [CANNED_BOOKING_ROW] }, {
      table: PAYMENTS,
      message: "permission denied for view staff_booking_payments",
    });

    await expect(
      getBookingDossier(BOOKING_ID, createTestClient(fetch)),
    ).rejects.toThrow(/staff_booking_payments read failed: permission denied/);
  });

  it("raises when the document read fails rather than rendering an empty list", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({ [BOOKINGS]: [CANNED_BOOKING_ROW] }, {
      table: DOCUMENTS,
      message: "permission denied for view staff_booking_documents",
    });

    await expect(
      getBookingDossier(BOOKING_ID, createTestClient(fetch)),
    ).rejects.toThrow(/staff_booking_documents read failed: permission denied/);
  });

  it("raises when the event read fails rather than showing an empty history", async () => {
    stubCatalogues();
    const { fetch } = createTableFetch({ [BOOKINGS]: [CANNED_BOOKING_ROW] }, {
      table: EVENTS,
      message: "permission denied for view staff_booking_events",
    });

    await expect(
      getBookingDossier(BOOKING_ID, createTestClient(fetch)),
    ).rejects.toThrow(/staff_booking_events read failed: permission denied/);
  });
});

// ---------------------------------------------------------------------------
// The four composed reads. Private to this module, so their query shapes are
// asserted through the dossier — the only way in that is left. None of these
// was asserted at all before: all four built their own client, so no wire test
// could see them.
// ---------------------------------------------------------------------------

describe("getBookingDossier — the booking read", () => {
  it("reads the staff_bookings view", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    requestTo(requests, BOOKINGS);
  });

  /**
   * Every field the desk uses to price, verify and audit a booking, so a
   * refactor must not quietly drop one. This list was derived by concatenating
   * the queue's onto nineteen more until now, which is why it had no assertion
   * — adding a column here is meant to cost something: it sends the author back
   * to verify the name against the live view first. See ADR-0004 and ADR-0006
   * for what untying it from the queue's gave up.
   */
  it("selects the exact column list", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(columnsOf(requestTo(requests, BOOKINGS))).toEqual([
      "id",
      "reference_number",
      "status",
      "cancellation_reason",
      "event_title",
      "event_type_label",
      "venue_code",
      "venue_label",
      "rate_tier",
      "tier_verified",
      "organization_name",
      "contact_person",
      "estimated_headcount",
      "event_date",
      "start_time",
      "duration_hours",
      "total_fee",
      "balance_amount",
      "hold_expires_at",
      "submitted_at",
      "unverified_payment_count",
      "event_type_code",
      "classification_code",
      "special_requirements",
      "contact_number",
      "email_address",
      "is_resident",
      "origin_barangay_code",
      "origin_locality",
      "rehearsal_rate_type",
      "downpayment_pct",
      "downpayment_amount",
      "quoted_by_name",
      "quoted_at",
      "terms_accepted_at",
      "confirmed_at",
      "balance_settled_at",
      "completed_at",
      "payment_count",
      "document_count",
      "tier_review_since",
      "tier_review_look",
      "tier_revision_reason",
    ]);
  });

  it("filters by the requested id", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(requestTo(requests, BOOKINGS).filters["id"]).toEqual([`eq.${BOOKING_ID}`]);
  });
});

describe("getBookingDossier — the payment read", () => {
  it("reads the staff_booking_payments view", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    requestTo(requests, PAYMENTS);
  });

  /**
   * Thirteen of the view's eighteen columns. The five left out are
   * `booking_id`, `reference_number`, `recorded_by`, `verified_by` and — the
   * one that matters — `citizen_id`. A uuid in a props object is a uuid that
   * ends up in a URL, and this office never needs to identify the citizen
   * beyond the contact fields the organiser typed themselves.
   */
  it("selects the exact column list", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(columnsOf(requestTo(requests, PAYMENTS))).toEqual([
      "id",
      "kind",
      "method",
      "amount",
      "gcash_reference",
      "official_receipt_no",
      "paid_at",
      "submitted_at",
      "recorded_by_name",
      "verified_by_name",
      "verified_at",
      "rejected_reason",
      "receipt_document_id",
    ]);
  });

  it("filters by booking_id", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(requestTo(requests, PAYMENTS).filters["booking_id"]).toEqual([
      `eq.${BOOKING_ID}`,
    ]);
  });

  /** The ledger, chronological — the order the money arrived in. */
  it("orders by submitted_at ascending", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(requestTo(requests, PAYMENTS).order).toBe("submitted_at.asc");
  });
});

describe("getBookingDossier — the document read", () => {
  it("reads the staff_booking_documents view", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    requestTo(requests, DOCUMENTS);
  });

  /** ⚠️ `size_bytes`, matching incident_photos and NOT yellow_card_documents. */
  it("selects the exact column list", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(columnsOf(requestTo(requests, DOCUMENTS))).toEqual([
      "id",
      "kind",
      "payment_id",
      "uploaded_at",
      "mime_type",
      "size_bytes",
      "verified_by_name",
      "verified_at",
      "superseded_by",
    ]);
  });

  it("filters by booking_id", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(requestTo(requests, DOCUMENTS).filters["booking_id"]).toEqual([
      `eq.${BOOKING_ID}`,
    ]);
  });

  /** Current document first. */
  it("orders by uploaded_at descending", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(requestTo(requests, DOCUMENTS).order).toBe("uploaded_at.desc");
  });

  /**
   * A superseded document is history the reviewer wants to see, and
   * review_booking leaves a rejected one in place so the citizen can supersede
   * it. Asserted as the absence of a filter, because the asymmetry with
   * `staff_bookings.document_count` — which counts current documents only — is
   * deliberate and is the thing a well-meaning edit would "fix".
   */
  it("does not filter out superseded documents", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(requestTo(requests, DOCUMENTS).filters).toEqual({
      booking_id: [`eq.${BOOKING_ID}`],
    });
  });
});

describe("getBookingDossier — the event read", () => {
  it("reads the staff_booking_events view", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    requestTo(requests, EVENTS);
  });

  /** ⚠️ There is no `cycle_number` — bookings have no reopen cycle. */
  it("selects the exact column list", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(columnsOf(requestTo(requests, EVENTS))).toEqual([
      "id",
      "event_type",
      "actor_role",
      "actor_name",
      "note",
      "created_at",
    ]);
  });

  it("filters by booking_id", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(requestTo(requests, EVENTS).filters["booking_id"]).toEqual([
      `eq.${BOOKING_ID}`,
    ]);
  });

  /** Oldest first — the order it happened in, which the timeline reads in. */
  it("orders by created_at ascending", async () => {
    stubCatalogues();
    const { fetch, requests } = createFullDossierFetch();

    await getBookingDossier(BOOKING_ID, createTestClient(fetch));

    expect(requestTo(requests, EVENTS).order).toBe("created_at.asc");
  });
});
