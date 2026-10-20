import { createClient, type Db } from "@/shared/supabase/server";
import { getLabels } from "@/portals/staff/lib/supabase/catalogs";
import { commercialReference, getRateCard } from "./rate-card";
import { toBooking, toDocument, toEvent, toPayment } from "./row-mapper";
import type { FeeReference } from "./fee-reference";
import type {
  StaffBookingDocumentRow,
  StaffBookingEventRow,
  StaffBookingPaymentRow,
  StaffBookingRow,
} from "./row-mapper";
import type {
  Booking,
  BookingDocument,
  BookingEvent,
  BookingPayment,
} from "../types";

/**
 * Column lists are checked against the generated types: a column
 * the view does not have is a compile error. That holds only while each list
 * is ONE string literal on ONE source line — split it with `+` or build it
 * with `.join()` and TypeScript widens it to `string`, which postgrest-js
 * cannot parse, so the row type degrades to GenericStringError[].
 *
 * The compiler cannot see the view's nullability rules, though, so every
 * result is still cast to its row type below. All four were verified
 * by live query against the sandbox on 2026-08-11, after l54 and l55. Do not
 * add a column without doing the same.
 *
 * The detail list is a superset of the queue's, and is now written out rather
 * than concatenated onto it: the two reads answer different screens' questions
 * and their column lists are owned by different modules. Exporting the queue's
 * list to build this one would widen the read module's interface by exactly the
 * one kind of export this work exists to remove.
 *
 * That unties a knot. The concatenation guaranteed the detail select was a
 * superset of the queue's, and nothing guarantees it now: a column the view
 * gains for both screens has to be added in both places, and no test notices if
 * it is added to only one. The offset is that all forty columns are asserted
 * exactly by their own wire test for the first time — this list had no wire
 * test at all while it was derived. See ADR-0004, which made the same trade for
 * Incidents, and ADR-0006.
 */
const DETAIL_COLUMNS = "id, reference_number, status, cancellation_reason, event_title, event_type_label, venue_code, venue_label, rate_tier, tier_verified, organization_name, contact_person, estimated_headcount, event_date, start_time, duration_hours, total_fee, balance_amount, hold_expires_at, submitted_at, unverified_payment_count, event_type_code, classification_code, special_requirements, contact_number, email_address, is_resident, origin_barangay_code, origin_locality, rehearsal_rate_type, downpayment_pct, downpayment_amount, quoted_by_name, quoted_at, terms_accepted_at, confirmed_at, balance_settled_at, completed_at, payment_count, document_count, tier_review_since, tier_review_look, tier_revision_reason";

/**
 * Thirteen of the view's eighteen columns. The five deliberately left out are
 * `booking_id`, `reference_number`, `recorded_by`, `verified_by` and — the one
 * that matters — `citizen_id`. A uuid in a props object is a uuid that ends up
 * in a URL, and Staff never needs to identify the citizen beyond the contact
 * fields the organiser typed themselves.
 */
const PAYMENT_COLUMNS = "id, kind, method, amount, gcash_reference, official_receipt_no, paid_at, submitted_at, recorded_by_name, verified_by_name, verified_at, rejected_reason, receipt_document_id";

/** ⚠️ `size_bytes`, matching incident_photos and NOT yellow_card_documents. */
const DOCUMENT_COLUMNS = "id, kind, payment_id, uploaded_at, mime_type, size_bytes, verified_by_name, verified_at, superseded_by";

/** ⚠️ There is no `cycle_number` — bookings have no reopen cycle. */
const EVENT_COLUMNS = "id, event_type, actor_role, actor_name, note, created_at";

/**
 * Everything the desk needs on screen about one booking.
 *
 * Named for the record rather than for the activity, as ADR-0004 named the
 * Incidents one: this screen serves eight statuses and every job the office
 * does to a booking — quoting, verifying a payment, reviewing a discount claim,
 * recording a balance, completing, rejecting, and reading a cancelled history.
 *
 * Flat, with the labels named beside the booking rather than folded onto it:
 * that object mirrors a database row and the row mapper owns its contract, so a
 * hand-resolved classification label sitting next to the view-resolved
 * `event_type_label` would read as the same kind of thing and isn't.
 *
 * Data, not a view model. Resolving a code to a label is domain knowledge about
 * what the desk needs on screen; the `"—"` em dash and every other piece of
 * copy stay in the route, exactly as Incidents' "None suggested" and "Not yet
 * routed" did.
 */
export interface BookingDossier {
  booking: Booking;
  /** The ledger, chronological — oldest first. Empty, never absent. */
  payments: BookingPayment[];
  /** Current document first. Superseded ones are NOT filtered out. */
  documents: BookingDocument[];
  /** The whole history, oldest first — the order it happened in. */
  events: BookingEvent[];
  /** Null when there is no code; the raw code when the catalogue has no label. */
  classificationLabel: string | null;
  /** Same rule. Null for every booking that names no rehearsal rate type. */
  rateTypeLabel: string | null;
  /**
   * The same booking priced at the COMMERCIAL tier, for the quote screen to
   * anchor a discounted quote against.
   *
   * Resolved for every booking, including ones no quote form will ever render.
   * Making it conditional would put "which statuses can be quoted" inside the
   * dossier, and that belongs to the route's guard tables.
   */
  commercialReference: FeeReference;
}

/**
 * Answers "what does the desk need on screen about this booking", so the detail
 * route does not have to know the read order, the fan-out, which lookup is a
 * catalogue and which is a rate card, or which moment each date rule is
 * measured against.
 *
 * Two-phase on purpose: the booking is read first and a nonexistent id returns
 * null without firing the other five reads.
 *
 * Two things the detail route needs are deliberately not here. The current
 * staff user is owned by the auth feature and answers "who is looking", not
 * "what is being looked at". The booking config is a third thing again — a fact
 * about the office's rules rather than about this booking, and it is read by
 * the Queue and the calendar too, so folding it in would give it two owners.
 *
 * The staff user's absence is about THIS module's job, not a rule that the
 * session may not reach a module. Where it does belong is `./desk-moves.ts`,
 * one file over: answering what the desk can do with this booking is the
 * question "who is looking" is half of, since record_balance_payment is
 * supervisor-gated. It is handed in there rather than read, so that module
 * stays pure. See ADR-0007.
 *
 * This is the module's whole interface. The four reads below are private, and
 * stay private: an export is an export, and the next caller to import one will
 * not read the comment above it. See ADR-0003.
 */
export async function getBookingDossier(
  id: string,
  db?: Db,
): Promise<BookingDossier | null> {
  const booking = await readBooking(id, db);
  if (!booking) return null;

  const [payments, documents, events, classifications, rateCard] =
    await Promise.all([
      readPayments(booking.id, db),
      readDocuments(booking.id, db),
      readEvents(booking.id, db),
      // The view projects classification_code and no label — this is the one
      // field that genuinely needs the catalogue. Venue and event type come off
      // the ROW, not the catalogue, or renaming a venue would retroactively
      // change what an old booking says it booked.
      getLabels("public_booking_classifications"),
      getRateCard(),
    ]);

  return {
    booking,
    payments,
    documents,
    events,
    // A code with no catalogue entry falls back to the code itself, which is
    // legible; showing nothing would hide that the booking is classified at
    // all. This is also how a failed catalogue read degrades — getLabels
    // swallows it and returns an empty map. No code at all is a different thing
    // entirely: there is nothing to resolve, and the copy for that case is the
    // caller's.
    classificationLabel: booking.classification_code
      ? (classifications[booking.classification_code] ??
        booking.classification_code)
      : null,
    // From public_booking_rehearsal_rates rather than a hand-written map —
    // Super Staff can rename or add a rate type. It is the one display string
    // on the rate card, which is why it is resolved here while every rule that
    // decides a FEE stays in commercialReference, where the table tests it.
    rateTypeLabel: booking.rehearsal_rate_type
      ? (rateCard.rehearsalRates[booking.rehearsal_rate_type]?.label ??
        booking.rehearsal_rate_type)
      : null,
    commercialReference: commercialReference(booking, rateCard),
  };
}

/** Returns null when the id does not exist or is not visible to this staff member. */
async function readBooking(id: string, db?: Db): Promise<Booking | null> {
  const supabase = db ?? (await createClient());
  const { data, error } = await supabase
    .from("staff_bookings")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`staff_bookings detail read failed: ${error.message}`);
  }

  return toBooking(data as StaffBookingRow | null);
}

/** The ledger, chronological. */
async function readPayments(
  bookingId: string,
  db?: Db,
): Promise<BookingPayment[]> {
  const supabase = db ?? (await createClient());
  const { data, error } = await supabase
    .from("staff_booking_payments")
    .select(PAYMENT_COLUMNS)
    .eq("booking_id", bookingId)
    .order("submitted_at", { ascending: true });

  if (error) {
    throw new Error(`staff_booking_payments read failed: ${error.message}`);
  }

  return ((data as StaffBookingPaymentRow[] | null) ?? []).map(toPayment);
}

/**
 * Current document first.
 *
 * Deliberately does NOT filter `superseded_by`: a superseded document is
 * history the reviewer wants to see, and review_booking leaves a rejected one
 * in place so the citizen can supersede it. This is why the list and
 * `staff_bookings.document_count` are asymmetric on purpose — the count is
 * `superseded_by IS NULL AND uploaded_at IS NOT NULL` (current documents), this
 * is `uploaded_at IS NOT NULL` (all real documents). Label the card from the
 * list; if you surface the count, call it "current".
 */
async function readDocuments(
  bookingId: string,
  db?: Db,
): Promise<BookingDocument[]> {
  const supabase = db ?? (await createClient());
  const { data, error } = await supabase
    .from("staff_booking_documents")
    .select(DOCUMENT_COLUMNS)
    .eq("booking_id", bookingId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    throw new Error(`staff_booking_documents read failed: ${error.message}`);
  }

  return ((data as StaffBookingDocumentRow[] | null) ?? []).map(toDocument);
}

/** The whole history, oldest first — the order it happened in. */
async function readEvents(
  bookingId: string,
  db?: Db,
): Promise<BookingEvent[]> {
  const supabase = db ?? (await createClient());
  const { data, error } = await supabase
    .from("staff_booking_events")
    .select(EVENT_COLUMNS)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`staff_booking_events read failed: ${error.message}`);
  }

  return ((data as StaffBookingEventRow[] | null) ?? []).map(toEvent);
}
