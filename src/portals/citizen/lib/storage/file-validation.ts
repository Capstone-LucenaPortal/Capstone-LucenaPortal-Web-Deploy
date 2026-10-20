/** Upload gatekeeping shared by every upload input and service.
 * Client-side backstop: an attacker bypasses this trivially, so the same
 * checks must exist server-side (security spec X-2). What this buys:
 * honest clients can't accidentally upload the wrong thing, the recorded
 * ext/MIME always come from sniffed content rather than the browser's
 * extension guess, and the 5 MB literal lives in exactly one place. */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'pdf'] as const;
export type AllowedExt = (typeof ALLOWED_EXTS)[number];

const MIME_BY_EXT: Record<AllowedExt, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};

export function canonicalMime(ext: AllowedExt): string {
  return MIME_BY_EXT[ext];
}

/** Extension from the filename, but only if the WHOLE name is sane and the
 * extension is allowlisted. Anything else -> null (caller rejects the file). */
export function safeExt(file: File): AllowedExt | null {
  const name = file.name;
  if (!name || name.includes('/') || name.includes('\\')) return null;
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return (ALLOWED_EXTS as readonly string[]).includes(ext) ? (ext as AllowedExt) : null;
}

async function sniff(file: File): Promise<'jpg' | 'png' | 'pdf' | null> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg';
  if (
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
    head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
  ) return 'png';
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf';
  return null;
}

/**
 * Async: reads magic bytes from the front of the file. `null` = OK, else a
 * citizen-facing sentence explaining why it was rejected.
 *
 * Adaptation from the brief: the brief's reference implementation built the
 * "or PDF document" suffix with a `.replace(' or', '; use a JPG, PNG, or')`
 * transform, which produces copy that reads oddly and is fragile to edit.
 * Tests here assert behavior (null vs. not-null), never exact copy, so the
 * messages below are plain sentences instead — same decisions, no string
 * gymnastics.
 */
/**
 * Where a document upload got to before it failed, held by the caller and passed back
 * in on retry so the resumable upload functions (`bookingService.uploadBookingDocument`,
 * `yellowCardService.uploadVoterIdDocument`) skip whatever step already succeeded rather
 * than minting a new reservation or re-uploading bytes that already landed.
 *
 * Field names mirror `incidentService.PhotoUploadProgress` (`rowId`/`bucket`/`storagePath`/
 * `bytesLanded`) for one consistent shape across all three upload paths. Unlike that type,
 * every field here starts optional — a caller hands in a fresh `{}` before the first attempt
 * — and the upload functions mutate this exact object in place (rather than returning a new
 * one via a thrown error's `.progress`), so a caller that keeps the same object across
 * multiple calls — including calls that each complete successfully, not just retries after a
 * failure — gets idempotency for free: a second call with an already-populated `rowId` skips
 * the reserve RPC, and one with `bytesLanded: true` skips the storage upload.
 */
export interface DocumentUploadProgress {
  rowId?: string;
  bucket?: string;
  storagePath?: string;
  bytesLanded?: boolean;
}

export async function validateUploadFile(
  file: File,
  kind: 'image' | 'imageOrPdf',
): Promise<string | null> {
  if (file.size === 0) return 'That file is empty. Please choose another file.';
  if (file.size > MAX_UPLOAD_BYTES) return 'File size must be 5 MB or less.';

  const allowPdf = kind === 'imageOrPdf';
  const typeHint = allowPdf ? 'a JPG, PNG, or PDF file' : 'a JPG or PNG image';

  const ext = safeExt(file);
  if (!ext || (!allowPdf && ext === 'pdf')) return `Please upload ${typeHint}.`;

  const content = await sniff(file);
  if (!content) return `Please upload ${typeHint}.`;

  const matches =
    (content === 'jpg' && (ext === 'jpg' || ext === 'jpeg')) ||
    (content === 'png' && ext === 'png') ||
    (content === 'pdf' && ext === 'pdf' && allowPdf);
  if (!matches) return `That file's content does not match its file type. Please upload ${typeHint}.`;

  return null;
}
