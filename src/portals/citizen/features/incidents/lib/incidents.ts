import { getSupabaseClient } from '@/portals/citizen/lib/supabase/client';
import { requestService } from '@/portals/citizen/lib/mock/request-store';
import { LIMITS, fieldTooLong } from '@/portals/citizen/lib/validation';
import { safeExt, canonicalMime } from '@/portals/citizen/lib/storage/file-validation';
import { stripImageMetadata } from '@/portals/citizen/lib/storage/image-sanitizer';
import type { IncidentSubmission, IncidentResult, MyIncident, MyIncidentPhoto, PhotoUploadProgress } from '../types';

export class IncidentSubmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IncidentSubmitError';
  }
}

/**
 * Pure: form input -> submit_incident params. Codes come from the
 * `public_incident_types` / `public_barangays` catalogs read by
 * `catalogService`, so this only guards against an unselected dropdown —
 * there is no label->code table to drift out of sync with the database.
 */
export function mapIncidentToParams(input: IncidentSubmission): {
  p_incident_type_code: string;
  p_description: string;
  p_address: string;
  p_barangay_code: string;
  p_is_anonymous: boolean;
} {
  if (!input.incidentTypeCode) throw new IncidentSubmitError('Please select the type of incident.');
  if (!input.barangayCode) throw new IncidentSubmitError('Please select a barangay.');
  const description = input.description?.trim() ?? '';
  const address = input.location?.trim() ?? '';
  if (!description) throw new IncidentSubmitError('Please describe the incident.');
  if (!address) throw new IncidentSubmitError('Please provide the incident location.');
  const tooLong =
    fieldTooLong('Description', description, LIMITS.description) ??
    fieldTooLong('Location', address, LIMITS.address);
  if (tooLong) throw new IncidentSubmitError(tooLong);
  return {
    p_incident_type_code: input.incidentTypeCode,
    p_description: description,
    p_address: address,
    p_barangay_code: input.barangayCode,
    p_is_anonymous: input.isAnonymous,
  };
}

/**
 * Pure: a `submit_incident` errcode -> a sentence written for a citizen.
 *
 * Keyed on the Postgres errcode, never on message text. `submit_incident`
 * raises five distinct codes (l28_incident_citizen_rpcs.sql); its messages are
 * written for developers and change without warning. The previous
 * message-substring version matched 'active' inside 'inactive', so an unknown
 * catalog code was reported to citizens as a quota problem.
 */
export function translateSubmitError(code: string | undefined): string {
  switch (code) {
    case '42501':
      return 'Please sign in to file a report.';
    case 'P0002':
      return 'Please complete your profile before reporting an incident.';
    case '22023':
      return 'A description and location are required.';
    case '23503':
      return 'That option is no longer available. Please pick another.';
    // The cap counts every report whose status is not `closed` — which includes
    // `resolved`. "Wait for one to be resolved" could never free a slot.
    case '23514':
      return 'You have reached the maximum number of open reports. A slot frees up when a report is closed — confirming a resolved report closes it.';
    default:
      return 'We could not submit your report right now. Please try again later.';
  }
}

export class IncidentPhotoError extends Error {
  /**
   * Set whenever a reservation already exists at the point of failure, so the
   * caller can resume instead of retrying from scratch. Absent when reserve
   * itself failed — there is nothing to resume.
   */
  progress?: PhotoUploadProgress;

  constructor(message: string, progress?: PhotoUploadProgress) {
    super(message);
    this.name = 'IncidentPhotoError';
    this.progress = progress;
  }
}

/**
 * Pure: an upload-path failure -> a sentence written for a citizen.
 *
 * `stage` names which of the three steps failed, because `P0002` means
 * "no such incident" at reserve but "your file never landed" at confirm.
 *
 * The two text matches run ONLY when there is no Postgres errcode to trust —
 * i.e. `code === undefined`, which in practice means the 'upload' stage: a
 * Supabase `StorageError` carries `status`/`statusCode` but no Postgres-style
 * `code`, so text is the only signal there. `reserve` and `confirm` always
 * carry a real errcode from the RPC, and the database freely interpolates
 * reference numbers and UUIDs into its error text (e.g. "INC-2026-000413 is
 * closed"), so matching text there risks hijacking an unrelated errcode —
 * '413' inside a reference number must never read as "payload too large".
 * Raw Postgres and storage text is never rendered to the citizen either way.
 */
export function translateIncidentUploadError(
  stage: 'reserve' | 'upload' | 'confirm',
  code: string | undefined,
  message: string,
): string {
  const m = (message ?? '').toLowerCase();
  if (code === undefined) {
    if (
      m.includes('exceeded the maximum allowed size') ||
      m.includes('payload too large')
    ) {
      return 'That file is too large. Please upload a file under 5MB.';
    }
    if (m.includes('mime') || m.includes('content type') || m.includes('invalid_mime_type')) {
      return 'That file type is not accepted. Please upload a JPG, PNG or PDF.';
    }
  }
  switch (code) {
    case '42501':
      // Covers no caller, not-your-report, and report-is-closed alike — from the
      // citizen's side these are one situation.
      return 'That report is not accepting photos right now.';
    case '23514':
      return 'This report already has the maximum number of photos.';
    // Ambiguous by code alone: a bad extension at reserve, bad MIME *or* bad
    // size at confirm. Name both rather than guess.
    case '22023':
      return 'That file was not accepted. Please upload a JPG, PNG or PDF under 5MB.';
    case 'P0002':
      return stage === 'confirm'
        ? 'Your photo was uploaded but we could not finish attaching it. Please try again.'
        : 'We could not find that report.';
    default:
      return 'We could not attach your photo right now. Please try again.';
  }
}

/**
 * Pure: a `confirm_incident_resolution` / `reopen_incident` errcode -> citizen copy.
 *
 * Both RPCs (l28_incident_citizen_rpcs.sql) raise `42501` for every "you may
 * not do this to this report" case — not yours, not `resolved`, already
 * confirmed, past the confirmation window. From the citizen's side those are
 * one situation: the button they clicked is no longer live. `22023` is only
 * reachable from `reopen_incident` with a blank reason, which the client-side
 * guard below normally catches first.
 */
export function translateResolutionActionError(code: string | undefined): string {
  switch (code) {
    case '42501':
      return 'This report is no longer awaiting your confirmation.';
    case '22023':
      return "Please tell us why it isn't fixed.";
    case 'P0002':
      return 'We could not find that report.';
    default:
      return 'We could not update that report right now. Please try again later.';
  }
}

/**
 * Confirm a `resolved` report as actually fixed, which closes it and frees the
 * `max_active_reports_per_citizen` slot it was holding. Mock mode is a no-op:
 * mock records carry no incident id to confirm against.
 */
export async function confirmResolution(incidentId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.rpc('confirm_incident_resolution', {
    p_incident_id: incidentId,
  });
  if (error) throw new IncidentSubmitError(translateResolutionActionError(error.code));
}

/**
 * Reopen a `resolved` report the citizen says is not actually fixed. The reason
 * is validated here as well as server-side so a blank textarea produces inline
 * feedback instead of a round-trip that returns raw Postgres text.
 */
export async function reopenIncident(incidentId: string, reason: string): Promise<void> {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) throw new IncidentSubmitError("Please tell us why it isn't fixed.");
  const tooLong = fieldTooLong('Reason', trimmed, LIMITS.description);
  if (tooLong) throw new IncidentSubmitError(tooLong);

  const client = getSupabaseClient();
  if (!client) return;
  const { error } = await client.rpc('reopen_incident', {
    p_incident_id: incidentId,
    p_reason: trimmed,
  });
  if (error) throw new IncidentSubmitError(translateResolutionActionError(error.code));
}

export async function getMyIncidents(): Promise<MyIncident[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('my_incidents')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (error) throw new Error('Could not load your incident reports right now. Please try again later.');
  return (data as MyIncident[]) ?? [];
}

/**
 * The responder's after photos for the resolution the citizen is being asked to
 * confirm (SCRUM-190). Current cycle only: a reopened incident keeps the
 * previous cycle's after photos, and those are evidence of a repair the citizen
 * already rejected.
 *
 * Reads `my_incident_photos` (l74), which self-scopes to `auth.uid()` — the
 * `incident_id` filter narrows, it does not authorise.
 */
export async function getResolutionPhotos(incidentId: string): Promise<MyIncidentPhoto[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('my_incident_photos')
    .select('id, incident_id, kind, cycle_number, is_current_cycle, uploaded_at')
    .eq('incident_id', incidentId)
    .eq('kind', 'after')
    .eq('is_current_cycle', true)
    .order('uploaded_at', { ascending: true });
  if (error) throw new Error('Could not load the photos for this report right now.');
  return (data as MyIncidentPhoto[]) ?? [];
}

/**
 * How long a signed photo URL lives. Short on purpose: photos are documents,
 * opened per request and never handed out as durable links. A tile that sits on
 * screen longer than this still shows the image it already loaded; opening it
 * afresh signs a new URL.
 */
export const PHOTO_URL_TTL_SECONDS = 60;

/**
 * A short-lived signed URL for one of the citizen's incident photos, or null.
 *
 * Two hops that both re-check entitlement, as the Responder portal's
 * `getPhotoUrl` does: `get_document_path` admits only the reporter (or staff /
 * the department), and `createSignedUrl` then goes through the bucket's SELECT
 * policy. Null rather than a throw on any miss, so one unreadable photo renders
 * as a placeholder instead of taking the card down with it.
 */
export async function getIncidentPhotoUrl(photoId: string): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data: paths, error } = await client.rpc('get_document_path', {
    p_kind: 'incident_photo',
    p_row_id: photoId,
  });
  const row = (paths as { bucket: string; path: string }[] | null)?.[0];
  if (error || !row) return null;
  const { data: signed } = await client.storage
    .from(row.bucket)
    .createSignedUrl(row.path, PHOTO_URL_TTL_SECONDS);
  return signed?.signedUrl ?? null;
}

export async function submitIncident(input: IncidentSubmission): Promise<IncidentResult> {
  const client = getSupabaseClient();

  // MOCK path — preserves today's behavior when the backend is not configured.
  if (!client) {
    const referenceNumber = `INC-${new Date().getFullYear()}-${String(
      Math.floor(Math.random() * 99999),
    ).padStart(5, '0')}`;
    requestService.addRequest({
      type: 'Incident Report',
      ticketNumber: referenceNumber,
      status: input.hasPhoto ? 'Submitted' : 'Submitted (Unverified)',
      verified: input.hasPhoto,
      details: {
        incidentType: input.incidentTypeLabel,
        location: input.location,
        barangay: input.barangayLabel,
        description: input.description,
        isAnonymous: input.isAnonymous,
      },
    });
    return { referenceNumber, incidentId: '', verified: input.hasPhoto, mode: 'mock' };
  }

  // LIVE path — dormant until backend + real auth exist.
  const params = mapIncidentToParams(input);
  const { data, error } = await client.rpc('submit_incident', params);
  if (error) throw new IncidentSubmitError(translateSubmitError(error.code));

  // `submit_incident` is declared `returns incidents` — one composite row, with
  // the trigger-assigned reference_number and the id the photo upload needs.
  const row = data as { id?: string; reference_number?: string } | null;
  return {
    referenceNumber: row?.reference_number ?? '',
    incidentId: row?.id ?? '',
    // Verification is a consequence of the photo upload that follows, and is not
    // knowable here. Returning `input.hasPhoto` was half of the false "your
    // report will be verified with your photo" promise.
    verified: false,
    mode: 'live',
  };
}

/**
 * Resumable three-step upload, mirroring `yellowCardService.uploadVoterIdDocument`
 * in shape: reserve a row -> PUT the bytes -> confirm.
 *
 * `confirm_upload` is what fires `trg_verify_on_photo`, which sets
 * `is_verified`/`verified_at` and arms the SLA. None of that is set here.
 *
 * The per-cycle photo cap (`max_photos_per_cycle`, default 3) is charged at
 * RESERVATION — `request_incident_photo_upload` counts existing
 * `incident_photos` rows regardless of `uploaded_at`. A naive retry that
 * re-reserves on every attempt burns a cap slot it does not need, and after
 * enough attempts permanently strands the report (the cap can only be reset by
 * a reopen, which a citizen cannot trigger). So a caller that already holds a
 * reservation from a failed attempt passes it back as `progress` to resume
 * from the step that actually failed, instead of starting over:
 *
 * - no `progress` -> reserve, upload, confirm (the first attempt).
 * - `progress` with `bytesLanded: false` -> skip reserve; upload to the SAME
 *   `storagePath` (no reservation was consumed, nothing to skip there); confirm.
 * - `progress` with `bytesLanded: true` -> skip reserve AND upload; call
 *   `confirm_upload` alone. Valid because the DB only rejects a confirm once
 *   `uploaded_at` is already set, and it isn't yet.
 *
 * Deliberately does not use `upsert: true` on the storage upload: the
 * `incident-photos` bucket has an INSERT policy and no UPDATE policy, so an
 * upsert would be denied. It is also unnecessary — an upload-stage retry always
 * targets a path with no existing object, and a confirm-stage retry performs no
 * storage write at all.
 *
 * Mock mode is a silent no-op: inventing a storage object would misrepresent it.
 */
export async function uploadIncidentPhoto(
  incidentId: string,
  file: File,
  progress?: PhotoUploadProgress,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  // Incident photos are image-only — a PDF is never a valid "before"/"after" shot.
  // Validate the ORIGINAL file: a citizen who picked a PDF should be told so,
  // not have it silently handed to the sanitiser first.
  if (!safeExt(file) || safeExt(file) === 'pdf') {
    throw new IncidentPhotoError('Please upload a JPG or PNG image.', progress);
  }

  // Strip EXIF/GPS before the bytes leave the browser. A phone camera embeds
  // the citizen's coordinates by default, and every responder in the assigned
  // department can read this object — which would walk the reporter's location
  // straight past the name/phone/email masking the DB applies to an anonymous
  // report. See imageSanitizer.ts for why this is a floor, not a guarantee.
  //
  // Runs on EVERY attempt, resumes included. Skipping it when `progress` is
  // present would look like a harmless optimisation but is exactly the hole
  // worth avoiding: a resume with `bytesLanded: false` still performs the
  // upload, so it would have PUT the original EXIF-bearing bytes. Re-encoding
  // may shift the byte count slightly between attempts, which at worst makes
  // the `p_size_bytes` recorded on a confirm-stage retry differ marginally from
  // the object already in storage — a cosmetic metadata drift, and a far
  // cheaper price than leaking a reporter's home coordinates.
  const sanitized = await stripImageMetadata(file);

  // Derived from the sanitised file, since re-encoding renames .png -> .jpg.
  const ext = safeExt(sanitized);
  if (!ext || ext === 'pdf') {
    throw new IncidentPhotoError('Please upload a JPG or PNG image.', progress);
  }

  let row: PhotoUploadProgress;

  if (progress) {
    row = progress;
  } else {
    const { data: reserved, error: reserveError } = await client.rpc('request_incident_photo_upload', {
      p_incident_id: incidentId,
      p_kind: 'before',
      p_ext: ext,
    });
    if (reserveError) {
      // No reservation exists yet, so there is nothing to resume — a retry
      // from here restarts cleanly and does not touch the cap.
      throw new IncidentPhotoError(
        translateIncidentUploadError('reserve', reserveError.code, reserveError.message),
      );
    }
    // The RPC is `returns table (...)`, so PostgREST hands back an array.
    const reservedRow = (Array.isArray(reserved) ? reserved[0] : reserved) as {
      row_id: string;
      bucket: string;
      storage_path: string;
    };
    row = {
      rowId: reservedRow.row_id,
      bucket: reservedRow.bucket,
      storagePath: reservedRow.storage_path,
      bytesLanded: false,
    };
  }

  if (!row.bytesLanded) {
    const { error: uploadError } = await client.storage
      .from(row.bucket)
      .upload(row.storagePath, sanitized, { contentType: canonicalMime(ext) });
    if (uploadError) {
      // StorageError has no Postgres-style `code`, so there is none to pass on.
      throw new IncidentPhotoError(
        translateIncidentUploadError('upload', undefined, uploadError.message),
        row,
      );
    }
    row = { ...row, bytesLanded: true };
  }

  const { error: confirmError } = await client.rpc('confirm_upload', {
    p_kind: 'incident_photo',
    p_row_id: row.rowId,
    // The sanitised size, not the original — confirm_upload records what
    // actually landed in storage, and re-encoding changes the byte count.
    p_size_bytes: sanitized.size,
    p_mime_type: canonicalMime(ext),
  });
  if (confirmError) {
    throw new IncidentPhotoError(
      translateIncidentUploadError('confirm', confirmError.code, confirmError.message),
      row,
    );
  }
}
