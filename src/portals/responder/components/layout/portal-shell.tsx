"use client";

import { useState } from "react";
import { Navbar } from "@/portals/responder/components/layout/navbar";
import { NavDrawer } from "@/portals/responder/components/layout/nav-drawer";
import { NavRail } from "@/portals/responder/components/layout/nav-rail";
import { OfflineBanner } from "@/portals/responder/components/layout/offline-banner";
import type { NavCounts } from "@/portals/responder/components/layout/nav-items";

/**
 * The authenticated chrome: header on top, rail (desktop) or drawer (phone)
 * on the left, scrolling content on the right. The offline banner sits under
 * the header, outside the scroll, so it is in view wherever the page is.
 */
export function PortalShell({
  counts,
  hasActiveClaim,
  children,
}: {
  counts: NavCounts;
  hasActiveClaim: boolean;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <Navbar
        onOpenNav={() => setNavOpen(true)}
        unreadCount={counts.notifications}
      />
      <OfflineBanner />

      <div className="flex min-h-0 flex-1">
        <NavRail counts={counts} hasActiveClaim={hasActiveClaim} />
        {/* Focusable from code only: where a closing modal sends focus when
            the control that opened it is gone (SCRUM-223). */}
        <main tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <NavDrawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        counts={counts}
        hasActiveClaim={hasActiveClaim}
      />
    </div>
  );
}
