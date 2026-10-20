import { redirect } from "next/navigation";
import { AccessDenied } from "@/portals/super-staff/features/auth/components/access-denied";
import { decideAccess } from "@/portals/super-staff/features/auth/lib/gate";
import { getStaffProfile } from "@/portals/super-staff/features/auth/lib/profile";

/**
 * Where the request guard's role check sends a signed-in account it refuses,
 * before any portal page or bundle is served to it. The (portal) layout keeps
 * its own gate as defence in depth; both decide from the same
 * my_staff_profile row and render the same AccessDenied, so the reason shown
 * here is the reason the guard refused.
 *
 * Outside (portal) so the refusal is never wrapped in the shell it withholds.
 */
export default async function ForbiddenPage() {
  const decision = decideAccess(await getStaffProfile());

  // A stale redirect, or a role restored mid-session: nothing to refuse.
  if (decision.kind === "allow") redirect("/super-staff/accounts");

  return <AccessDenied decision={decision} />;
}
