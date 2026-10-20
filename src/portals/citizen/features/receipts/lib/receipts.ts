/** Reads `my_acknowledgement_receipts` (DB layer `l66`).
 *
 * Same env-gated seam as every other feature lib: `getSupabaseClient()`
 * returns null when the backend is unconfigured, and the read-only methods
 * here return `[]` / `null` rather than fabricating rows. A fabricated receipt
 * would be worse than none — it is the citizen's evidence that the city
 * received their submission, so inventing one would misstate the record.
 */

import { getSupabaseClient } from '@/portals/citizen/lib/supabase/client';
import type { AcknowledgementReceipt, ReceiptService } from '../types';

/** Citizen-facing copy for any receipt read failure. Never interpolate
 * `error.message` — it is raw PostgREST text naming views and columns. */
const RECEIPT_LOAD_ERROR = 'Could not load your receipt right now. Please try again later.';

/** The one public bucket. Seals are stored as bare paths inside it. */
const SITE_CONTENT_BUCKET = 'site-content';

/** Every column of the view, in declaration order. */
const RECEIPT_COLUMNS =
  'id, service, yellow_card_application_id, incident_id, booking_id, reference_number, ' +
  'received_at, received_at_manila, officer_full_name, officer_unit, officer_designation, ' +
  'officer_is_placeholder, agency_name, seal_path, issued_at';

export const receiptService = {
  /**
   * Every receipt this citizen holds, newest first.
   *
   * The view self-scopes on `auth.uid()`, so there is deliberately no
   * `.eq('citizen_id', …)` here — adding one is the documented way to get a
   * 403 off a base table, and it would be a second copy of a rule the
   * database already owns.
   */
  async getMine(): Promise<AcknowledgementReceipt[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from('my_acknowledgement_receipts')
      .select(RECEIPT_COLUMNS)
      .order('received_at', { ascending: false });
    if (error) throw new Error(RECEIPT_LOAD_ERROR);
    return (data as unknown as AcknowledgementReceipt[]) ?? [];
  },

  /**
   * One receipt by the reference number printed on it, or null when this
   * citizen has none for that reference.
   *
   * Null is the ordinary case, not an error: submissions made before `l66`
   * carry no receipt at all (DB ADR 0001), and the view returns nothing for a
   * reference belonging to someone else. Both render the same honest "no
   * receipt" state.
   *
   * `maybeSingle()` is deliberate. `reference_number` has no unique index —
   * uniqueness comes from the per-service prefix and sequence that generate
   * it, not from a constraint — so a duplicate would surface here as an error
   * instead of silently rendering whichever row came back first.
   */
  async getByReference(reference: string): Promise<AcknowledgementReceipt | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
      .from('my_acknowledgement_receipts')
      .select(RECEIPT_COLUMNS)
      .eq('reference_number', reference)
      .maybeSingle();
    if (error) throw new Error(RECEIPT_LOAD_ERROR);
    return (data as unknown as AcknowledgementReceipt) ?? null;
  },
};

/**
 * Absolute URL for the seal **this receipt was issued with**.
 *
 * Takes the path off the receipt row, never off `public_site_info`. Seals are
 * insert-only: uploading a new one writes a new path and leaves already-issued
 * receipts pointing at the old file (DB ADR 0001). Resolving the *current*
 * seal here would stamp today's seal onto last month's receipt.
 *
 * Returns null in mock mode — there is no client to resolve against, and a
 * bundled fallback image would show a seal the database never named.
 */
export function receiptSealUrl(sealPath: string | null | undefined): string | null {
  if (!sealPath) return null;
  const client = getSupabaseClient();
  if (!client) return null;
  return client.storage.from(SITE_CONTENT_BUCKET).getPublicUrl(sealPath).data.publicUrl;
}

/** Citizen-facing name of the service a receipt covers. */
export function receiptServiceLabel(service: ReceiptService): string {
  switch (service) {
    case 'yellow_card':
      return 'Yellow Card Application';
    // Plural — that is the enum label on the database side.
    case 'incidents':
      return 'Incident Report';
    case 'booking':
      return 'Venue Booking';
    default:
      return 'Submission';
  }
}

/**
 * Pure: the set of reference numbers that have a receipt.
 *
 * Lets the dashboard show a receipt link only on rows that actually have one,
 * instead of offering every row a link that may land on "no receipt".
 */
export function receiptReferences(receipts: AcknowledgementReceipt[]): Set<string> {
  return new Set(receipts.map((r) => r.reference_number));
}
