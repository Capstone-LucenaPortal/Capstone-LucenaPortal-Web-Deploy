import { Footer } from "@/portals/super-staff/components/layout/footer";
import { IdleTimeout } from "@/portals/super-staff/components/layout/idle-timeout";
import { Navbar } from "@/portals/super-staff/components/layout/navbar";
import { Sidebar } from "@/portals/super-staff/components/layout/sidebar";
import { ToastProvider } from "@/portals/super-staff/components/providers/toast-provider";
import { AccessDenied } from "@/portals/super-staff/features/auth/components/access-denied";
import { decideAccess } from "@/portals/super-staff/features/auth/lib/gate";
import { getStaffProfile } from "@/portals/super-staff/features/auth/lib/profile";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // One read per page load — layouts do not re-run per asset or per component.
  const decision = decideAccess(await getStaffProfile());

  if (decision.kind !== "allow") {
    return <AccessDenied decision={decision} />;
  }

  return (
    <ToastProvider>
      <IdleTimeout />
      <div className="h-screen flex bg-gray-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar user={{ fullName: decision.profile.fullName }} />
          {/* `relative` makes <main> the containing block for absolutely
              positioned content (e.g. `sr-only` spans). Without it they
              resolve against the viewport, escape this scroll region and
              stretch the document past the h-screen shell. */}
          <main className="relative flex-1 overflow-y-auto p-6">{children}</main>
          <Footer />
        </div>
      </div>
    </ToastProvider>
  );
}
