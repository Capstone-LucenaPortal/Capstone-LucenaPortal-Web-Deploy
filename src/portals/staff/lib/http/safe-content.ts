/**
 * Response headers for serving a file a citizen uploaded.
 *
 * The hazard is that these files come back from OUR origin. A stored
 * `image/svg+xml` or `text/html` opened in a tab executes script as the staff
 * portal — reading the session, calling Server Actions, deciding applications
 * as the signed-in reviewer. That is stored XSS, and the upload is attacker
 * controlled.
 *
 * `X-Content-Type-Options: nosniff` does NOT prevent it. nosniff stops the
 * browser GUESSING a type; it faithfully honours a declared one. If the stored
 * type says SVG, nosniff renders SVG.
 *
 * So the type is decided here, from an allowlist, rather than trusted from
 * storage. The bucket also restricts uploads to jpeg/png/pdf today, but that
 * config lives in the database project and this route cannot see it — relying
 * on it would make our safety depend on a setting in another repository.
 */

/** Types that cannot script, and that a reviewer genuinely needs to look at. */
const INLINE_SAFE = new Set(["image/jpeg", "image/png", "application/pdf"]);

export type SafeContentHeaders = Record<string, string>;

export function safeContentHeaders(mimeType: string | undefined): SafeContentHeaders {
  // "IMAGE/JPEG; charset=binary" and "image/jpeg" are the same type.
  const normalised = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  const inline = INLINE_SAFE.has(normalised);

  return {
    // Anything off the allowlist is relabelled inert. An allowlist, not a
    // blocklist: a type nobody anticipated must fail closed.
    "Content-Type": inline ? normalised : "application/octet-stream",
    "Content-Disposition": inline ? "inline" : "attachment",
    "X-Content-Type-Options": "nosniff",
    // Belt and braces: even if something scriptable ever reached the inline
    // branch, a sandboxed response is a unique opaque origin with no access to
    // the staff portal's cookies, storage or DOM.
    "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:;",
    // A citizen's ID must never sit in a shared or browser cache. The next
    // viewer comes back through the session gate.
    "Cache-Control": "private, no-store, max-age=0",
  };
}
