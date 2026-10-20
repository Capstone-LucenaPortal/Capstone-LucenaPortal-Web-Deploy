import { redirect } from "next/navigation";
import { AccessDenied } from "@/portals/staff/features/auth/components/access-denied";
import { decideAccess, toStaffProfile } from "@/portals/staff/features/auth/lib/gate";
import { getMyProfileRow } from "@/portals/staff/features/auth/lib/profile";

/**
 * Where the request guard's role check sends a signed-in account it refuses,
 * before any portal page, bundle or API route is served to it. The (portal)
 * layout keeps its own gate as defence in depth; both decide from the same
 * my_staff_profile row and render the same AccessDenied, so the reason shown
 * here is the reason the guard refused.
 *
 * Outside (portal) so the refusal is never wrapped in the shell it withholds.
 */
export default async function ForbiddenPage() {
  const decision = decideAccess(toStaffProfile(await getMyProfileRow()));

  // A stale redirect, or a role restored mid-session: nothing to refuse.
  if (decision.kind === "allow") redirect("/staff/dashboard");

  return <AccessDenied decision={decision} />;
}
