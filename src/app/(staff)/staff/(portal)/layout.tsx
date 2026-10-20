import { Navbar } from "@/portals/staff/components/layout/navbar";
import { Sidebar } from "@/portals/staff/components/layout/sidebar";
import { Footer } from "@/portals/staff/components/layout/footer";
import { IdleTimeout } from "@/portals/staff/components/layout/idle-timeout";
import { AccessDenied } from "@/portals/staff/features/auth/components/access-denied";
import { decideAccess, toStaffProfile } from "@/portals/staff/features/auth/lib/gate";
import { getMyProfileRow } from "@/portals/staff/features/auth/lib/profile";
import { getCurrentStaffUser } from "@/portals/staff/features/auth/lib/session";
import { getUnreadNotificationCount } from "@/portals/staff/features/notifications/lib/queries";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // One read per page load — layouts do not re-run per asset or per component,
  // and getMyProfileRow is cache()d for the pages beneath.
  const decision = decideAccess(toStaffProfile(await getMyProfileRow()));

  if (decision.kind !== "allow") {
    return <AccessDenied decision={decision} />;
  }

  // After the gate, so a refused caller fires nothing else. The two reads are
  // independent, and the profile one is cache()d and already in flight.
  const [user, unreadNotifications] = await Promise.all([
    getCurrentStaffUser(),
    getUnreadNotificationCount(),
  ]);

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      <IdleTimeout />
      <Sidebar assignedModules={user.assignedModules} />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar user={user} unreadNotifications={unreadNotifications} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
