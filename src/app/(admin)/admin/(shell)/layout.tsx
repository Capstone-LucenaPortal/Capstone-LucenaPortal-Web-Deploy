import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/portals/admin/components/layout/sidebar";
import { AccessRefusal } from "@/portals/admin/features/auth/components/access-refusal";
import { ShellGate } from "@/portals/admin/features/auth/components/shell-gate";
import { adminDisplayName } from "@/portals/admin/features/auth/lib/display-name";
import { getAdminProfile, hasSession } from "@/portals/admin/features/auth/lib/profile";
import { decideRoleAccess } from "@/portals/admin/lib/supabase/access";
import { EMPLOYEE_SIGN_IN_PATH } from "@/shared/guard/portals";

// The Admin shell's gate, on the server, as Staff's and Super Staff's (portal)
// layouts do it, so every Admin page is sent with its shell and first render
// (issue #150). The shared request guard has already sent a signed-out or
// refused session away; this is defense in depth, and the two judge the
// profile with the same judgeStaffProfile (via decideRoleAccess).
export default async function AdminShellLayout({ children }: { children: ReactNode }) {
  // One read per page load. getAdminProfile is cache()d, so the pages beneath
  // reuse it. A failed read throws to src/app/(admin)/error.tsx.
  const profile = await getAdminProfile();

  // An empty read is either "not an employee" or "nobody signed in". Only the
  // second goes to the sign-in, not a refusal.
  if (!profile && !(await hasSession())) {
    redirect(EMPLOYEE_SIGN_IN_PATH);
  }

  const decision = decideRoleAccess(profile);

  if (decision.kind !== "allow") {
    // Rendered outside ShellGate, so nothing on this path redirects: the
    // SIGNED_OUT a deactivated account's own sign-out sets off can't swap the
    // message for the sign-in.
    return <AccessRefusal decision={decision} />;
  }

  return (
    // Watches the browser's session for what happens after this render: a
    // sign-out elsewhere, or a different user signing in.
    <ShellGate>
      {/* Column below md so Sidebar's mobile top bar sits above the content
          instead of being squeezed into a row alongside it; row from md up,
          matching Sidebar's own md breakpoint for switching from the off-canvas
          drawer to the static side column. */}
      <div className="flex min-h-screen flex-col md:flex-row">
        {/* First focusable element in the DOM, ahead of Sidebar's hamburger/nav
            links, so it is the first Tab stop on every admin page. Visually
            hidden until focused (sr-only / focus:not-sr-only). */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-none focus:bg-blue-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
        >
          Skip to content
        </a>
        <Sidebar displayName={adminDisplayName(profile)} />
        {/* Padding is coupled to PageHero's negative-margin bleed (see that
            file) — keep these two in lockstep at every breakpoint.
            tabIndex={-1} lets the skip link move focus here programmatically
            (href="#main") without adding a stop to the normal Tab order. */}
        <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto p-4 md:p-8 focus:outline-none">
          {children}
        </main>
      </div>
    </ShellGate>
  );
}
