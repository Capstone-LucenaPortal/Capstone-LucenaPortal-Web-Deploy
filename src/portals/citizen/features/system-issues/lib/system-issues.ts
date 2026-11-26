import { getSupabaseClient } from '@/portals/citizen/lib/supabase/client';
import { requestService } from '@/portals/citizen/lib/mock/request-store';
import { LIMITS, fieldTooLong } from '@/portals/citizen/lib/validation';
import { safeExt, canonicalMime } from '@/portals/citizen/lib/storage/file-validation';
import { stripImageMetadata } from '@/portals/citizen/lib/storage/image-sanitizer';
import type {
  MySystemIssue,
  SystemIssueCategory,
  SystemIssueCloseReason,
  SystemIssueResult,
  SystemIssueSubmission,
} from '../types';
import {
  isSystemIssueCategory,
  isSystemIssueDisplayStatus,
} from '@/portals/citizen/features/system-issues/lib/labels';

export class SystemIssueSubmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SystemIssueSubmitError';
  }
}

/**
 * Pure: the dialog's input -> `submit_system_issue` params (DB l128). The
 * function trims the description and caps it at 2000 characters itself; this
 * only spares the Citizen a round trip. `p_page` and `p_user_agent` go as
 * captured: the function trims them and cuts them to 500 characters.
 */
export function mapSystemIssueToParams(input: SystemIssueSubmission): {
  p_category: SystemIssueCategory;
  p_description: string;
  p_page: string;
  p_user_agent: string;
} {
  if (!input.category) throw new SystemIssueSubmitError('Please choose which part of the website.');
  const description = input.description?.trim() ?? '';
  if (!description) throw new SystemIssueSubmitError('Please tell us what went wrong.');
  const tooLong = fieldTooLong('Description', description, LIMITS.description);
  if (tooLong) throw new SystemIssueSubmitError(tooLong);
  return {
    p_category: input.category,
    p_description: description,
    p_page: input.page,
    p_user_agent: input.userAgent,
  };
}

/**
 * Pure: a `submit_system_issue` errcode -> a sentence written for a Citizen.
 * Keyed on the errcode, never the message text, which is written for
 * developers (l128_system_issues.sql raises 42501, 22023 and PT429).
 */
export function translateSystemIssueError(code: string | undefined): string {
  switch (code) {
    // The daily limit: a 6th report inside 24 hours. PostgREST answers 429
    // and passes the code through.
    case 'PT429':
      return "You've sent 5 reports in the last 24 hours. If something is still wrong, please email helpdesk@lucena-city.gov.ph.";
    // No signed-in Citizen: signed out, an anonymised account, or a staff one.
    case '42501':
      return 'Please sign in to report a website problem.';
    case '22023':
      return 'Please choose which part of the website and tell us what went wrong, in 2,000 characters or fewer.';
    default:
      return 'We could not send your report right now. Please try again later.';
  }
}

/** `submit_system_issue`'s `c_daily_limit`, mirrored for the mock store only. */
const MOCK_DAILY_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function submitSystemIssue(input: SystemIssueSubmission): Promise<SystemIssueResult> {
  const params = mapSystemIssueToParams(input);
  const client = getSupabaseClient();

  // MOCK path: a fabricated reference in the dev store. It keeps the daily
  // limit too, so the refusal can be seen without a backend.
  if (!client) {
    const reportsInLastDay = requestService
      .getRequests()
      .filter((r) => r.type === 'System Issue' && Date.now() - Date.parse(r.date) < DAY_MS).length;
    if (reportsInLastDay >= MOCK_DAILY_LIMIT) throw new SystemIssueSubmitError(translateSystemIssueError('PT429'));
    const referenceNumber = `SI-${new Date().getFullYear()}-${String(
      Math.floor(Math.random() * 999999),
    ).padStart(6, '0')}`;
    requestService.addRequest({
      type: 'System Issue',
      ticketNumber: referenceNumber,
      status: 'Submitted',
      details: {
        category: params.p_category,
        description: params.p_description,
        page: params.p_page,
        userAgent: params.p_user_agent,
      },
    });
    return { issueId: `mock-${referenceNumber}`, referenceNumber, mode: 'mock' };
  }

  // LIVE path. `returns table (issue_id, issue_reference, issue_created_at)`:
  // one row, with the trigger-assigned reference.
  const { data, error } = await client.rpc('submit_system_issue', params);
  if (error) throw new SystemIssueSubmitError(translateSystemIssueError(error.code));
  const row = (Array.isArray(data) ? data[0] : data) as { issue_id?: string; issue_reference?: string } | null;
  // Never thank the Citizen for a report with no reference to quote.
  if (!row?.issue_id || !row.issue_reference) throw new SystemIssueSubmitError(translateSystemIssueError(undefined));
  return { issueId: row.issue_id, referenceNumber: row.issue_reference, mode: 'live' };
}

// ── The optional screenshot (#190, DB l128b) ──────────────────────────────

/**
 * The screenshot did not attach. The report itself was already saved, so the
 * dialog still thanks the Citizen and only notes that the screenshot is missing.
 */
export class SystemIssueScreenshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SystemIssueScreenshotError';
  }
}

const SCREENSHOT_NOT_IMAGE = 'Please upload a JPG or PNG image.';
const SCREENSHOT_FAILED = "Your screenshot didn't attach.";

/**
 * Attaches the one optional screenshot to a System issue the Citizen has just
 * filed, in the usual three steps: `request_system_issue_screenshot_upload`
 * reserves a path in the `system-issue-screenshots` bucket, the file goes to
 * that path, and `confirm_upload` stamps it. Run after `submitSystemIssue`, so
 * a failure here never loses the report.
 *
 * One pass, no resume: a refused or failed attempt is reported, not retried. The
 * dialog has already validated the file (`validateUploadFile`); the check here
 * only keeps a non-image from reaching the database.
 *
 * Mock mode is a silent no-op: inventing a storage object would misrepresent it.
 */
export async function attachSystemIssueScreenshot(issueId: string, file: File): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  if (!safeExt(file) || safeExt(file) === 'pdf') throw new SystemIssueScreenshotError(SCREENSHOT_NOT_IMAGE);
  // Strip EXIF/GPS before the bytes leave the browser, as for incident photos.
  // Derive the extension from the sanitised file: re-encoding renames .png to .jpg.
  const sanitized = await stripImageMetadata(file);
  const ext = safeExt(sanitized);
  if (!ext || ext === 'pdf') throw new SystemIssueScreenshotError(SCREENSHOT_NOT_IMAGE);
  const mime = canonicalMime(ext);

  const { data: reserved, error: reserveError } = await client.rpc('request_system_issue_screenshot_upload', {
    p_system_issue_id: issueId,
    p_ext: ext,
  });
  // `returns table (row_id, bucket, storage_path)`: PostgREST hands back an array.
  const row = (Array.isArray(reserved) ? reserved[0] : reserved) as
    | { row_id?: string; bucket?: string; storage_path?: string }
    | null;
  if (reserveError || !row?.row_id || !row.bucket || !row.storage_path) {
    throw new SystemIssueScreenshotError(SCREENSHOT_FAILED);
  }

  // No upsert: the bucket has an INSERT policy only, and every reservation is a fresh path.
  const { error: uploadError } = await client.storage
    .from(row.bucket)
    .upload(row.storage_path, sanitized, { contentType: mime });
  if (uploadError) throw new SystemIssueScreenshotError(SCREENSHOT_FAILED);

  const { error: confirmError } = await client.rpc('confirm_upload', {
    p_kind: 'system_issue_screenshot',
    p_row_id: row.row_id,
    p_size_bytes: sanitized.size,
    p_mime_type: mime,
  });
  if (confirmError) throw new SystemIssueScreenshotError(SCREENSHOT_FAILED);
}

// ── Reading them back: the Dashboard card (#187) ─────────────────────────

/** Citizen copy for a failed read. Never interpolate `error.message`: it is
 * raw PostgREST text naming views and columns. */
const SYSTEM_ISSUES_LOAD_ERROR =
  'Could not load the website problems you reported right now. Please try again later.';

/** The columns the Dashboard shows. The captured page and browser stay out. */
const MY_SYSTEM_ISSUE_COLUMNS =
  'id, reference_number, created_at, category, description, status, resolution_note, closes_at, close_reason, close_note';

/** A `my_system_issues` row. Every column of a view is nullable to PostgREST. */
interface MySystemIssueRow {
  id: string | null;
  reference_number: string | null;
  created_at: string | null;
  category: SystemIssueCategory | null;
  description: string | null;
  status: string | null;
  resolution_note: string | null;
  closes_at: string | null;
  close_reason: SystemIssueCloseReason | null;
  close_note: string | null;
}

/**
 * Pure: a view row → the Dashboard's shape, or null for a row to leave out.
 * The status passes through as the database derived it. A row whose status or
 * area the portal doesn't know is left out rather than shown under one the
 * portal made up.
 */
function mapMySystemIssueRow(row: MySystemIssueRow): MySystemIssue | null {
  const { status, category } = row;
  if (!isSystemIssueDisplayStatus(status) || !isSystemIssueCategory(category)) return null;
  return {
    id: row.id ?? '',
    referenceNumber: row.reference_number ?? '',
    category,
    description: row.description ?? '',
    status,
    createdAt: row.created_at ?? '',
    resolutionNote: row.resolution_note,
    closesAt: row.closes_at,
    closeReason: row.close_reason,
    closeNote: row.close_note,
  };
}

/**
 * Every System issue this Citizen reported, newest first. The view
 * self-scopes on `auth.uid()`, so there is no `.eq('citizen_id', …)` here.
 */
export async function getMySystemIssues(): Promise<MySystemIssue[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('my_system_issues')
    .select(MY_SYSTEM_ISSUE_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw new Error(SYSTEM_ISSUES_LOAD_ERROR);
  return ((data as unknown as MySystemIssueRow[] | null) ?? [])
    .map(mapMySystemIssueRow)
    .filter((issue): issue is MySystemIssue => issue !== null);
}
