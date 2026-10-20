import { createClient } from "@/shared/supabase/client";
import { toStorageRpcError } from "@/portals/super-staff/lib/supabase/errors";

/**
 * The `site-content` bucket. l61 shipped SELECT and UPDATE policies alongside
 * the pre-existing INSERT, and it needed both: an UPDATE alone cannot perform
 * an upsert, because PostgreSQL needs SELECT rights on any row an UPDATE's
 * WHERE clause references. Without it the object is never found, ZERO ROWS
 * MATCH, NOTHING RAISES, and the Super Staff sees a save that appears to
 * succeed and changes nothing.
 *
 * ⚠️ `public = true` on the bucket is NOT a SELECT policy. It governs the
 * object BYTES over the CDN, not the storage.objects metadata row.
 *
 * ── The interface ───────────────────────────────────────────────────────────
 * Callers use three functions — `validateImageFile`, `imageSrc`, `putImage` —
 * and need two facts:
 *
 *   1. validate before you put;
 *   2. `version` is any string that changes when the bytes change.
 *
 * Everything else — the `{kind}/{uuid}.{ext}` grammar, who mints the uuid, the
 * `?v=` convention, the absence of a delete — stays behind this seam. It used
 * to be half-leaked to ImageField, which is exactly how the path-stability and
 * cache-bust invariants both came to be violated at the call site.
 *
 * `slotPathFor` and `withVersion` are also exported, but only so this module's
 * tests can reach them: `imageSrc` and `putImage` both need a Supabase client,
 * and the repo tests pure logic only. Nothing outside this file should call
 * them, and nothing does.
 */
const BUCKET = "site-content";

/** The bucket's own file_size_limit, to the byte. */
const MAX_BYTES = 5_242_880;

/** The bucket's own allowed_mime_types. WebP is deliberately absent. */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Which editor the image belongs to. Part of the path, not of any row id. */
export type ImageKind = "post" | "event";

/** What a completed upload gives the caller: where it went, and the stamp to
 *  display it with until the row's own `updated_at` catches up. */
export type StoredImage = {
  path: string;
  version: string;
};

/** Null when the file is acceptable; otherwise the message to show inline. */
export function validateImageFile(file: File): string | null {
  if (!EXTENSIONS[file.type]) return "Use a JPEG or PNG image.";
  if (file.size > MAX_BYTES) return "Keep the image under 5 MB.";
  return null;
}

/**
 * @internal Which path the next upload writes to.
 *
 * On a replacement this returns `current` VERBATIM — the extension is minted
 * once, on first upload, and never recomputed. Replacing a JPEG with a PNG
 * therefore stores PNG bytes at `…/abc.jpg`, and that is correct: `upload()`
 * sends an explicit `contentType`, so the CDN serves `image/png` regardless of
 * the suffix. The extension is a NAME, not a claim about the bytes.
 *
 * Recomputing it from the new file's mime — as the first cut did — changes
 * `image_path`, which logs a spurious "Image changed" on the row's update RPC
 * and orphans the old object in a bucket that exposes no delete policy.
 */
export function slotPathFor(
  kind: ImageKind,
  current: string | null,
  mime: string,
): string {
  const ext = EXTENSIONS[mime];
  if (!ext) throw new Error("site-content accepts JPEG and PNG only");
  return current ?? `${kind}/${crypto.randomUUID()}.${ext}`;
}

/** @internal The pure half of `imageSrc`. */
export function withVersion(
  url: string | null,
  version: string | undefined,
): string | null {
  if (!url) return null;
  // No stamp yet — a row being created has no updated_at to bust against, and
  // has no stored image either, so this is reachable only in principle.
  if (!version) return url;
  return `${url}?v=${encodeURIComponent(version)}`;
}

/**
 * A cache-busted `<img src>`, or null when the row has no image.
 *
 * The public URL cannot change when the image does — `image_path` is stable by
 * design — so the version stamp is the only thing that busts the CDN. Pass the
 * row's `updated_at`; pass the stamp `putImage` returns while a replacement is
 * still unsaved; pass nothing while the row does not exist yet.
 */
export function imageSrc(
  path: string | null,
  version?: string,
): string | null {
  if (!path) return null;
  const { publicUrl } = createClient().storage.from(BUCKET).getPublicUrl(path)
    .data;
  return withVersion(publicUrl, version);
}

/**
 * Stores `file` in `current`'s slot, minting one on first upload. The returned
 * path is STABLE: on a replacement it equals `current`, so the row's
 * `image_path` does not change and no orphan is left behind — which is also why
 * there is no delete: no bucket exposes a delete policy to any role.
 *
 * The returned `version` is the stamp to show the new bytes with until the row
 * is saved and its own `updated_at` moves. It is a CLIENT clock, unlike the
 * `updated_at` it stands in for — it is only ever a cache key, never stored,
 * never compared against a server time, and never outlives the save.
 */
export async function putImage(
  kind: ImageKind,
  current: string | null,
  file: File,
): Promise<StoredImage> {
  const path = slotPathFor(kind, current, file.type);
  const { error } = await createClient()
    .storage.from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw toStorageRpcError(error);
  return { path, version: new Date().toISOString() };
}
