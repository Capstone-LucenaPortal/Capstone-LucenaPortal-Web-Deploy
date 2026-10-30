import { getSupabaseClient } from '@/portals/citizen/lib/supabase/client';
import { requestService } from '@/portals/citizen/lib/mock/request-store';
import { LIMITS, fieldTooLong, emailError, phMobileError, boundedInt, birthDateError } from '@/portals/citizen/lib/validation';
import { safeExt, canonicalMime, type DocumentUploadProgress } from '@/portals/citizen/lib/storage/file-validation';
import type { MyYellowCardApplication, MyYellowCard, YellowCardApplicationFields, YellowCardFieldValues, SubmittedApplication, VerifiedCard } from '../types';

/** Pure: a view row -> prefilled form values. Nulls become '' to keep inputs controlled. */
export function mapApplicationToFormValues(app: MyYellowCardApplication): YellowCardFieldValues {
  return {
    voterIdNumber: app.voter_id_number ?? '',
    firstName: app.first_name ?? '',
    middleName: app.middle_name ?? '',
    lastName: app.last_name ?? '',
    suffix: app.suffix ?? '',
    dateOfBirth: app.date_of_birth ?? '',
    genderCode: app.gender_code ?? '',
    civilStatusCode: app.civil_status_code ?? '',
    barangayCode: app.barangay_code ?? '',
    completeAddress: app.complete_address ?? '',
    contactNumber: app.contact_number ?? '',
    emailAddress: app.email_address ?? '',
    yearsOfResidency: app.years_of_residency != null ? String(app.years_of_residency) : '',
  };
}

/**
 * Pure: form values -> `update_yellow_card_application` params.
 *
 * Deliberately emits no `p_privacy_consent`. `submit_yellow_card_application`
 * takes one; the update RPC does not, because consent was given at first
 * submission. Sending it would fail the call.
 */
export function mapResubmitToParams(applicationId: string, values: YellowCardFieldValues) {
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const completeAddress = values.completeAddress.trim();
  const contactNumber = values.contactNumber.trim();
  const emailAddress = values.emailAddress.trim();
  const voterIdNumber = values.voterIdNumber.trim();
  const yearsOfResidency = boundedInt(values.yearsOfResidency, 0, 120);

  const problem =
    (!firstName ? 'Please enter a first name.' : null) ??
    (!lastName ? 'Please enter a last name.' : null) ??
    (!values.dateOfBirth ? 'Please enter a date of birth.' : null) ??
    (!values.genderCode ? 'Please select a sex.' : null) ??
    (!values.civilStatusCode ? 'Please select a civil status.' : null) ??
    (!values.barangayCode ? 'Please select a barangay.' : null) ??
    (!completeAddress ? 'Please enter a complete address.' : null) ??
    (!voterIdNumber ? "Please enter your Voter's ID number." : null) ??
    fieldTooLong('First name', firstName, LIMITS.name) ??
    fieldTooLong('Last name', lastName, LIMITS.name) ??
    fieldTooLong('Complete address', completeAddress, LIMITS.address) ??
    fieldTooLong("Voter's ID number", voterIdNumber, LIMITS.shortText) ??
    emailError(emailAddress) ??
    phMobileError(contactNumber) ??
    (yearsOfResidency === null ? 'Years of residency must be a whole number between 0 and 120.' : null);
  if (problem) throw new YellowCardSubmitError(problem);

  return {
    p_application_id: applicationId,
    p_first_name: firstName,
    p_last_name: lastName,
    p_date_of_birth: values.dateOfBirth,
    p_gender_code: values.genderCode,
    p_civil_status_code: values.civilStatusCode,
    p_barangay_code: values.barangayCode,
    p_complete_address: completeAddress,
    p_contact_number: contactNumber,
    p_email_address: emailAddress,
    p_years_of_residency: yearsOfResidency,
    p_voter_id_number: voterIdNumber,
    p_middle_name: values.middleName.trim() || null,
    p_suffix: values.suffix.trim() || null,
  };
}

/**
 * Pure: the 18+ eligibility rule, shared by the apply and revise forms.
 *
 * Delegates the invalid/future/absurdly-old-date checks to `birthDateError`
 * so that basic date sanity has one source of truth (it also catches
 * future dates, which the old implementation silently mis-scored as
 * "too young" instead of rejecting for the real reason).
 *
 * The 18-year threshold itself deliberately stays a precise LOCAL
 * calendar-day comparison rather than calling birthDateError's
 * `minAgeYears`, which approximates a year as 365.25 days. That
 * approximation drifts by about 1.5 days across an 18-year span containing
 * five leap days (e.g. someone born 2010-03-01, checked on 2028-02-29 — one
 * calendar day before their 18th birthday), which is exactly the scenario
 * the leap-day regression test below exists to catch.
 */
export function computeAgeError(dateOfBirth: string): string | null {
  if (!dateOfBirth) return null;
  if (birthDateError(dateOfBirth)) return '❌ You must be 18 years or older to apply.';
  // Parsed as a LOCAL calendar date. `new Date('YYYY-MM-DD')` would parse as UTC
  // midnight and then be compared against a local `new Date()`, which shifts the
  // result by a day in any non-UTC timezone.
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const dob = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age < 18 ? '❌ You must be 18 years or older to apply.' : null;
}

/**
 * The application statuses that block a new application.
 *
 * Kept beside `describeLiveApplication` on purpose. While this list lived in the
 * page and the interpretation lived here, a status could be added to the list and
 * fall silently into "currently being processed" — which is precisely how issue
 * #8 shipped. `liveNoticeFor` switches over this type, so adding a member here
 * without giving it copy fails the typecheck instead.
 *
 * `approved` belongs in the list: an approved application must still stop a
 * second one being filed.
 */
export const LIVE_APPLICATION_STATUSES = [
  'pending',
  'resubmitted',
  'revision_requested',
  'approved',
] as const;

export type LiveApplicationStatus = (typeof LIVE_APPLICATION_STATUSES)[number];

export function isLiveApplicationStatus(status: string): status is LiveApplicationStatus {
  return (LIVE_APPLICATION_STATUSES as readonly string[]).includes(status);
}

/**
 * What `/yellow-card` should say when the citizen already has a live
 * application, as a value rather than a chain of ternaries in the page.
 *
 * `approved` is one of the statuses that blocks a new application, so this
 * notice is shown to cardholders too — it used to tell them their approved
 * application was "currently being processed" (issue #8).
 */
export type LiveApplicationNotice =
  /** Sent back for changes: the citizen can resubmit without starting over. */
  | { kind: 'revision'; applicationId: string; reference: string }
  /** Decided in their favour. `card` is null until one has been issued. */
  | { kind: 'approved'; reference: string; card: ApprovedCard | null }
  /** `pending` or `resubmitted` — genuinely still with a reviewer. */
  | { kind: 'processing'; reference: string };

/** The card an approved application produced, whatever state it is now in.
 *  Carrying the status rather than only an active card's number is what lets the
 *  copy tell "not issued yet" apart from "issued, then revoked". */
export interface ApprovedCard {
  number: string;
  /** `yellow_card_status`: 'active' | 'revoked' | 'superseded'. */
  status: string;
}

/** The sentences for each notice, beside the statuses they describe so the two
 *  cannot drift. The page owns only the markup and the buttons. */
export interface LiveNoticeCopy {
  icon: string;
  heading: string;
  detail: string;
}

type LiveApplication = Pick<MyYellowCardApplication, 'id' | 'reference_number'> & {
  status: LiveApplicationStatus;
};

type CardRow = Pick<MyYellowCard, 'card_number' | 'application_id' | 'status'>;

/**
 * The notice for the citizen's live application, or null when none blocks them.
 *
 * `cards` is every card `my_yellow_cards` returned, not just this
 * application's: the match on `application_id` keeps an unrelated card out of
 * the notice. A card that is not `active` is still reported, with its status, so
 * the copy can say it was revoked instead of claiming it has yet to be issued.
 * No match at all leaves `card` null and the copy omits the number rather than
 * printing a blank one.
 */
export function liveApplicationNotice(
  applications: Pick<MyYellowCardApplication, 'id' | 'reference_number' | 'status'>[],
  cards: CardRow[],
): LiveApplicationNotice | null {
  for (const application of applications) {
    // The guard is what narrows `status` for the exhaustive switch below.
    if (isLiveApplicationStatus(application.status)) {
      return describeLiveApplication(
        { id: application.id, reference_number: application.reference_number, status: application.status },
        cards,
      );
    }
  }
  return null;
}

/** Exhaustive over `LiveApplicationStatus`: adding a member to
 *  `LIVE_APPLICATION_STATUSES` without handling it here fails the typecheck
 *  ("lacks ending return statement") rather than falling through to the wrong
 *  sentence, which is how issue #8 happened. */
function describeLiveApplication(
  application: LiveApplication,
  cards: CardRow[],
): LiveApplicationNotice {
  const reference = application.reference_number;

  switch (application.status) {
    case 'revision_requested':
      return { kind: 'revision', applicationId: application.id, reference };
    case 'approved': {
      const mine = cards.filter((c) => c.application_id === application.id);
      // Prefer the active one; `my_yellow_cards` is newest-first, so falling back
      // to the head gives the most recent inactive card rather than an old one.
      const card = mine.find((c) => c.status === 'active') ?? mine[0] ?? null;
      return {
        kind: 'approved',
        reference,
        card: card ? { number: card.card_number, status: card.status } : null,
      };
    }
    case 'pending':
    case 'resubmitted':
      return { kind: 'processing', reference };
  }
}

/** Exhaustive over `LiveApplicationNotice['kind']` for the same reason. */
export function liveNoticeCopy(notice: LiveApplicationNotice): LiveNoticeCopy {
  switch (notice.kind) {
    case 'revision':
      return {
        icon: '⚠️',
        heading: 'Your application needs changes',
        detail: `Application #${notice.reference} was sent back for revision. Update it and resubmit — you do not need to start over.`,
      };
    case 'approved': {
      const { card, reference } = notice;
      if (card && card.status === 'active') {
        return {
          icon: '✓',
          heading: 'You already have a Yellow Card',
          detail: `Card #${card.number} was issued from application #${reference}. Your digital card and QR code are in your profile.`,
        };
      }
      // Issued and then revoked or superseded. Saying it is yet to be issued
      // would be false, and the citizen needs to know why the card is dead.
      if (card) {
        return {
          icon: '⚠️',
          heading: 'Your Yellow Card is no longer active',
          detail: `Card #${card.number}, issued from application #${reference}, is no longer active. Open your Yellow Card details for the reason.`,
        };
      }
      return {
        icon: '✓',
        heading: 'Your application has been approved',
        detail: `Application #${reference} was approved. Your card details appear in your profile once the card is issued.`,
      };
    }
    case 'processing':
      return {
        icon: 'ℹ️',
        heading: 'You already have an active application',
        detail: `Application #${notice.reference} is currently being processed.`,
      };
  }
}

/**
 * Pure: a PostgrestError from `update_yellow_card_application` -> a sentence
 * written for a citizen.
 *
 * The errcode is the primary axis, but 42501 is raised for three different
 * conditions (no session, not your application, wrong status), so message
 * substrings split that one bucket. A 42501 matching none of them falls back
 * generically rather than guessing. Raw Postgres text is never rendered.
 */
export function translateResubmitError(code: string | undefined, message: string): string {
  const m = (message ?? '').toLowerCase();
  if (code === '42501') {
    if (m.includes('no authenticated caller')) {
      return 'Your session has expired. Please sign in again.';
    }
    if (m.includes('not yours')) {
      return "You don't have access to that application.";
    }
    if (m.includes('not revision_requested')) {
      return 'This application is no longer awaiting your changes. Check your dashboard for its current status.';
    }
  }
  if (code === 'P0002') return "We couldn't find that application.";
  if (code === '22023') return 'Years of residency must be zero or more.';
  return 'We could not resubmit your application right now. Please try again later.';
}

/**
 * Pure: an upload-path failure -> a sentence written for a citizen.
 *
 * `stage` names which of the three steps failed so the copy can be specific
 * without echoing backend text. The bucket caps files at 5 MB and accepts only
 * image/jpeg, image/png and application/pdf; `request_yellow_card_document_upload`
 * additionally refuses applications whose status is not pending, resubmitted or
 * revision_requested. Raw Postgres and storage text is never rendered.
 */
export function translateUploadError(
  stage: 'reserve' | 'upload' | 'confirm',
  code: string | undefined,
  message: string,
): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('exceeded the maximum allowed size') || m.includes('payload too large') || m.includes('413')) {
    return 'That file is too large. Please upload a file under 5MB.';
  }
  if (m.includes('mime') || m.includes('content type') || m.includes('invalid_mime_type')) {
    return 'That file type is not accepted. Please upload a JPG, PNG or PDF.';
  }
  if (code === '42501' || m.includes('not accepting uploads') || m.includes('not yours')) {
    return 'This application is not accepting document uploads right now. Check your dashboard for its current status.';
  }
  if (code === 'P0002') return "We couldn't find that application.";
  if (stage === 'confirm') {
    return 'Your file was uploaded but we could not finish attaching it. Please try again.';
  }
  return 'We could not upload your document right now. Please try again.';
}

export class YellowCardSubmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YellowCardSubmitError';
  }
}

/**
 * Pure: a `submit_yellow_card_application` errcode/message -> a sentence
 * written for a citizen.
 *
 * `code` is optional for backward compatibility with existing single-arg
 * callers/tests, but when present it is checked FIRST — codes are stable,
 * message text is not. '23505' (unique violation) is the already-has-an-
 * application guard; '22023' is a Postgres data-exception, raised for bad
 * input generally.
 */
export function translateSubmitError(message: string, code?: string): string {
  if (code === '23505') {
    // The RPC's own message tells the citizen to withdraw first; dropping that
    // instruction left them with a dead end, since the portal now offers the
    // withdraw action on the dashboard.
    return 'You already have an active Yellow Card application. Withdraw it from your dashboard before applying again.';
  }
  if (code === '22023') {
    return 'Please check that all required fields are filled in correctly.';
  }
  const m = message.toLowerCase();
  if (m.includes('no profile') || m.includes('complete your profile')) {
    return 'Please complete your profile before applying for a Yellow Card.';
  }
  if (m.includes('consent')) {
    return 'You must accept the Data Privacy consent to proceed.';
  }
  if (m.includes('already') && (m.includes('application') || m.includes('live'))) {
    // Same situation as the coded 23505 branch above, so the same instruction:
    // a citizen told only 'you already have one' has no way forward.
    return 'You already have an active Yellow Card application. Withdraw it from your dashboard before applying again.';
  }
  return 'We could not submit your application right now. Please try again later.';
}

/**
 * What a QR verification token resolved to. `not-found` is the one answer for an
 * unknown, malformed or deleted token; `unavailable` means the check itself
 * failed and says nothing about the card.
 */
export type VerifyCardResult =
  | { kind: 'found'; card: VerifiedCard }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

/**
 * How long a Verification waits for the RPC. supabase-js sets no timeout of its
 * own, so without one a request on a weak signal can hang indefinitely.
 */
const VERIFY_TIMEOUT_MS = 15_000;

/**
 * Look up a card by its QR verification token. No auth required by design: the
 * official scanning the code is signed out, and often not a portal user at all.
 */
export async function verifyCard(token: string): Promise<VerifyCardResult> {
  const trimmed = (token ?? '').trim();
  if (!trimmed) return { kind: 'not-found' };

  const client = getSupabaseClient();
  if (!client) return { kind: 'not-found' };

  // An aborted request resolves like any network failure (`status: 0`).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  let answer;
  try {
    answer = await client.rpc('verify_yellow_card', { p_token: trimmed }).abortSignal(controller.signal);
  } finally {
    clearTimeout(timer);
  }
  const { data, error } = answer;
  if (error) {
    // `22P02` is a token that is not a well-formed uuid. Surfacing it apart from
    // an unknown token would confirm the token format to a prober, so it is
    // `not-found` too. Every other error — supabase-js resolves a network failure
    // as `status: 0` rather than throwing, and a timeout or 5xx likewise — is a failed check,
    // the same for every token, so telling it apart leaks nothing (issue #52).
    return error.code === '22P02' ? { kind: 'not-found' } : { kind: 'unavailable' };
  }
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as VerifiedCard[];
  return rows[0] ? { kind: 'found', card: rows[0] } : { kind: 'not-found' };
}

/**
 * Pure: a `withdraw_yellow_card_application` errcode -> citizen copy.
 * `42501` covers not-yours and wrong-status alike — withdrawal is legal only
 * from `pending` / `revision_requested` / `resubmitted`.
 */
export function translateWithdrawError(code: string | undefined): string {
  switch (code) {
    case '42501':
      return 'This application can no longer be withdrawn.';
    case 'P0002':
      return 'We could not find that application.';
    default:
      return 'We could not withdraw that application right now. Please try again later.';
  }
}

export const yellowCardService = {
  async getMyApplications(): Promise<MyYellowCardApplication[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from('my_yellow_card_applications')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (error) throw new Error('Could not load your Yellow Card information right now. Please try again later.');
    return (data as MyYellowCardApplication[]) ?? [];
  },

  /**
   * One application by id. The view self-scopes to the caller, so `.eq('id', …)`
   * filters within rows already restricted to this citizen — never add a
   * `user_id` filter. A row belonging to someone else simply is not there,
   * which the caller renders as the same not-found screen as a bad id.
   */
  async getMyApplication(id: string): Promise<MyYellowCardApplication | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
      .from('my_yellow_card_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error('Could not load your Yellow Card information right now. Please try again later.');
    return (data as MyYellowCardApplication) ?? null;
  },

  /**
   * Rewrites the application's fields and moves it to `resubmitted`. Layer 12a
   * triggers resume the SLA clock; nothing is set client-side.
   *
   * Mock mode resolves silently: `requestService.updateRequest` matches on
   * `bookingNumber` only and cannot address a Yellow Card row, and inventing a
   * new StoredRequest would misrepresent an edit as a fresh application.
   */
  async resubmitApplication(applicationId: string, values: YellowCardFieldValues): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.rpc(
      'update_yellow_card_application',
      mapResubmitToParams(applicationId, values),
    );
    if (error) throw new YellowCardSubmitError(translateResubmitError(error.code, error.message));
  },

  /**
   * Withdraw a live application, freeing the citizen to submit a new one.
   * Mock mode is a no-op: mock records carry no application id.
   */
  async withdrawApplication(applicationId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.rpc('withdraw_yellow_card_application', {
      p_application_id: applicationId,
    });
    if (error) throw new YellowCardSubmitError(translateWithdrawError(error.code));
  },

  async getMyCards(): Promise<MyYellowCard[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from('my_yellow_cards')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error('Could not load your Yellow Card information right now. Please try again later.');
    return (data as MyYellowCard[]) ?? [];
  },

  async submitApplication(fields: YellowCardApplicationFields): Promise<SubmittedApplication> {
    const client = getSupabaseClient();
    if (!client) {
      const reference_number = `YC-${new Date().getFullYear()}-${String(
        Math.floor(Math.random() * 999999),
      ).padStart(6, '0')}`;
      requestService.addRequest({
        type: 'Yellow Card Application',
        arn: reference_number,
        status: 'Pending Review',
        details: { ...fields },
      });
      return { id: `mock-${Date.now()}`, reference_number };
    }

    const firstName = fields.firstName.trim();
    const lastName = fields.lastName.trim();
    const completeAddress = fields.completeAddress.trim();
    const contactNumber = fields.contactNumber.trim();
    const emailAddress = fields.emailAddress.trim();
    const voterIdNumber = fields.voterIdNumber.trim();
    const yearsOfResidency = boundedInt(fields.yearsOfResidency, 0, 120);

    const problem =
      (!firstName ? 'Please enter a first name.' : null) ??
      (!lastName ? 'Please enter a last name.' : null) ??
      (!completeAddress ? 'Please enter a complete address.' : null) ??
      (!voterIdNumber ? "Please enter your Voter's ID number." : null) ??
      fieldTooLong('First name', firstName, LIMITS.name) ??
      fieldTooLong('Last name', lastName, LIMITS.name) ??
      fieldTooLong('Complete address', completeAddress, LIMITS.address) ??
      fieldTooLong("Voter's ID number", voterIdNumber, LIMITS.shortText) ??
      emailError(emailAddress) ??
      phMobileError(contactNumber) ??
      (yearsOfResidency === null ? 'Years of residency must be a whole number between 0 and 120.' : null);
    if (problem) throw new YellowCardSubmitError(problem);

    const params = {
      p_first_name: firstName,
      p_last_name: lastName,
      p_date_of_birth: fields.dateOfBirth,
      p_gender_code: fields.genderCode,
      p_civil_status_code: fields.civilStatusCode,
      p_barangay_code: fields.barangayCode,
      p_complete_address: completeAddress,
      p_contact_number: contactNumber,
      p_email_address: emailAddress,
      p_years_of_residency: yearsOfResidency,
      p_voter_id_number: voterIdNumber,
      p_privacy_consent: fields.privacyConsent,
      p_middle_name: fields.middleName?.trim() || null,
      p_suffix: fields.suffix?.trim() || null,
    };
    const { data, error } = await client.rpc('submit_yellow_card_application', params);
    if (error) throw new YellowCardSubmitError(translateSubmitError(error.message, error.code));
    return data as unknown as SubmittedApplication;
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
  async uploadVoterIdDocument(
    applicationId: string,
    file: File,
    progress: DocumentUploadProgress = {},
  ): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    const ext = safeExt(file);
    if (!ext) throw new YellowCardSubmitError('Please upload a JPG, PNG, or PDF file.');

    if (!progress.rowId) {
      const { data: reserved, error: reserveError } = await client.rpc(
        'request_yellow_card_document_upload',
        { p_application_id: applicationId, p_document_type_code: 'voter_id', p_ext: ext },
      );
      if (reserveError) {
        throw new YellowCardSubmitError(translateUploadError('reserve', reserveError.code, reserveError.message));
      }
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
      if (uploadError) {
        // StorageError does not carry a Postgres-style `code` field (only
        // `status`/`statusCode`), so there is no safe code to pass through here.
        throw new YellowCardSubmitError(translateUploadError('upload', undefined, uploadError.message));
      }
      progress.bytesLanded = true;
    }

    const { error: confirmError } = await client.rpc('confirm_upload', {
      p_kind: 'yellow_card_document',
      p_row_id: progress.rowId,
      p_size_bytes: file.size,
      p_mime_type: canonicalMime(ext),
    });
    if (confirmError) {
      throw new YellowCardSubmitError(translateUploadError('confirm', confirmError.code, confirmError.message));
    }
  },
};
