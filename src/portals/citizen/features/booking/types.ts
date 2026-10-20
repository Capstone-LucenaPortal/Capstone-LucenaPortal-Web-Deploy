/** Domain types for the LCC booking slice. */

/** The shape the booking wizard holds while a citizen fills it in. */
export interface BookingFormData {
  classificationCode: string;
  eventTitle: string;
  eventTypeCode: string;
  headcount: string;
  organizationName: string;
  contactPerson: string;
  contactNumber: string;
  emailAddress: string;
  venueCode: string;
  venueLabel: string;
  venueIsHourly: boolean;
  practiceRateType: string;
  specialRequirements: string;
  selectedDate: Date | null;
  startTime: string;
  durationHours: number;
  termsAccepted: boolean;
}

/** A day's availability in the booking calendar. */
export type DayStatus = 'available' | 'partial' | 'fully-booked';

/** Display-only fee estimate produced by `estimateVenueFee`. */
export interface FeeEstimate {
  amount: number | null;
  requiresQuote: boolean;
}

/** Where the booking wizard goes once `submit_booking` returns. */
export type PostSubmitStage = 'org-document' | 'tier-review' | 'quote' | 'payment';

export type VenueType = 'atrium' | 'arena' | 'full' | 'practice';
export type ClassificationType = 'commercial' | 'ngo';
export type BookingStatus = 'Pending Approval' | 'Approved' | 'Rejected' | 'Payment Verification';

export interface FeeBreakdown {
  base: number;
  vat: number;
  total: number;
}

export interface BookingData {
  selectedDate: string | null;
  startTime: string;
  durationHours: number;
  venue: string;
  practiceMode: string;
  eventTitle: string;
  eventType: string;
  organization: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  headcount: string;
  specialRequirements: string;
  orgType: string;
  orgDocFile: File | null;
  calculatedFee: number;
  downpaymentAmount: number;
  termsAccepted: boolean;
  bookingRef: string;
  depositRefNumber: string;
  depositFile: File | null;
}

/**
 * A `my_bookings` row — the full column set, not a subset. The previous
 * 15-column interface hid `hold_expires_at`, `balance_amount` and the quote
 * timestamps, which is why a booking quoted after the citizen left the wizard
 * had no screen anywhere that let them pay.
 */
export interface MyBooking {
  id: string;
  reference_number: string;
  /** 'pending' | 'awaiting_tier_review' | 'awaiting_resubmission' |
   * 'awaiting_quote' | 'awaiting_payment' | 'payment_verification' |
   * 'confirmed' | 'fully_paid' | 'completed' | 'cancelled'. */
  status: string;
  /** 'rejected_by_staff' | 'cancelled_by_citizen' | 'expired_unpaid' |
   * 'expired_unrevised' | 'no_show'. Non-null only when `status = 'cancelled'`. */
  cancellation_reason: string | null;
  event_title: string;
  event_type_code: string | null;
  event_type_label: string | null;
  classification_code: string | null;
  /** 'commercial' | 'discounted', decided by the city from classification. */
  rate_tier: string | null;
  tier_verified: boolean | null;
  venue_code: string | null;
  venue_label: string;
  estimated_headcount: number | null;
  special_requirements: string | null;
  organization_name: string | null;
  contact_person: string | null;
  contact_number: string | null;
  email_address: string | null;
  event_date: string;
  start_time: string;
  duration_hours: number;
  rehearsal_rate_type: string | null;
  total_fee: number | null;
  downpayment_pct: number | null;
  downpayment_amount: number | null;
  /** Payable in person once the downpayment is verified and the booking is
   * `confirmed`. Null until the booking has been quoted. */
  balance_amount: number | null;
  quoted_at: string | null;
  /** When the Hold lapses — on `pending`, `awaiting_resubmission` or
   * `awaiting_payment`. After this the sweeper cancels the booking
   * (`expired_unrevised` for a Revision Request, else `expired_unpaid`) — this
   * is what the countdown counts to. Null in `awaiting_tier_review`. */
  hold_expires_at: string | null;
  terms_accepted_at: string | null;
  submitted_at: string;
  confirmed_at: string | null;
  balance_settled_at: string | null;
  completed_at: string | null;
  payment_count: number;
  document_count: number;
  /**
   * The Revision Request's reason, written by staff for the citizen (DB l77b).
   * Non-null once a Revision Request was issued — so on a commercial booking
   * it also means the Tier Claim was rejected on its second look.
   */
  tier_revision_reason: string | null;
}

export interface VenueAvailability {
  venue_code: string;
  space_code: string;
  during: string;
  event_date: string;
}

export interface BookingSubmissionFields {
  classificationCode: string;
  eventTitle: string;
  eventTypeCode: string;
  estimatedHeadcount: number;
  contactPerson: string;
  contactNumber: string;
  emailAddress: string;
  venueCode: string;
  eventDate: string;
  startTime: string;
  durationHours: number;
  organizationName?: string;
  specialRequirements?: string;
  rehearsalRateType?: string;
}

export interface SubmittedBooking {
  id: string;
  reference_number: string;
  status: string;
  total_fee: number | null;
  downpayment_amount: number | null;
  /**
   * 'commercial' | 'discounted', set by `bk_on_submit()` from
   * `booking_classifications.is_discount_eligible`. Already carried by the live
   * RPC, which is declared `returns bookings`.
   */
  rate_tier: string;
}
