import { requestService } from '@/portals/citizen/lib/mock/request-store';
import type { StoredRequest } from '@/portals/citizen/lib/mock/types';
import { getSupabaseClient } from '@/portals/citizen/lib/supabase/client';
import { LIMITS, fieldTooLong, emailError, phMobileError, boundedInt } from '@/portals/citizen/lib/validation';
import { safeExt, canonicalMime, type DocumentUploadProgress } from '@/portals/citizen/lib/storage/file-validation';
import type { MyBooking, VenueAvailability, BookingSubmissionFields, SubmittedBooking } from '../types';

export const bookingService = {
  getBookings(): StoredRequest[] {
    return requestService.getRequests().filter(r => r.type === 'Venue Booking');
  },

  addBooking(req: Omit<StoredRequest, 'id' | 'date'>): StoredRequest {
    return requestService.addRequest(req);
  },

  updateBooking(bookingNumber: string, updates: Partial<StoredRequest>): boolean {
    return requestService.updateRequest(bookingNumber, updates);
  },

  async getVenueAvailability(): Promise<VenueAvailability[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('public_venue_availability').select('*');
    if (error) throw new Error('Could not load booking information right now. Please try again later.');
    return (data as VenueAvailability[]) ?? [];
  },

  async submitBooking(fields: BookingSubmissionFields): Promise<SubmittedBooking> {
    const client = getSupabaseClient();
    if (!client) {
      const reference_number = `BK-${new Date().getFullYear()}-${String(
        Math.floor(Math.random() * 999999),
      ).padStart(6, '0')}`;
      requestService.addRequest({
        type: 'Venue Booking',
        bookingNumber: reference_number,
        status: 'Pending Approval',
        details: { ...fields },
      });
      // Mock-only guess. `is_discount_eligible` lives in
      // public_booking_classifications, which catalogService cannot read with
      // no backend configured, so mock mode assumes every non-commercial
      // classification is discount-eligible. Without this the org-document
      // screen would be invisible to anyone developing without a backend. The
      // live path always uses the rate_tier bk_on_submit() actually set.
      const discounted = fields.classificationCode !== 'commercial';
      return {
        id: `mock-${Date.now()}`,
        reference_number,
        // bk_on_submit parks a discounted booking in `pending` until its
        // organisation document is uploaded (DB l77b).
        status: discounted ? 'pending' : 'awaiting_payment',
        total_fee: 0,
        downpayment_amount: 0,
        rate_tier: discounted ? 'discounted' : 'commercial',
      };
    }

    const headcount = boundedInt(fields.estimatedHeadcount, 1, 5000);
    const duration = boundedInt(fields.durationHours, 1, 24);
    const problem =
      (!fields.eventTitle.trim() ? 'Please enter an event title.' : null) ??
      fieldTooLong('Event title', fields.eventTitle.trim(), LIMITS.shortText) ??
      fieldTooLong('Organization name', fields.organizationName?.trim() ?? '', LIMITS.orgName) ??
      fieldTooLong('Special requirements', fields.specialRequirements?.trim() ?? '', LIMITS.description) ??
      fieldTooLong('Contact person', fields.contactPerson.trim(), LIMITS.name) ??
      emailError(fields.emailAddress.trim()) ??
      phMobileError(fields.contactNumber.trim()) ??
      (headcount === null ? 'Estimated headcount must be a whole number between 1 and 5000.' : null) ??
      (duration === null ? 'Duration must be between 1 and 24 hours.' : null);
    if (problem) throw new BookingSubmitError(problem);

    const params = {
      p_classification_code: fields.classificationCode,
      p_event_title: fields.eventTitle.trim(),
      p_event_type_code: fields.eventTypeCode,
      p_estimated_headcount: headcount,
      p_contact_person: fields.contactPerson.trim(),
      p_contact_number: fields.contactNumber.trim(),
      p_email_address: fields.emailAddress.trim(),
      p_venue_code: fields.venueCode,
      p_event_date: fields.eventDate,
      p_start_time: fields.startTime,
      p_duration_hours: duration,
      p_organization_name: fields.organizationName?.trim() || null,
      p_special_requirements: fields.specialRequirements?.trim() || null,
      p_rehearsal_rate_type: fields.rehearsalRateType || null,
    };
    const { data, error } = await client.rpc('submit_booking', params);
    if (error) throw new BookingSubmitError(translateBookingError(error.message, error.code, 'submit'));
    return data as unknown as SubmittedBooking;
  },

  /**
   * The skip: the citizen gives up the Tier Claim before uploading the
   * organisation document, and the SERVER reprices the booking at commercial
   * (`give_up_tier_claim`, DB l77b) — `awaiting_payment`, or `awaiting_quote`
   * for a venue that needs one. The Hold is not restarted. Returns the
   * repriced row, so the wizard pays the amount the city set.
   */
  async giveUpTierClaim(bookingId: string): Promise<SubmittedBooking> {
    const client = getSupabaseClient();
    if (!client) {
      return {
        id: bookingId,
        reference_number: 'BK-MOCK',
        status: 'awaiting_payment',
        total_fee: 0,
        downpayment_amount: 0,
        rate_tier: 'commercial',
      };
    }
    const { data, error } = await client.rpc('give_up_tier_claim', { p_booking_id: bookingId });
    if (error) throw new BookingSubmitError(translateBookingError(error.message, error.code, 'skip'));
    return data as unknown as SubmittedBooking;
  },

  async submitDownpayment(bookingId: string, gcashReference: string): Promise<{ id: string }> {
    const client = getSupabaseClient();
    if (!client) return { id: `mock-payment-${Date.now()}` };
    const { data, error } = await client.rpc('submit_downpayment', {
      p_booking_id: bookingId,
      p_gcash_reference: gcashReference,
    });
    if (error) throw new BookingSubmitError(translateBookingError(error.message, error.code, 'payment'));
    return data as unknown as { id: string };
  },

  /**
   * Resumable three-step upload: reserve a row -> PUT the bytes -> confirm.
   *
   * `progress` is caller-held and mutated in place, so passing the same object back in
   * (whether after a failure or just on a second call) skips whatever step already
   * succeeded: a populated `rowId` skips the reserve RPC, `bytesLanded: true` skips the
   * storage upload. `upsert: true` on the storage call lets a retry overwrite its own
   * half-landed object at the same server-chosen path instead of failing with a 409.
   */
  async uploadBookingDocument(
    bookingId: string,
    kind: 'org_document' | 'gcash_receipt',
    file: File,
    paymentId?: string,
    progress: DocumentUploadProgress = {},
  ): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    const ext = safeExt(file);
    if (!ext) throw new BookingSubmitError('Please upload a JPG, PNG, or PDF file.');

    if (!progress.rowId) {
      const { data: reserved, error: reserveError } = await client.rpc(
        'request_booking_document_upload',
        { p_booking_id: bookingId, p_kind: kind, p_ext: ext, p_payment_id: paymentId ?? null },
      );
      if (reserveError)
        throw new BookingSubmitError(
          translateBookingError(reserveError.message, reserveError.code, 'upload'),
          reserveError.code,
        );
      const row = (Array.isArray(reserved) ? reserved[0] : reserved) as {
        row_id: string; bucket: string; storage_path: string;
      };
      progress.rowId = row.row_id;
      progress.bucket = row.bucket;
      progress.storagePath = row.storage_path;
    }

    if (!progress.bytesLanded) {
      const { error: uploadError } = await client.storage
        .from(progress.bucket!)
        .upload(progress.storagePath!, file, { contentType: canonicalMime(ext), upsert: true });
      // A StorageError carries no Postgres-style `code`, so the text fallback
      // inside translateBookingError is the only signal available here.
      if (uploadError)
        throw new BookingSubmitError(translateBookingError(uploadError.message, undefined, 'upload'));
      progress.bytesLanded = true;
    }

    const { error: confirmError } = await client.rpc('confirm_upload', {
      p_kind: 'booking_document',
      p_row_id: progress.rowId,
      p_size_bytes: file.size,
      p_mime_type: canonicalMime(ext),
    });
    if (confirmError)
      throw new BookingSubmitError(
        translateBookingError(confirmError.message, confirmError.code, 'upload'),
        confirmError.code,
      );
  },
};

export class BookingSubmitError extends Error {
  /** The Postgres errcode behind a refusal, when there was one. Lets a caller
   * tell a permanent refusal (42501) from a failure worth retrying. */
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'BookingSubmitError';
    this.code = code;
  }
}

/**
 * Pure: a booking-path error -> a sentence written for a citizen.
 *
 * Keyed on the Postgres errcode FIRST, because message text is written for
 * developers and drifts. The previous substring-only version collapsed
 * genuinely distinct refusals into the wrong copy: a `23P01` slot clash and a
 * `42501` closed payment window both fell through to "check the reference
 * number", and a `23503` inactive-venue error (Super Staff deactivated it
 * mid-wizard — reachable in practice, given the 5-minute catalog cache) read
 * as a payment problem.
 *
 * `stage` disambiguates the codes the RPCs share. `22023` is "bad event
 * date/duration/opening hours" at submit but "not yet quoted" at payment;
 * `23505` is only ever "a payment is already on file".
 *
 * Text matching survives only as a fallback for errors carrying no code — in
 * practice Supabase `StorageError`s, which have `status` but no Postgres `code`.
 */
export function translateBookingError(
  message: string,
  code?: string,
  stage: 'submit' | 'payment' | 'upload' | 'cancel' | 'skip' = 'submit',
): string {
  switch (code) {
    // The not-found code functions created since DB l77b raise instead of
    // P0002 (give_up_tier_claim among them).
    case 'PT404':
      return 'We could not find that booking.';

    case 'P0002':
      return stage === 'payment'
        ? 'We could not find that booking.'
        : 'Please complete your profile before booking a venue.';

    case '23P01':
      // Exclusion-constraint violation on the occupancy range.
      return 'That time is no longer available. Please choose another.';

    case '23503':
      // FK to a catalog row that has since been deactivated.
      return 'That option is no longer available. Please pick another.';

    case '42501':
      if (stage === 'payment') {
        return 'This booking is not accepting payment right now — the payment window may have closed.';
      }
      if (stage === 'cancel') {
        return 'This booking can no longer be cancelled here.';
      }
      if (stage === 'upload') {
        return 'This booking is not accepting documents right now.';
      }
      if (stage === 'skip') {
        // Either the hold has ended or the document was already submitted —
        // give_up_tier_claim accepts only a `pending` booking.
        return 'This booking can no longer continue without the discount — its hold may have ended, or your document is already with City Hall.';
      }
      return 'Please sign in to book a venue.';

    case '23505':
      return 'A payment is already on file for this booking.';

    case '22023':
      if (stage === 'payment') {
        return 'This booking has not been quoted yet, so there is nothing to pay.';
      }
      if (stage === 'cancel') {
        return 'Please tell us why you are cancelling.';
      }
      if (stage === 'upload') {
        return 'That file was not accepted. Please upload a JPG, PNG or PDF under 5 MB.';
      }
      return 'Please check the event date, start time and duration — the venue may be closed at that time.';

    case '23514':
      return stage === 'upload'
        ? 'This booking already has the maximum number of documents.'
        : 'Please check the event details and try again.';
  }

  // No errcode to trust — storage failures are the realistic case here.
  const m = (message ?? '').toLowerCase();
  if (m.includes('no profile') || m.includes('complete your profile')) {
    return 'Please complete your profile before booking a venue.';
  }
  if (m.includes('exceeded the maximum allowed size') || m.includes('payload too large')) {
    return 'That file is too large. Please upload a file under 5 MB.';
  }
  if (m.includes('storage') || m.includes('upload') || m.includes('mime') || m.includes('size')) {
    return 'The file could not be uploaded. Please use a JPG, PNG, or PDF under 5 MB and try again.';
  }
  if (stage === 'payment') {
    return 'Your payment details could not be recorded. Please check the reference number and try again.';
  }
  return 'We could not submit your booking right now. Please try again later.';
}

/**
 * Pure: a `cancel_booking` errcode -> citizen copy.
 *
 * The DB refuses in two materially different situations and they must not read
 * alike. Cancellation is legal from `pending` / `awaiting_quote` /
 * `awaiting_payment`. From `payment_verification` / `confirmed` money is
 * already involved, so the citizen needs a human, not a retry. From a terminal
 * status there is simply nothing left to cancel.
 */
export function translateCancelError(code: string | undefined, status?: string): string {
  if (code === '22023') return 'Please tell us why you are cancelling.';
  if (code === 'P0002') return 'We could not find that booking.';
  if (code === '42501') {
    if (status === 'payment_verification' || status === 'confirmed' || status === 'fully_paid') {
      return 'A payment is already on file for this booking. Please contact City Hall to cancel or request a refund.';
    }
    if (status === 'completed' || status === 'cancelled') {
      return 'This booking is already closed.';
    }
    return 'This booking can no longer be cancelled online. Please contact City Hall.';
  }
  return 'We could not cancel that booking right now. Please try again later.';
}

/**
 * Cancel a booking the citizen no longer wants. `status` is passed only so the
 * refusal copy can name the right next step — the DB, not this argument, is
 * what actually decides whether the cancellation is legal.
 *
 * Mock mode is a no-op: mock records carry no booking id.
 */
export async function cancelBooking(
  bookingId: string,
  reason: string,
  status?: string,
): Promise<void> {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) throw new BookingSubmitError('Please tell us why you are cancelling.');

  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_reason: trimmed,
  });
  if (error) throw new BookingSubmitError(translateCancelError(error.code, status));
}

export async function getMyBookings(): Promise<MyBooking[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('my_bookings')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (error) throw new Error('Could not load booking information right now. Please try again later.');
  return (data as MyBooking[]) ?? [];
}
