import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import BookingDetailPage from "./page";
import * as dossier from "@/portals/staff/features/booking/lib/booking-dossier";
import * as config from "@/portals/staff/features/booking/lib/config";
import * as session from "@/portals/staff/features/auth/lib/session";
import { DEFAULT_BOOKING_CONFIG } from "@/portals/staff/features/booking/lib/config";
import type { BookingDossier } from "@/portals/staff/features/booking/lib/booking-dossier";
import type { Booking } from "@/portals/staff/features/booking/types";

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));

// The six action controls are client components that call useRouter, so the
// mock has to supply it as well as notFound.
vi.mock("next/navigation", () => ({
  notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));

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
    payment_count: 0,
    document_count: 0,
    tier_review_look: null,
    tier_review_since: null,
    tier_revision_reason: null,
    ...over,
  };
}

/** The two labels the dossier resolves, which a case here may need to vary. */
type Labels = Partial<
  Pick<BookingDossier, "classificationLabel" | "rateTypeLabel">
>;

/**
 * Three spies where there were eight.
 *
 * Everything this screen is about one booking now arrives as one dossier, so
 * what is left beside it is the office's config and who is looking — the two
 * things ADR-0006 keeps out of it. If a case below needs a fourth stub, a read
 * is still reachable from the route and the conversion was incomplete.
 *
 * The labels are handed over ready-resolved because resolving them is the
 * dossier's job, and `booking-dossier.test.ts` owns both rules. What is left
 * here is what the route does with the answer.
 */
function stubReads(over: Partial<Booking> | null = {}, labels: Labels = {}) {
  vi.spyOn(dossier, "getBookingDossier").mockResolvedValue(
    over === null
      ? null
      : {
          booking: booking(over),
          payments: [],
          documents: [],
          events: [],
          classificationLabel: "Commercial / Private",
          rateTypeLabel: null,
          // Eight hours at the atrium's commercial rate: ₱60,000 for the first
          // six, plus two extension hours at ₱9,000. The keying that produces
          // it is tested in rate-card.test.ts; here it only has to be a real
          // reference for the quote form to anchor against.
          commercialReference: {
            amount: 78000,
            requiresQuote: false,
            unknown: false,
          },
          ...labels,
        },
  );
  vi.spyOn(config, "getBookingConfig").mockResolvedValue({
    ...DEFAULT_BOOKING_CONFIG,
  });
  vi.spyOn(session, "getCurrentStaffUser").mockResolvedValue({
    id: "staff-1",
    email: "staff@lucena.gov.ph",
    full_name: "Maria Santos",
    role: "staff",
    department: "Convention Center",
    assignedModules: ["booking"],
    is_supervisor: true,
    created_at: "2026-01-01T00:00:00+08:00",
  });
}

/**
 * Several cases below render more than once to compare statuses. Testing
 * Library only auto-cleans between TESTS, so without this the second render
 * lands beside the first and a "must not be present" assertion finds the
 * control from the previous status.
 */
const render1 = async (over: Partial<Booking> = {}, labels: Labels = {}) => {
  cleanup();
  stubReads(over, labels);
  return render(
    await BookingDetailPage({ params: Promise.resolve({ id: "bk-1" }) }),
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BookingDetailPage", () => {
  it("renders the header, reference and status", async () => {
    await render1();
    expect(
      screen.getByText("Dela Cruz Family 50th Wedding Anniversary"),
    ).toBeInTheDocument();
    expect(screen.getByText(/BK-2026-000031/)).toBeInTheDocument();
    expect(screen.getByText("Awaiting Payment")).toBeInTheDocument();
  });

  it("404s when the booking is not visible", async () => {
    stubReads(null);
    await expect(
      BookingDetailPage({ params: Promise.resolve({ id: "nope" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders the classification label the dossier resolved", async () => {
    // Which catalogue that label came from, and what happens when it has no
    // entry, are the dossier's rules and are tested there.
    await render1();
    expect(screen.getByText("Commercial / Private")).toBeInTheDocument();
  });

  /**
   * The em dash is this screen's copy for a booking with no classification code
   * at all, which is why the dossier reports that case as null rather than
   * resolving it. Nothing asserted it while the fallback chain lived in the
   * route.
   */
  it("shows an em dash when there is no classification to label", async () => {
    await render1({}, { classificationLabel: null });
    // Asserted against this field rather than by text: the Audit card below
    // prints an em dash for every timestamp a booking has not reached yet.
    expect(screen.getByText("Classification").nextElementSibling).toHaveTextContent(
      "—",
    );
  });

  it("takes the venue and event type from the row, not a catalogue", async () => {
    // Renaming a venue must not retroactively change what an old booking says
    // it booked.
    await render1({ venue_label: "Atrium (old name)" });
    expect(screen.getByText("Atrium (old name)")).toBeInTheDocument();
    expect(screen.getByText("Wedding")).toBeInTheDocument();
  });

  it("says a booking is awaiting a quote rather than showing three em dashes", async () => {
    await render1({
      status: "awaiting_quote",
      total_fee: null,
      downpayment_amount: null,
      balance_amount: null,
    });
    expect(screen.getByText(/awaiting a quote/i)).toBeInTheDocument();
    expect(screen.queryByText("Total Fee")).not.toBeInTheDocument();
  });

  it("labels the downpayment with the row's own percentage", async () => {
    // Never a hardcoded 50%: booking_config is editable.
    await render1({ downpayment_pct: 30 });
    expect(screen.getByText("Downpayment Due (30%)")).toBeInTheDocument();
  });

  it("labels the balance as due, matching its sibling", async () => {
    // balance_amount is a quote breakdown, not a running ledger:
    // record_balance_payment deliberately leaves it at the quoted figure, the
    // same way downpayment_amount stays put once the downpayment is verified.
    // A bare "Balance" above a payments table reads as money still owed.
    await render1({ status: "confirmed" });
    expect(screen.getByText("Balance Due")).toBeInTheDocument();
  });

  it("marks a settled balance settled, so a paid booking does not read as debt", async () => {
    await render1({
      status: "fully_paid",
      balance_amount: 20400,
      balance_settled_at: "2026-08-11T10:22:00+08:00",
    });
    expect(screen.getByText(/₱20,400\.00 · settled/)).toBeInTheDocument();
  });

  it("leaves a balance that is genuinely still owed unqualified", async () => {
    await render1({
      status: "confirmed",
      balance_amount: 20400,
      balance_settled_at: null,
    });
    // The fixture quotes the same figure for both halves, so assert on the
    // suffix rather than the amount — that is the part under test.
    expect(screen.getAllByText("₱20,400.00").length).toBeGreaterThan(0);
    expect(screen.queryByText(/· settled/)).not.toBeInTheDocument();
  });

  it("names the rate type the dossier resolved", async () => {
    // Which view that label came from, and the fallback to the raw code, are
    // the dossier's rules and are tested there.
    await render1(
      {
        venue_code: "rehearsal_practice",
        venue_label: "Rehearsal / Practice",
        rehearsal_rate_type: "with_ac",
      },
      { rateTypeLabel: "With Air Conditioning" },
    );
    expect(screen.getByText("With Air Conditioning")).toBeInTheDocument();
  });

  /**
   * The label is null exactly when the booking names no rate type, so the
   * field is absent on every booking that is not a rehearsal — which is most
   * of them, and is why an empty Rate Type row would be noticed.
   */
  it("leaves the rate type out when the booking names none", async () => {
    await render1();
    expect(screen.queryByText("Rate Type")).not.toBeInTheDocument();
  });

  it("says plainly when the payment window has closed", async () => {
    // submit_downpayment raises 42501 past this point — the organiser cannot
    // pay, and a dead countdown would not say so.
    await render1({
      status: "awaiting_payment",
      hold_expires_at: "2020-01-01T00:00:00+08:00",
    });
    expect(
      screen.getByText(/organiser can no longer pay/i),
    ).toBeInTheDocument();
  });

  it("does not call a lapsed hold expired on an awaiting_quote booking", async () => {
    // Decision 8: the sweep spares these deliberately.
    await render1({
      status: "awaiting_quote",
      total_fee: null,
      hold_expires_at: "2020-01-01T00:00:00+08:00",
    });
    expect(
      screen.queryByText(/organiser can no longer pay/i),
    ).not.toBeInTheDocument();
  });

  it("names the resubmission deadline rather than a payment window", async () => {
    await render1({
      status: "awaiting_resubmission",
      rate_tier: "discounted",
      hold_expires_at: "2099-01-01T00:00:00+08:00",
      tier_revision_reason: "The scan is unreadable.",
    });
    expect(screen.getByText(/Resubmission window closes in/i)).toBeInTheDocument();
    expect(screen.queryByText(/Payment window/i)).not.toBeInTheDocument();
  });

  it("shows the Revision Request the organiser is answering", async () => {
    await render1({
      status: "awaiting_resubmission",
      rate_tier: "discounted",
      hold_expires_at: "2099-01-01T00:00:00+08:00",
      tier_revision_reason: "The scan is unreadable.",
    });
    expect(screen.getByText("The scan is unreadable.")).toBeInTheDocument();
    expect(screen.getByText(/waiting on the organiser/i)).toBeInTheDocument();
  });

  it("says when a lapsed Revision Request leaves nothing to upload", async () => {
    await render1({
      status: "awaiting_resubmission",
      rate_tier: "discounted",
      hold_expires_at: "2020-01-01T00:00:00+08:00",
      tier_revision_reason: "The scan is unreadable.",
    });
    expect(
      screen.getByText(/can no longer upload a corrected document/i),
    ).toBeInTheDocument();
  });

  it("says how long a Tier Claim has waited, and which look this is", async () => {
    await render1({
      status: "awaiting_tier_review",
      rate_tier: "discounted",
      tier_review_since: "2020-01-01T00:00:00+08:00",
      tier_review_look: 2,
      tier_revision_reason: "The scan is unreadable.",
    });
    expect(screen.getByText(/waiting on Tier Review for \d+ days/i)).toBeInTheDocument();
    expect(screen.getByText(/second and last look/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("renders the declaration as a date, not a boolean", async () => {
    await render1();
    expect(
      screen.getByText("Terms & Conditions Accepted"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Accepted")).not.toBeInTheDocument();
  });

  it("shows residency from is_resident and the locality", async () => {
    await render1({ is_resident: false, origin_locality: "Tayabas City" });
    expect(screen.getByText("Non-resident · Tayabas City")).toBeInTheDocument();
  });
});

/**
 * Two tests, where there were seven.
 *
 * The five that left were each one of the six gate tables, asserted by
 * rendering the whole page and looking for a button. Those tables live in
 * `desk-moves.ts` now and are rows in its table, which reaches combinations no
 * page render could — a discounted booking at four statuses, a ledger holding
 * a rejected downpayment, a confirmed booking with no quoted balance.
 *
 * What stays is what is genuinely the route's. The supervisor sentence is this
 * screen's copy for a reason the module only names; the absent Actions card is
 * this screen's answer to a record with nothing open, and it is the assertion
 * that fails if `anyOpen` is ever folded down to six booleans.
 */
describe("BookingDetailPage — which controls render", () => {
  it("tells a non-supervisor why the balance control is absent", async () => {
    stubReads({ status: "confirmed", balance_amount: 20400 });
    vi.spyOn(session, "getCurrentStaffUser").mockResolvedValue({
      id: "staff-2",
      email: "clerk@lucena.gov.ph",
      full_name: "Clerk",
      role: "staff",
      department: "Convention Center",
      assignedModules: ["booking"],
      is_supervisor: false,
      created_at: "2026-01-01T00:00:00+08:00",
    });

    render(await BookingDetailPage({ params: Promise.resolve({ id: "bk-1" }) }));

    expect(
      screen.queryByRole("button", { name: "Record balance payment" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Only a supervisor can record/i)).toBeInTheDocument();
  });

  it("renders no Actions card at all on a cancelled booking", async () => {
    await render1({ status: "cancelled", cancellation_reason: "expired_unpaid" });
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });
});
