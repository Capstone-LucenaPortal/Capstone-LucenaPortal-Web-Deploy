import type { Database } from "@/shared/supabase/types";
import type { DeadlineState } from "./lib/deadline";

/**
 * The database's own vocabulary, not a hand-written copy of it. Includes
 * `withdrawn`, which the mock model omitted and which 9 of 30 sandbox rows
 * are in.
 */
export type YellowCardStatus =
  Database["public"]["Enums"]["yellow_card_application_status"];

/** The decision argument accepted by review_yellow_card_application. */
export type YellowCardDecision = Database["public"]["Enums"]["yellow_card_decision"];

/**
 * The columns staff_yellow_card_queue projects that the LIST needs.
 *
 * Gender and civil status are absent on purpose: the queue table does not show
 * them, and fetching them would mean two catalog lookups per page render for
 * data nobody reads.
 */
export interface YellowCardQueueItem {
  id: string;
  reference_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  barangay_name: string;
  status: YellowCardStatus;
  submitted_at: string;
  /** NULL while the SLA clock is paused — i.e. while the ball is with the citizen. */
  due_at: string | null;
  /** Excludes superseded uploads, so a resubmission does not inflate it. */
  document_count: number;
  /**
   * On track / At risk / Overdue, computed by the database in Working Time
   * (l80). NULL when the clock is not running — never a state of its own.
   */
  deadline_state: DeadlineState | null;
}

/** Everything the detail page needs. Superset of the list shape. */
export interface YellowCardApplication extends YellowCardQueueItem {
  date_of_birth: string;
  /** A code — `male`/`female`. Label comes from public_genders. */
  gender_code: string;
  /** A code — `single`/`married`/`widowed`/`separated`/`annulled`. */
  civil_status_code: string;
  complete_address: string;
  contact_number: string;
  email_address: string;
  years_of_residency: number;
  voter_id_number: string;
  privacy_consent: boolean;
  needs_dedup_review: boolean;
  decided_at: string | null;
  review_cycles: number;
}

/**
 * A confirmed upload, from staff_yellow_card_documents (layer 52).
 *
 * Deliberately carries no storage_path — the view does not expose one. The only
 * way to the bytes is get_document_path(), which re-checks entitlement server
 * side. See /api/yellow-card/documents/[id].
 */
export interface YellowCardDocument {
  id: string;
  document_type_code: string;
  /** Human-readable type, already resolved by the view. */
  document_type_label: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  uploaded_at: string;
}

/** One entry of the review history, from staff_yellow_card_reviews (layer 52). */
export interface YellowCardReview {
  id: string;
  decision: YellowCardDecision;
  /** NULL for an approval; required by the RPC for revise and reject. */
  reason: string | null;
  reviewed_at: string;
  reviewed_by_name: string;
}
