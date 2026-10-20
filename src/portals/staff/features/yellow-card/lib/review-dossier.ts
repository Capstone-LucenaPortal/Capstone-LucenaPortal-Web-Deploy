import { createClient, type Db } from "@/shared/supabase/server";
import { getLabels } from "@/portals/staff/lib/supabase/catalogs";
import { toApplication, toDocument, toReview } from "./row-mapper";
import type {
  StaffYellowCardApplicationRow,
  StaffYellowCardDocumentRow,
  StaffYellowCardReviewRow,
} from "./row-mapper";
import type {
  YellowCardApplication,
  YellowCardDocument,
  YellowCardReview,
} from "../types";

/**
 * Column lists are checked against the generated types: a column
 * the view does not have is a compile error. That holds only while each list
 * is ONE string literal on ONE source line — split it with `+` or build it
 * with `.join()` and TypeScript widens it to `string`, which postgrest-js
 * cannot parse, so the row type degrades to GenericStringError[].
 *
 * The results are still cast to their row types below. All three were verified
 * by live query on 2026-08-07. Do not add a column without doing the same.
 *
 * The detail list is a superset of the queue's, and is written out rather than
 * built from it: the two reads answer different screens' questions and their
 * column lists are now owned by different modules, which is the same call
 * `dashboard-card.ts` already makes against this view. Each list is asserted
 * exactly by its own test, so neither can be narrowed by accident. Nothing
 * ties the two together any more, though: a column the view gains for both
 * screens has to be added in both places.
 */
const DETAIL_COLUMNS = "id, reference_number, first_name, middle_name, last_name, suffix, barangay_name, status, submitted_at, due_at, document_count, deadline_state, date_of_birth, gender_code, civil_status_code, complete_address, contact_number, email_address, years_of_residency, voter_id_number, privacy_consent, needs_dedup_review, decided_at, review_cycles";

/**
 * Layer 52 views. Note the column names that differ from the obvious guesses:
 * document_type_code (not doc_type_code), byte_size (not size_bytes),
 * reviewed_at (not created_at).
 */
const DOCUMENT_COLUMNS = "id, application_id, document_type_code, document_type_label, original_filename, mime_type, byte_size, uploaded_at, superseded_by";

const REVIEW_COLUMNS = "id, application_id, decision, reason, reviewed_at, reviewed_by_name";

/**
 * Everything a reviewer needs on screen to decide about one application.
 *
 * Flat, with the labels named beside the application rather than folded onto
 * it: that object mirrors a database row and the row mapper owns its contract,
 * so a hand-resolved gender label sitting next to the view-resolved
 * `document_type_label` would read as the same kind of thing and isn't.
 *
 * Data, not a view model. Resolving a code to a label is domain knowledge about
 * what a reviewer needs; formatting a byte count or a date is one screen's
 * typography, and belongs to the caller.
 */
export interface YellowCardReviewDossier {
  application: YellowCardApplication;
  /** The uploads currently backing the application. Empty, never absent. */
  documents: YellowCardDocument[];
  /** Null before anyone has reviewed it. */
  latestReview: YellowCardReview | null;
  genderLabel: string;
  civilStatusLabel: string;
}

/**
 * Answers "what does a reviewer need on screen to decide about this
 * application", so the detail route does not have to know the read order, the
 * concurrency shape, which catalogs exist, or the fallback rule.
 *
 * Two-phase on purpose: the application is read first and a nonexistent id
 * returns null without firing the other four reads.
 *
 * The current staff user is deliberately not here. It is owned by the auth
 * feature and answers "who is looking", not "what is being looked at".
 *
 * This is the module's whole interface. The three reads below are private, and
 * stay private: an export is an export, and the next caller to import one will
 * not read the comment above it. See ADR-0003.
 */
export async function getReviewDossier(
  id: string,
  db?: Db,
): Promise<YellowCardReviewDossier | null> {
  const application = await readApplication(id, db);
  if (!application) return null;

  const [documents, latestReview, genders, civilStatuses] = await Promise.all([
    readLiveDocuments(application.id, db),
    readLatestReview(application.id, db),
    getLabels("public_genders"),
    getLabels("public_civil_statuses"),
  ]);

  return {
    application,
    documents,
    latestReview,
    // An unlabelled code still tells the reviewer something; an empty field
    // does not. Fall back rather than blanking. This is also how a failed
    // catalog read degrades — getLabels swallows it and returns an empty map.
    genderLabel: genders[application.gender_code] ?? application.gender_code,
    civilStatusLabel:
      civilStatuses[application.civil_status_code] ?? application.civil_status_code,
  };
}

/** Returns null when the id does not exist or is not visible to this staff member. */
async function readApplication(
  id: string,
  db?: Db,
): Promise<YellowCardApplication | null> {
  const supabase = db ?? await createClient();
  const { data, error } = await supabase
    .from("staff_yellow_card_queue")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`staff_yellow_card_queue detail read failed: ${error.message}`);
  }

  return toApplication(data as StaffYellowCardApplicationRow | null);
}

/**
 * The uploads currently backing this application.
 *
 * `superseded_by is null` matters: when a citizen resubmits, the replaced
 * upload stays in the table pointing at the one that replaced it. Without this
 * filter a reviewer would be shown the photo they already rejected alongside
 * the new one, with nothing to tell them apart.
 */
async function readLiveDocuments(
  applicationId: string,
  db?: Db,
): Promise<YellowCardDocument[]> {
  const supabase = db ?? await createClient();
  const { data, error } = await supabase
    .from("staff_yellow_card_documents")
    .select(DOCUMENT_COLUMNS)
    .eq("application_id", applicationId)
    .is("superseded_by", null)
    .order("uploaded_at", { ascending: true });

  if (error) {
    throw new Error(`staff_yellow_card_documents read failed: ${error.message}`);
  }

  return ((data as StaffYellowCardDocumentRow[] | null) ?? []).map(toDocument);
}

/**
 * The most recent decision, which is what the detail page's context banner
 * quotes. Returns null before anyone has reviewed the application.
 */
async function readLatestReview(
  applicationId: string,
  db?: Db,
): Promise<YellowCardReview | null> {
  const supabase = db ?? await createClient();
  const { data, error } = await supabase
    .from("staff_yellow_card_reviews")
    .select(REVIEW_COLUMNS)
    .eq("application_id", applicationId)
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`staff_yellow_card_reviews read failed: ${error.message}`);
  }

  return toReview(data as StaffYellowCardReviewRow | null);
}
