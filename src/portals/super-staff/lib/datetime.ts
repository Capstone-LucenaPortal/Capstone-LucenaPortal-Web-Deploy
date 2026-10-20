// Single-timezone portal: the city runs on Philippine time (+08:00), but the
// database does not store that offset. `start_at` and friends are
// `timestamptz` and the database's `TimeZone` is `UTC`, so PostgREST hands back
// instants normalised to UTC — `2026-07-20T09:30:00+00:00`. A `datetime-local`
// input, meanwhile, speaks bare `YYYY-MM-DDTHH:mm` wall clock with no offset at
// all. These helpers convert between the two, preserving the instant.
const PH_OFFSET = "+08:00";
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Stored ISO → the value a `datetime-local` input expects; "" for null.
 *
 * Converts the instant to Manila wall clock rather than slicing the string
 * raw: the stored `09:30` is UTC, and the human editing it reads `17:30`.
 * Slicing instead of converting is what made every save subtract eight hours.
 *
 * An unparseable stored value throws `RangeError` rather than returning `""`.
 * That is deliberate: a blank start/end passes `validateAnnouncement`, so
 * swallowing the failure would blank the field and let the next save write
 * `p_start_at: null`, clearing a live publish window under a success toast.
 * This helper exists because a datetime was corrupted silently once already.
 */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(Date.parse(iso) + PH_OFFSET_MS).toISOString().slice(0, 16);
}

/** `datetime-local` value → stored ISO with the PH offset; null for "". */
export function localInputToIso(local: string): string | null {
  return local ? `${local}:00${PH_OFFSET}` : null;
}
