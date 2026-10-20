/**
 * Strips metadata from citizen-uploaded images before they leave the browser.
 *
 * Why this matters more here than on a typical site: the DB goes out of its way
 * to protect an anonymous reporter. When a citizen ticks "report anonymously",
 * layer l32 masks their name, phone and email from every responder who opens
 * the report. But the photo attached to that report was uploaded as the raw
 * `File`, and a phone camera writes GPS coordinates into the JPEG's EXIF
 * segment by default. Every responder in the assigned department can read the
 * photo through the existing storage SELECT policy — so the citizen's home
 * coordinates travelled straight past the masking the database had just done.
 *
 * The mechanism is re-encoding, not parsing: decoding to a bitmap and drawing
 * to a canvas keeps only pixels. EXIF, XMP, IPTC, maker notes and thumbnails
 * are dropped by construction, so this cannot be defeated by a metadata format
 * nobody thought to strip.
 *
 * LIMITATION — this is a client-side mitigation only. A hostile client can
 * bypass the frontend entirely and PUT EXIF-bearing bytes to the storage
 * endpoint with curl or DevTools. It raises the floor for the ordinary citizen
 * who has no idea their camera embeds coordinates; it is not a control against
 * someone who WANTS their own location published. The durable fix is
 * server-side stripping on `incident_photos`, filed as a DB dependency in
 * `citizen-surface-follow-ups.md`.
 */

/** Re-encode quality. High enough that a responder can still read a plate or a
 * street sign; low enough that a modern phone photo does not grow. */
const REENCODE_QUALITY = 0.9;

/**
 * Guard against a decompression-bomb image exhausting the tab's memory during
 * the canvas draw. Larger images are scaled down proportionally rather than
 * rejected — a responder needs the photo more than it needs full resolution.
 */
const MAX_DIMENSION = 4096;

/** True when this environment can actually re-encode. Node (the test suite) and
 * SSR cannot, and neither runs the upload path. */
export function canStripMetadata(): boolean {
  return (
    typeof createImageBitmap === 'function' &&
    typeof document !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined'
  );
}

/** Pure: the drawn size for a source image, preserving aspect ratio. */
export function scaledDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_DIMENSION,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const ratio = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Returns a metadata-free JPEG for an image file, or the ORIGINAL file when
 * re-encoding is not possible.
 *
 * Falling back to the original is a deliberate trade-off, and the direction was
 * chosen carefully: refusing the upload would mean a citizen standing in front
 * of a real emergency cannot file a report because their browser is old. A
 * report that reaches a responder carrying metadata is strictly better than no
 * report at all. Callers that need certainty must check `canStripMetadata()`
 * themselves rather than inferring it from the return value.
 *
 * Always re-encodes to JPEG regardless of input type, including PNG. A PNG has
 * no EXIF-by-default problem, but it can carry XMP and iTXt metadata, and one
 * output format keeps the MIME the caller declares to `confirm_upload`
 * predictable.
 */
export async function stripImageMetadata(file: File): Promise<File> {
  if (!canStripMetadata()) return file;
  if (!file.type.startsWith('image/')) return file;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const { width, height } = scaledDimensions(bitmap.width, bitmap.height);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // A transparent PNG would otherwise flatten onto black, which reads as a
    // corrupt photo to the responder looking at it.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', REENCODE_QUALITY);
    });
    if (!blob) return file;

    // The extension has to follow the re-encoded type: `safeExt` derives the
    // extension the reserve RPC is given, and a `.png` name on JPEG bytes would
    // make the declared MIME disagree with the object actually stored.
    const renamed = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], renamed, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    // A decode failure means the browser could not read the image at all — the
    // upload will fail on its own merits, and doing so with the original file
    // produces the clearer error.
    return file;
  } finally {
    bitmap?.close();
  }
}
