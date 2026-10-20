import type { ResponderUser } from "../types";
import { getMyProfileRow } from "./profile";
import { toResponderUser } from "./responder-user";

/**
 * The signed-in responder, for server components.
 *
 * Throws rather than returning null. Every caller renders inside
 * (portal)/layout.tsx, which has already run decideAccess and rendered
 * AccessDenied instead of children on any refusal — so by the time this runs,
 * an allowed profile is guaranteed. If that ever stops being true, a loud
 * failure is correct: the alternative is a page rendering someone's name as an
 * empty string with no indication anything is wrong.
 */
export async function getCurrentResponder(): Promise<ResponderUser> {
  const user = toResponderUser(await getMyProfileRow());
  if (!user) {
    throw new Error(
      "getCurrentResponder called without an admitted responder profile — " +
        "it must only be reached from inside the gated (portal) layout.",
    );
  }
  return user;
}
