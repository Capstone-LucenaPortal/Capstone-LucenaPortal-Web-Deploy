import { parseDeadlineState } from "./deadline";
import { STATUS_ORDER } from "./status";
import type {
  YellowCardApplication,
  YellowCardDecision,
  YellowCardDocument,
  YellowCardQueueItem,
  YellowCardReview,
  YellowCardStatus,
} from "../types";

/**
 * Every column of a view is nullable in the generated types, even ones the
 * underlying table declares NOT NULL. These row types mirror that honestly and
 * the mappers below collapse it.
 */
export type StaffYellowCardQueueRow = {
  id: string | null;
  reference_number: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  barangay_name: string | null;
  status: YellowCardStatus | null;
  submitted_at: string | null;
  due_at: string | null;
  document_count: number | null;
  deadline_state: string | null;
};

export type StaffYellowCardApplicationRow = StaffYellowCardQueueRow & {
  date_of_birth: string | null;
  gender_code: string | null;
  civil_status_code: string | null;
  complete_address: string | null;
  contact_number: string | null;
  email_address: string | null;
  years_of_residency: number | null;
  voter_id_number: string | null;
  privacy_consent: boolean | null;
  needs_dedup_review: boolean | null;
  decided_at: string | null;
  review_cycles: number | null;
};

/**
 * id and status are load-bearing: the first keys the row and builds its link,
 * the second decides whether decision buttons render. A row missing either is
 * not a degraded row, it is evidence the query is wrong — fail loudly rather
 * than render a link to /yellow-card/undefined.
 *
 * Everything else degrades to a safe default, because a blank barangay is a
 * cosmetic problem and a thrown page is not.
 */
export function toQueueItem(row: StaffYellowCardQueueRow): YellowCardQueueItem {
  if (!row.id) {
    throw new Error("staff_yellow_card_queue returned a row with no id");
  }
  if (!row.status) {
    throw new Error(
      `staff_yellow_card_queue returned row ${row.id} with no status`,
    );
  }

  return {
    id: row.id,
    reference_number: row.reference_number ?? "",
    first_name: row.first_name ?? "",
    middle_name: row.middle_name,
    last_name: row.last_name ?? "",
    suffix: row.suffix,
    barangay_name: row.barangay_name ?? "",
    status: row.status,
    submitted_at: row.submitted_at ?? "",
    due_at: row.due_at,
    document_count: row.document_count ?? 0,
    // Not degraded to null like the cosmetic columns: an unknown value would
    // silently hide the warning this column exists to show.
    deadline_state: parseDeadlineState(row.deadline_state),
  };
}

export function toApplication(
  row: StaffYellowCardApplicationRow | null,
): YellowCardApplication | null {
  if (!row) return null;

  return {
    ...toQueueItem(row),
    date_of_birth: row.date_of_birth ?? "",
    gender_code: row.gender_code ?? "",
    civil_status_code: row.civil_status_code ?? "",
    complete_address: row.complete_address ?? "",
    contact_number: row.contact_number ?? "",
    email_address: row.email_address ?? "",
    years_of_residency: row.years_of_residency ?? 0,
    voter_id_number: row.voter_id_number ?? "",
    privacy_consent: row.privacy_consent ?? false,
    needs_dedup_review: row.needs_dedup_review ?? false,
    decided_at: row.decided_at,
    review_cycles: row.review_cycles ?? 0,
  };
}

export type StaffYellowCardDocumentRow = {
  id: string | null;
  application_id: string | null;
  document_type_code: string | null;
  document_type_label: string | null;
  original_filename: string | null;
  mime_type: string | null;
  byte_size: number | null;
  uploaded_at: string | null;
  superseded_by: string | null;
};

export type StaffYellowCardReviewRow = {
  id: string | null;
  application_id: string | null;
  decision: YellowCardDecision | null;
  reason: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
};

/**
 * id is load-bearing the same way it is on a queue row: it is the argument to
 * get_document_path(), so a document without one cannot be opened at all.
 */
export function toDocument(row: StaffYellowCardDocumentRow): YellowCardDocument {
  if (!row.id) {
    throw new Error("staff_yellow_card_documents returned a row with no id");
  }

  return {
    id: row.id,
    document_type_code: row.document_type_code ?? "",
    // An unlabelled code still names the document; an empty heading does not.
    document_type_label: row.document_type_label ?? row.document_type_code ?? "Document",
    original_filename: row.original_filename ?? "",
    mime_type: row.mime_type ?? "",
    byte_size: row.byte_size ?? 0,
    uploaded_at: row.uploaded_at ?? "",
  };
}

/**
 * `decision` is load-bearing: ReviewContext branches its copy on it, so a row
 * without one would render a review that says nothing. Everything else
 * degrades — including the reviewer name, which is a courtesy, not a fact the
 * page depends on.
 */
export function toReview(
  row: StaffYellowCardReviewRow | null,
): YellowCardReview | null {
  if (!row) return null;

  if (!row.decision) {
    throw new Error(
      `staff_yellow_card_reviews returned row ${row.id ?? "(no id)"} with no decision`,
    );
  }

  return {
    id: row.id ?? "",
    decision: row.decision,
    reason: row.reason,
    reviewed_at: row.reviewed_at ?? "",
    reviewed_by_name: row.reviewed_by_name ?? "a staff member",
  };
}

/**
 * PostgREST has no GROUP BY, so the tab counts come from one request that
 * fetches a single enum column for every row and tallies it here. Cheaper than
 * six head-count round trips and simple to test.
 */
export function countByStatus(
  rows: { status: YellowCardStatus | null }[],
): Record<YellowCardStatus, number> {
  const counts = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, 0]),
  ) as Record<YellowCardStatus, number>;

  for (const row of rows) {
    if (row.status) counts[row.status] += 1;
  }
  return counts;
}
