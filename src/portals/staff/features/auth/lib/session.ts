import type { StaffUser } from "../types";
import { getMyProfileRow } from "./profile";
import { toStaffUser } from "./staff-user";

/**
 * The signed-in employee, for the shell and the screens.
 *
 * Drop-in replacement for the old mock-session module: same name, same return
 * type, so its six consumers changed only their import path.
 *
 * Throws rather than returning null. Every caller renders inside
 * (portal)/layout.tsx, which has already run decideAccess and rendered
 * AccessDenied instead of children on any refusal — so by the time this runs,
 * an allowed profile is guaranteed. If that ever stops being true, a loud
 * failure is correct: the alternative is a page rendering someone's name as
 * an empty string with no indication anything is wrong.
 */
export async function getCurrentStaffUser(): Promise<StaffUser> {
  const user = toStaffUser(await getMyProfileRow());
  if (!user) {
    throw new Error(
      "getCurrentStaffUser called without an admitted staff profile — " +
        "it must only be reached from inside the gated (portal) layout.",
    );
  }
  return user;
}
