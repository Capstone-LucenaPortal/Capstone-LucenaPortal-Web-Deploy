/**
 * Failures a responder is allowed to see, as a closed set of URL codes.
 *
 * Decision E3: the portal already encodes outcomes in the URL by policy
 * (`?report=`, `?sheet=`, `?lost=`), so a failure is a `?notice=` and the banner
 * is server-rendered. Nothing here becomes a client component.
 *
 * ⚠️ ANYTHING UNMAPPED IS RE-THROWN, DELIBERATELY.
 * A catch-all that turns unknown database errors into a friendly banner is how a
 * broken RPC looks like normal operation for a week. If a new failure shows up
 * in production, the right fix is to add it here on purpose -- not to widen the
 * fallback.
 *
 * ⚠️ `{ref}` IS THE ONE SUBSTITUTION, AND IT IS STILL A STATIC STRING.
 * Issue #8: the blocked sentence has to name the ticket in the way. It does that
 * with a placeholder rather than a function, so the set stays closed, inert and
 * readable end to end -- a map of sentences you can check against the design by
 * eye. `noticeText` fills it; anything without `{ref}` passes through untouched.
 * Issue #9 adds the third case: a sentence that ASSERTS what its reference names
 * is not said at all when there is nothing to name. See `ASSERTS_REF`.
 *
 * ⚠️ MATCHED ON THE FUNCTION-NAME PREFIX IN THE MESSAGE, NOT ON SQLSTATE.
 * docs/what-not-to-do.md §6: SQLSTATE is only reliable per-RPC on this project
 * -- P0002 maps to HTTP 500 for an ordinary "record does not exist", and 22023
 * is shared by a dozen unrelated guards. The `fn_name: ...` prefix is always
 * present and is safe to surface verbatim.
 */
export const NOTICES = {
  force_released:
    "A supervisor returned this ticket to the pool. It is back with your department.",
  gone: "That report is no longer in the pool.",
  blocked:
    "You are already holding {ref}. Finish or hand it back before claiming another.",
  needs_photo:
    "Attach at least one after photo before resolving — the citizen's confirmation depends on it.",
  photo_limit:
    "You have attached the maximum number of after photos for this ticket.",
  note_limit:
    "That note is too long, or this ticket already has the maximum number of notes.",
  stage_backwards: "You cannot go back to a stage you have already passed.",
  reason_required: "A reason is required.",
  upload_failed:
    "The photo did not finish uploading. Nothing was attached — try again.",
} as const;

export type NoticeCode = keyof typeof NOTICES;

/**
 * What `{ref}` becomes when we cannot name the ticket.
 *
 * ⚠️ UNREACHABLE TODAY, AND KEPT ANYWAY. `blocked` is currently the only
 * sentence holding `{ref}` and it is in `ASSERTS_REF`, so every surviving path
 * through `noticeText` either has a reference or has already returned null.
 * This is scaffolding for the NEXT `{ref}` sentence -- one that merely mentions
 * a ticket rather than asserting a hold on it -- and without it that sentence
 * ships literal braces to a responder on its first render. A noun phrase rather
 * than an empty string because it still has to read as English, and taken on
 * TRUTHINESS rather than `??` because "You are already holding ." is not one.
 */
const UNNAMED_REF = "a ticket";

/**
 * Codes whose sentence ASSERTS the thing its reference names, and so cannot be
 * said at all without one -- the missing reference is evidence AGAINST the
 * sentence, not just a gap in it.
 *
 * That is the line, and it is narrower than "holds `{ref}`": a sentence that
 * merely MENTIONS a ticket is still true unnamed, and `UNNAMED_REF` carries it.
 *
 * Issue #9. `blocked` reaches `/my-ticket`'s empty state -- which carries the
 * notice by design (E3, for `force_released`) and whose own words, "No active
 * ticket. You can hold one claim at a time.", already state the rule `blocked`
 * was there to explain. Nothing is lost by silence; a responder reading two
 * contradicting sentences loses the ability to trust either.
 */
const ASSERTS_REF = new Set<NoticeCode>(["blocked"]);

/**
 * A URL `?notice=` value, or null when the code is unknown to us.
 *
 * `heldRef` is the reference the caller can vouch for -- read from the row it
 * just rendered, NOT from the query string, even though claim_incident hands
 * back `held_reference` and the URL was therefore available.
 *
 * ⚠️ THIS IS NOT THE `?lost=` RULE TURNED AROUND, IT IS THE OTHER HALF OF IT.
 * claim-outcome.ts puts the winner's NAME in a URL precisely because the app has
 * no lawful way to resolve it again -- the URL is the only copy. A held
 * reference is the opposite: `/my-ticket` has already fetched the row that owns
 * it. When the page can re-read the fact, it re-reads it, because a reference in
 * a query string is one a responder could edit into an accusation about a ticket
 * they never held.
 *
 * ⚠️ SUBSTITUTED LITERALLY, NOT AS A REPLACEMENT PATTERN. String.replace reads
 * the dollar forms ($ followed by &, a backtick, a quote or a digit) in its
 * replacement, so a reference carrying one would rewrite the sentence around it.
 * References come from the database and hold none today; split/join keeps that a
 * fact about the data rather than something this line leans on.
 */
export function noticeText(
  code: string | undefined,
  heldRef?: string | null,
): string | null {
  // ⚠️ hasOwn, NOT `in`: `in` walks the prototype chain, so `?notice=toString`
  // finds a FUNCTION, and string work on it throws an error page at someone who
  // hand-edited a URL -- the one thing notice-banner.tsx promises never happens.
  if (!code || !Object.hasOwn(NOTICES, code)) return null;
  const known = code as NoticeCode;

  // Nothing to name, and this sentence is an assertion about the thing named.
  if (!heldRef && ASSERTS_REF.has(known)) return null;

  return NOTICES[known].split("{ref}").join(heldRef || UNNAMED_REF);
}

/**
 * The one place a Postgres error becomes a code. Throws for anything unlisted.
 *
 * The ownership case is the one that drives the design: a supervisor can
 * force-release a ticket while a responder is working it, and the next stage tap
 * then fails on ownership. That must read as "a supervisor returned this ticket
 * to the pool", not as a blank error page mid-shift.
 */
export function noticeFor(error: { message?: string } | null): NoticeCode {
  const message = error?.message ?? "";

  if (/is not your ticket/.test(message)) return "force_released";
  if (/no incident |not in progress|too late to/.test(message)) return "gone";
  if (/needs at least one confirmed after photo/.test(message))
    return "needs_photo";
  if (/photos this cycle \(limit/.test(message)) return "photo_limit";
  if (/note is \d+ characters|already has 20 notes|note is empty/.test(message))
    return "note_limit";
  if (/is not a stage event|stage_monotonic/.test(message))
    return "stage_backwards";
  if (/a reason is required/.test(message)) return "reason_required";

  throw new Error(`Unmapped incident failure — add it to notice.ts: ${message}`);
}
