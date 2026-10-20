/** Domain types for the incident-report slice. */

/**
 * ## When a citizen actually hears about their report
 *
 * Since DB layer `l78` (SCRUM-180, sandbox 2026-10-10). Before it, only the
 * sweeper wrote incident notices. Worth knowing before writing any copy on
 * `app/incident/page.tsx`.
 *
 * The citizen IS notified, by `notify_citizen`, when:
 *
 * - `routed` — staff first route the report ("sent to <Department>"). A
 *   reroute is silent.
 * - `claimed` — a responder wins the claim. It names the department, never
 *   the responder.
 * - `resolution_submitted` — `resolve_incident`. "Confirm it, or reopen it",
 *   quoting `incident_config.auto_close_day`.
 * - `resolution_nudge` — sweeper, once `resolved_at` is older than `nudge_day`
 *   and still unconfirmed.
 * - `auto_confirmed` — sweeper, closed at `auto_close_day`.
 * - `expired_unverified` — sweeper, an unverified report closed after
 *   `confirmation_window_days`.
 *
 * Release, force-release and reject (internal hand-offs) notify nothing, by
 * ruling. A re-claim after a release sends `claimed` again. Anonymous reports
 * are notified like any other. The day counts are LGU-editable through
 * `public_incident_config`, so copy states no number.
 *
 * Since `l64` an email accompanies each notice, on
 * projects where the worker is configured — see `MyNotification` in
 * `@/features/notifications/types` for why the service copy still names only the
 * inbox.
 */

export interface IncidentSubmission {
  /** `public_incident_types.code`, straight from catalogService — never a display label. */
  incidentTypeCode: string;
  /** Kept only for the mock-mode record and the confirmation screen. */
  incidentTypeLabel: string;
  location: string;
  /** `public_barangays.code`, straight from catalogService — never a display label. */
  barangayCode: string;
  barangayLabel: string;
  description: string;
  isAnonymous: boolean;
  hasPhoto: boolean;
}

export interface IncidentResult {
  referenceNumber: string;
  /** `incidents.id`, needed by `uploadIncidentPhoto`. Empty string in mock mode. */
  incidentId: string;
  verified: boolean;
  mode: 'live' | 'mock';
}

export interface MyIncident {
  id: string;
  reference_number: string;
  incident_type_code: string;
  type_label: string;
  category_code: string;
  incident_level: string;
  status: string;
  closure_reason: string | null;
  is_anonymous: boolean;
  is_verified: boolean;
  verified_at: string | null;
  description: string;
  address: string;
  barangay_code: string;
  barangay_name: string;
  assigned_department_code: string | null;
  assigned_department_label: string | null;
  submitted_at: string;
  sla_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  reopened_count: number;
  photo_count: number;
  /** The Original's reference on a Duplicate (l85); null on every other report. */
  original_reference: string | null;
}

/**
 * Where a photo upload got to before it failed. `bytesLanded` distinguishes an
 * upload-stage failure (object never reached storage) from a confirm-stage
 * failure (object landed, only the RPC failed) — resuming needs to know which
 * of the three steps to skip.
 */
export interface PhotoUploadProgress {
  rowId: string;
  bucket: string;
  storagePath: string;
  bytesLanded: boolean;
}

/**
 * A `my_incident_photos` row (DB layer l74). An id, never a storage path: the
 * path comes from `get_document_path` per request, which re-checks entitlement.
 */
export interface MyIncidentPhoto {
  id: string;
  incident_id: string;
  kind: 'before' | 'after';
  cycle_number: number;
  /** True when the photo belongs to the incident's current (latest) cycle. */
  is_current_cycle: boolean;
  uploaded_at: string;
}
