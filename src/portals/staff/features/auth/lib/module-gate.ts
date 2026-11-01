import type { Module } from "../types";
import { getMyProfileRow } from "./profile";
import { toStaffUser } from "./staff-user";

/**
 * Whether the signed-in account is assigned this module. Every page under a
 * module's route segment asks this first and renders NotYourModule instead of
 * itself on false, before any of the module's reads run.
 *
 * The same reasoning as decideAccess, one level down: this is NOT the security
 * boundary — every module view and RPC re-checks has_module() — but without it
 * an account that types another module's address meets a working page where
 * every query returns 200 and an empty array. On the Booking calendar that
 * reads as "Both spaces are clear all month." for a month that is booked.
 *
 * The list is the sidebar's own: the same cache()d row through the same
 * mapper, so a link the sidebar hides is a page this refuses, and no second
 * query is made.
 *
 * A per-page check rather than a segment layout: a layout renders alongside
 * its page, not before it, so it could not stop the page's reads, and it does
 * not re-run on client navigation within the segment.
 *
 * No row answers false rather than throwing as getCurrentStaffUser does: the
 * (portal) layout has already refused that account, and whichever renders
 * first, a refusal is the safe answer to give in its place.
 */
export async function isAssigned(module: Module): Promise<boolean> {
  const user = toStaffUser(await getMyProfileRow());
  return user?.assignedModules.includes(module) ?? false;
}
