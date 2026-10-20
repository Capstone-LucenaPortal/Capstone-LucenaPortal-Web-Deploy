// Labels for the refusal messages. Where each Portal lives is fixed in code
// (src/shared/guard/portals.ts's PORTAL_PREFIX): every Portal is served from
// one origin, so a link to another Portal is internal.
import type { StaffRole } from "./gate";

/** Human-facing names for the refusal messages. */
export const ROLE_LABEL: Record<StaffRole, string> = {
  staff: "Staff",
  responder: "Responder",
  admin: "Admin",
  super_staff: "Super Staff",
};

// Spelled out per role rather than derived from the first letter: the article
// follows the sound, not the spelling, so a heuristic would be wrong the first
// time a label like "Hour Desk" is added.
export const ROLE_ARTICLE: Record<StaffRole, string> = {
  staff: "a",
  responder: "a",
  admin: "an",
  super_staff: "a",
};
