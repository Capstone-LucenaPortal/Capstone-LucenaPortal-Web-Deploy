import type { Database } from "@/shared/supabase/types";

/**
 * Every one of these is a real PostgreSQL enum. Taking them from the generated
 * types means a value added in the database becomes a compile error here rather
 * than a row that silently renders blank. The mock's three-value BookingStatus
 * mapped onto the real eight almost not at all.
 */
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type RateTier = Database["public"]["Enums"]["rate_tier"];
export type PaymentKind = Database["public"]["Enums"]["payment_kind"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type BookingDocKind = Database["public"]["Enums"]["booking_doc_kind"];
export type BookingCancellationReason =
  Database["public"]["Enums"]["booking_cancellation_reason"];
export type StaffVerificationDecision =
  Database["public"]["Enums"]["staff_verification_decision"];
/** review_booking's own vocabulary since l77b — not verify_payment's. */
export type TierReviewDecision =
  Database["public"]["Enums"]["tier_review_decision"];

/**
 * `bookings.rehearsal_rate_type` is `text` in the generated types, but since l55
 * it carries a VALIDATED foreign key to booking_rehearsal_rates, so these three
 * are now the only reachable values rather than the three a submit_booking error
 * message happened to name. Anything read off a row is still widened to string —
 * the label and the price both come from public_booking_rehearsal_rates, which
 * Super Staff can extend.
 */
export type RehearsalRateType = "no_ac_day" | "no_ac_night" | "with_ac";

/**
 * Venue, event type and classification are all string CODES with labels from a
 * catalogue. The mock's `VenueId` and `EventType` unions hardcoded four venues
 * and six display strings; Super Staff can retire a venue or add an event type
 * at runtime, at which point a union is a portal that breaks. `EventType` also
 * stored the label itself ("Wedding") where the database stores a code.
 */

/** What the queue table needs. row-mapper collapses the view's nullability. */
export interface BookingQueueItem {
  id: string;
  reference_number: string;
  status: BookingStatus;
  cancellation_reason: BookingCancellationReason | null;
  event_title: string;
  event_type_label: string;
  venue_code: string;
  venue_label: string;
  rate_tier: RateTier;
  tier_verified: boolean;
  organization_name: string | null;
  contact_person: string;
  estimated_headcount: number;
  event_date: string;
  start_time: string;
  duration_hours: number;
  total_fee: number | null;
  balance_amount: number | null;
  hold_expires_at: string | null;
  submitted_at: string;
  unverified_payment_count: number;
  /**
   * When the booking last entered awaiting_tier_review — the Needs Action age.
   * A stamp, not a state: it is not cleared on leaving, so read it only
   * beside the status.
   */
  tier_review_since: string | null;
}

/** Everything the detail page adds. */
export interface Booking extends BookingQueueItem {
  event_type_code: string;
  classification_code: string;
  special_requirements: string | null;
  contact_number: string;
  email_address: string;
  is_resident: boolean;
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
  payment_count: number;
  document_count: number;
  /**
   * 1 or 2 in awaiting_tier_review, null elsewhere. Computed by the view from
   * tier_revision_reason: the server decides which look this is, never the
   * client (l77b).
   */
  tier_review_look: number | null;
  /** The one Revision Request's reason. Non-null means it was issued. */
  tier_revision_reason: string | null;
}

/**
 * A row of `staff_booking_payments`. `citizen_id` is deliberately NOT carried
 * across — the view projects it, nothing on this side needs it, and a uuid in a
 * props object is a uuid that ends up in a URL.
 */
export interface BookingPayment {
  id: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amount: number;
  gcash_reference: string | null;
  official_receipt_no: string | null;
  paid_at: string | null;
  submitted_at: string;
  recorded_by_name: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  rejected_reason: string | null;
  /** The id to hand to /api/booking/documents/[id]. Null when no proof was attached. */
  receipt_document_id: string | null;
}

/** A row of `staff_booking_documents`. `uploaded_at` is never null — the view filters it. */
export interface BookingDocument {
  id: string;
  kind: BookingDocKind;
  payment_id: string | null;
  uploaded_at: string;
  mime_type: string | null;
  size_bytes: number | null;
  verified_by_name: string | null;
  verified_at: string | null;
  /** Non-null once the citizen has replaced this document with a newer one. */
  superseded_by: string | null;
}

/**
 * A row of `staff_booking_events`. `event_type` is a bare string, not a union —
 * the column is `text` with no check constraint, so a closed type here would be
 * a lie the compiler enforces. There is no cycle_number; bookings do not reopen.
 */
export interface BookingEvent {
  id: string;
  event_type: string;
  actor_role: string;
  actor_name: string;
  note: string | null;
  created_at: string;
}
