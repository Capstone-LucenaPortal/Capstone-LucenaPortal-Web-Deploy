/** Domain types for the Yellow Card slice. */

/**
 * Every column of the `my_yellow_card_applications` view, verified against the
 * sandbox on 2026-08-07. The revise flow prefills its form straight from this,
 * so a missing column here silently blanks a field.
 */
/**
 * Every value `yellow_card_applications.status` can hold.
 *
 * Verified against the Sandbox project on 2026-10-02. The database is the
 * authority: if the `yellow_card_application_status` enum gains a member, this
 * list has to be updated by hand, and nothing in the frontend can detect that for
 * you. What it DOES buy is that once a member is added here, every exhaustive
 * switch over the union fails the typecheck until it is given an answer — which
 * is how a new status is stopped from quietly inheriting another one's behaviour.
 *
 * Lives in this type-only module rather than the slice's lib so the dashboard can
 * import it without pulling in the Supabase service.
 */
export const YELLOW_CARD_APPLICATION_STATUSES = [
  'pending',
  'resubmitted',
  'revision_requested',
  'approved',
  'rejected',
  'withdrawn',
] as const;

export type YellowCardApplicationStatus = (typeof YELLOW_CARD_APPLICATION_STATUSES)[number];

/** Narrows the `string` the hand-rolled row interfaces carry. */
export function isYellowCardApplicationStatus(
  status: string,
): status is YellowCardApplicationStatus {
  return (YELLOW_CARD_APPLICATION_STATUSES as readonly string[]).includes(status);
}

export interface MyYellowCardApplication {
  id: string;
  reference_number: string;
  status: string;
  needs_dedup_review: boolean;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  date_of_birth: string;
  gender_code: string;
  civil_status_code: string;
  barangay_code: string;
  barangay_name: string;
  complete_address: string;
  contact_number: string;
  email_address: string;
  years_of_residency: number;
  voter_id_number: string;
  privacy_consent: boolean;
  submitted_at: string;
  sla_target_hours: number;
  due_at: string | null;
  decided_at: string | null;
  current_decision: string | null;
  current_reason: string | null;
  current_reviewed_at: string | null;
  document_count: number;
}

export interface MyYellowCard {
  id: string;
  card_number: string;
  verification_token: string;
  status: string;
  application_id: string;
  holder_name: string;
  barangay_name: string;
  valid_from: string;
  expires_at: string | null;
  revoked_reason: string | null;
}

export interface YellowCardApplicationFields {
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  dateOfBirth: string;
  genderCode: string;
  civilStatusCode: string;
  barangayCode: string;
  completeAddress: string;
  contactNumber: string;
  emailAddress: string;
  yearsOfResidency: number;
  voterIdNumber: string;
  privacyConsent: boolean;
}

/**
 * The 13 fields shared by the apply and revise forms, all as strings because
 * they are bound straight to inputs. The apply page extends this with its own
 * `idFile` and `privacyConsent`; the revise flow has neither.
 */
export interface YellowCardFieldValues {
  voterIdNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  dateOfBirth: string;
  genderCode: string;
  civilStatusCode: string;
  barangayCode: string;
  completeAddress: string;
  contactNumber: string;
  emailAddress: string;
  yearsOfResidency: string;
}

export interface SubmittedApplication {
  id: string;
  reference_number: string;
}

/**
 * The two columns `verify_yellow_card(p_token uuid)` returns. This is the
 * system's ONLY anon-callable read RPC: a Verifier scans the QR and gets exactly
 * this, with no table access granted anywhere. Barangay, card number and Valid
 * From were dropped (SCRUM-255; narrowed in the database by DB layer l87,
 * SCRUM-258): anyone holding a Digital Card's link can call it, so it answers
 * only what the Verifier needs — whose card, and is it good.
 *
 * Deliberately returns zero rows for an unknown token — it is not an oracle and
 * gives no reason. Callers must render one undifferentiated "not recognized"
 * message for empty results; distinguishing "no such card" from "revoked" here
 * would hand an attacker a token-enumeration signal.
 */
export interface VerifiedCard {
  holder_name: string;
  /** 'active' | 'revoked' | 'superseded' — a row can come back non-active. */
  status: string;
}
