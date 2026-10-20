/**
 * Display rules for a responder's name. Pure, and deliberately not part of the
 * session mapper: they are rendering decisions, applied at each surface.
 */

/**
 * First letters of the first two name words — "Juan Dela Cruz" → "JD".
 * Taking the *last* word would give "JC", which reads wrong for the compound
 * Filipino surnames ("Dela Cruz", "De Leon", "San Pedro") that are common here.
 */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();
}

/**
 * Citizens see department + first name only (account spec Q6) — never the
 * responder's full legal name.
 */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
