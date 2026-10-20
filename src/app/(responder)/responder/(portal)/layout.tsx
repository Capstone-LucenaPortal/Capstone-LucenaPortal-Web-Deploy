import { ToastProvider } from "@/portals/responder/components/ui/toast";
import { PortalShell } from "@/portals/responder/components/layout/portal-shell";
import { IdleTimeout } from "@/portals/responder/components/layout/idle-timeout";
import type { NavCounts } from "@/portals/responder/components/layout/nav-items";
import { AccessDenied } from "@/portals/responder/features/auth/components/access-denied";
import { PhoneAlertsProvider } from "@/portals/responder/features/alerts/hooks/use-phone-alerts";
import { SessionProvider } from "@/portals/responder/features/auth/hooks/use-session";
import { getDepartmentDuty } from "@/portals/responder/features/auth/lib/department-duty";
import { decideAccess, toResponderProfile } from "@/portals/responder/features/auth/lib/gate";
import { getMyProfileRow } from "@/portals/responder/features/auth/lib/profile";
import { getCurrentResponder } from "@/portals/responder/features/auth/lib/session";
import {
  getHeldTicket,
  getPool,
  getUnreadCount,
} from "@/portals/responder/features/incidents/lib/data";

/**
 * The authenticated shell. The request guard's role check has already turned
 * away anyone who does not belong here; this second decision is defence in
 * depth, made once per render — getMyProfileRow is cache()d for the pages
 * beneath — and a refusal renders INSTEAD OF children, never beside them.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const decision = decideAccess(toResponderProfile(await getMyProfileRow()));

  if (decision.kind !== "allow") {
    return <AccessDenied decision={decision} />;
  }

  const [responder, duty] = await Promise.all([
    getCurrentResponder(),
    getDepartmentDuty(),
  ]);

  // The badges count what the pages actually show. getPool and getHeldTicket
  // are cache()d, so the layout and the page beneath it share ONE query each
  // per render — the same dedupe getMyProfileRow already relies on.
  const [pool, held, unread] = await Promise.all([
    getPool(),
    getHeldTicket(),
    getUnreadCount(),
  ]);
  const counts: NavCounts = { pool: pool.length, notifications: unread };
  const hasActiveClaim = held !== null;

  return (
    // ToastProvider is OUTSIDE SessionProvider on purpose. Task 9 makes
    // toggleDuty raise its failures through useToast(), and a provider cannot
    // consume a context it is nested outside of.
    <ToastProvider>
      <IdleTimeout />
      <SessionProvider responder={responder} duty={duty}>
        {/* Phone alerts are this DEVICE's, not the session's, so they get
            their own provider; the profile, the pool banner and the drawer
            read it. Inside ToastProvider for the same reason as above. */}
        <PhoneAlertsProvider>
          <PortalShell counts={counts} hasActiveClaim={hasActiveClaim}>
            {children}
          </PortalShell>
        </PhoneAlertsProvider>
      </SessionProvider>
    </ToastProvider>
  );
}
