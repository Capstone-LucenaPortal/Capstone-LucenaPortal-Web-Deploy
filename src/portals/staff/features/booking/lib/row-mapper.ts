import { STATUS_ORDER } from "./status";
import type {
  Booking,
  BookingCancellationReason,
  BookingDocKind,
  BookingDocument,
  BookingEvent,
  BookingPayment,
  BookingQueueItem,
  BookingStatus,
  PaymentKind,
  PaymentMethod,
  RateTier,
} from "../types";

/**
 * Every column of a view is nullable in the generated types, even ones the
 * underlying table declares NOT NULL. These row types mirror that honestly and
 * the mappers below collapse it.
 *
 * `total_fee`, `downpayment_amount`, `balance_amount` and `amount` are
 * PostgreSQL `numeric`, and postgrest-js returns `numeric` as a JavaScript
 * `number` — checked over the REST endpoint during l54. So `number | null` is
 * the honest declaration and no `Number(…)` coercion is needed.
 */
export type StaffBookingQueueRow = {
  id: string | null;
  reference_number: string | null;
  status: BookingStatus | null;
  cancellation_reason: BookingCancellationReason | null;
  event_title: string | null;
  event_type_label: string | null;
  venue_code: string | null;
  venue_label: string | null;
  rate_tier: RateTier | null;
  tier_verified: boolean | null;
  organization_name: string | null;
  contact_person: string | null;
  estimated_headcount: number | null;
  event_date: string | null;
  start_time: string | null;
  duration_hours: number | null;
  total_fee: number | null;
  balance_amount: number | null;
  hold_expires_at: string | null;
  submitted_at: string | null;
  unverified_payment_count: number | null;
  tier_review_since: string | null;
};

export type StaffBookingRow = StaffBookingQueueRow & {
  event_type_code: string | null;
  classification_code: string | null;
  special_requirements: string | null;
  contact_number: string | null;
  email_address: string | null;
  is_resident: boolean | null;
  origin_barangay_code: string | null;
  origin_locality: string | null;
  rehearsal_rate_type: string | null;
  downpayment_pct: number | null;
  downpayment_amount: number | null;
  quoted_by_name: string | null;
  quoted_at: string | null;
  terms_accepted_at: string | null;
  confirmed_at: string | null;
  balance_settled_at: string | null;
  completed_at: string | null;
  payment_count: number | null;
  document_count: number | null;
  tier_review_look: number | null;
  tier_revision_reason: string | null;
};

export type StaffBookingPaymentRow = {
  id: string | null;
  kind: PaymentKind | null;
  method: PaymentMethod | null;
  amount: number | null;
  gcash_reference: string | null;
  official_receipt_no: string | null;
  paid_at: string | null;
  submitted_at: string | null;
  recorded_by_name: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  rejected_reason: string | null;
  receipt_document_id: string | null;
};

export type StaffBookingDocumentRow = {
  id: string | null;
  kind: BookingDocKind | null;
  payment_id: string | null;
  uploaded_at: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  verified_by_name: string | null;
  verified_at: string | null;
  superseded_by: string | null;
};

/** No `cycle_number` — bookings have no reopen cycle. */
export type StaffBookingEventRow = {
  id: string | null;
  event_type: string | null;
  actor_role: string | null;
  actor_name: string | null;
  note: string | null;
  created_at: string | null;
};

/**
 * `id`, `status` and `rate_tier` are load-bearing: the first keys the row and
 * builds its link, the second decides which of six controls render, the third
 * decides whether a discount claim needs verifying at all. A row missing any of
 * them is not degraded data — it is evidence the query is wrong.
 *
 * No money column is ever coerced to zero. An unpriced booking is not free, and
 * ₱0.00 on an awaiting_quote row would make the quote screen look answered.
 */
export function toQueueItem(row: StaffBookingQueueRow): BookingQueueItem {
  if (!row.id) throw new Error("staff_bookings returned a row with no id");
  if (!row.status) {
    throw new Error(`staff_bookings returned row ${row.id} with no status`);
  }
  if (!row.rate_tier) {
    throw new Error(`staff_bookings returned row ${row.id} with no rate tier`);
  }

  return {
    id: row.id,
    reference_number: row.reference_number ?? "—",
    status: row.status,
    cancellation_reason: row.cancellation_reason,
    event_title: row.event_title ?? "Untitled event",
    event_type_label: row.event_type_label ?? "—",
    venue_code: row.venue_code ?? "",
    venue_label: row.venue_label ?? "Unknown venue",
    rate_tier: row.rate_tier,
    // Fail safe: an unreadable verification state must never present a
    // discount as substantiated.
    tier_verified: row.tier_verified ?? false,
    organization_name: row.organization_name,
    contact_person: row.contact_person ?? "—",
    estimated_headcount: row.estimated_headcount ?? 0,
    event_date: row.event_date ?? "",
    start_time: row.start_time ?? "",
    duration_hours: row.duration_hours ?? 0,
    total_fee: row.total_fee,
    balance_amount: row.balance_amount,
    hold_expires_at: row.hold_expires_at,
    submitted_at: row.submitted_at ?? "",
    unverified_payment_count: row.unverified_payment_count ?? 0,
    tier_review_since: row.tier_review_since,
  };
}

/** Returns null when the id does not exist or is not visible to this staff member. */
export function toBooking(row: StaffBookingRow | null): Booking | null {
  if (!row) return null;

  return {
    ...toQueueItem(row),
    event_type_code: row.event_type_code ?? "",
    classification_code: row.classification_code ?? "",
    special_requirements: row.special_requirements,
    contact_number: row.contact_number ?? "—",
    email_address: row.email_address ?? "—",
    is_resident: row.is_resident ?? false,
    origin_barangay_code: row.origin_barangay_code,
    origin_locality: row.origin_locality,
    rehearsal_rate_type: row.rehearsal_rate_type,
    downpayment_pct: row.downpayment_pct,
    downpayment_amount: row.downpayment_amount,
    quoted_by_name: row.quoted_by_name,
    quoted_at: row.quoted_at,
    terms_accepted_at: row.terms_accepted_at,
    confirmed_at: row.confirmed_at,
    balance_settled_at: row.balance_settled_at,
    completed_at: row.completed_at,
    payment_count: row.payment_count ?? 0,
    document_count: row.document_count ?? 0,
    tier_review_look: row.tier_review_look,
    tier_revision_reason: row.tier_revision_reason,
  };
}

export function toPayment(row: StaffBookingPaymentRow): BookingPayment {
  if (!row.id) {
    throw new Error("staff_booking_payments returned a row with no id");
  }
  // A payment with no amount cannot be reconciled against balance_amount, and
  // record_balance_payment demands an exact match to the centavo.
  if (row.amount === null || row.amount === undefined) {
    throw new Error(`staff_booking_payments row ${row.id} has no amount`);
  }

  return {
    id: row.id,
    kind: row.kind ?? "downpayment",
    method: row.method ?? "cash",
    amount: row.amount,
    gcash_reference: row.gcash_reference,
    official_receipt_no: row.official_receipt_no,
    paid_at: row.paid_at,
    submitted_at: row.submitted_at ?? "",
    recorded_by_name: row.recorded_by_name,
    verified_by_name: row.verified_by_name,
    verified_at: row.verified_at,
    rejected_reason: row.rejected_reason,
    receipt_document_id: row.receipt_document_id,
  };
}

export function toDocument(row: StaffBookingDocumentRow): BookingDocument {
  if (!row.id) {
    throw new Error("staff_booking_documents returned a row with no id");
  }
  // The view filters `uploaded_at is not null` — l54 added that filter. A null
  // here means the query hit something other than staff_booking_documents.
  if (!row.uploaded_at) {
    throw new Error(`staff_booking_documents row ${row.id} has no uploaded_at`);
  }

  return {
    id: row.id,
    kind: row.kind ?? "org_document",
    payment_id: row.payment_id,
    uploaded_at: row.uploaded_at,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    verified_by_name: row.verified_by_name,
    verified_at: row.verified_at,
    superseded_by: row.superseded_by,
  };
}

export function toEvent(row: StaffBookingEventRow): BookingEvent {
  if (!row.id) {
    throw new Error("staff_booking_events returned a row with no id");
  }
  if (!row.event_type) {
    throw new Error(`staff_booking_events row ${row.id} has no event_type`);
  }

  return {
    id: row.id,
    // Deliberately not narrowed to a union. The column is `text` with no check
    // constraint; labelForEvent humanises anything it has not seen.
    event_type: row.event_type,
    actor_role: row.actor_role ?? "system",
    actor_name: row.actor_name ?? "Unknown",
    note: row.note,
    created_at: row.created_at ?? "",
  };
}

/**
 * PostgREST has no GROUP BY, so the tab counts come from selecting one column
 * across the whole view and counting here.
 */
export function countByStatus(
  rows: { status: BookingStatus | null }[],
): Record<BookingStatus, number> {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
    BookingStatus,
    number
  >;
  for (const row of rows) {
    if (row.status && row.status in counts) counts[row.status] += 1;
  }
  return counts;
}
