/** Domain types for the Acknowledgement Receipt slice (DB layer `l66`).
 *
 * The receipt is the record of *receiving* a submission, under IRR Rule VII
 * §2(c). It is issued by a trigger on insert into `yellow_card_applications`,
 * `incidents` and `bookings`, so it exists from the moment of submission and
 * never changes afterwards. Submissions made before `l66` have no receipt at
 * all (DB ADR 0001) — that absence is rendered honestly rather than filled in.
 */

/** `module_code` as it appears on a receipt.
 *
 * `incidents` is plural — that is the enum label, verified against the sandbox.
 * A singular `'incident'` here silently matches nothing. */
export type ReceiptService = 'yellow_card' | 'incidents' | 'booking' | 'platform';

/** One row of `my_acknowledgement_receipts`.
 *
 * The view is already scoped with `where citizen_id = auth.uid()`, so callers
 * must never add a citizen filter of their own. Nullability mirrors the base
 * table: exactly one of the three record ids is set, everything else is NOT
 * NULL — including `seal_path`, which always names an object even if that
 * object has not been uploaded on a given project. */
export interface AcknowledgementReceipt {
  id: string;
  service: ReceiptService;
  yellow_card_application_id: string | null;
  incident_id: string | null;
  booking_id: string | null;
  reference_number: string;
  /** Raw timestamptz. Prefer `received_at_manila` for display. */
  received_at: string;
  /** Pre-formatted by the view in Asia/Manila, e.g. `September 22, 2026, 4:05 PM`.
   * Formatted server-side so the printed receipt does not depend on the
   * browser's timezone. */
  received_at_manila: string;
  officer_full_name: string;
  officer_unit: string;
  officer_designation: string;
  /** True while no real Officer of Record has been nominated (SCRUM-105). */
  officer_is_placeholder: boolean;
  agency_name: string;
  /** Path inside the `site-content` bucket, as recorded on this receipt.
   * Seals are insert-only, so an old receipt keeps the seal it was issued
   * with — never resolve this from the *current* `public_site_info`. */
  seal_path: string;
  issued_at: string;
}
