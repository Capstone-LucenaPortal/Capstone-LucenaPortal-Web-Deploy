"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/portals/admin/features/auth/hooks/use-auth";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Yellow Card", href: "/admin/yellow-card" },
  { label: "Incident Reports", href: "/admin/issue-reports" },
  { label: "Convention Center", href: "/admin/convention-center" },
  { label: "SLA Reports", href: "/admin/sla-reports" },
];

// Duplicated from src/portals/admin/components/ui/modal.tsx (Task 3.1) rather than imported.
// Modal.tsx is Task 3.1's file and is explicitly out of scope for this task
// (don't touch it), and it doesn't export either of these two — importing
// would require modifying it just to add exports it has no other reason to
// have. The selector + helper are ~10 lines with no behavior of their own to
// drift from Modal's copy, so duplicating is the lower-risk move for a
// second consumer; if a third one shows up, that's the point to promote both
// to a shared module (e.g. lib/focus-trap.ts) instead of copying again.
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function displayNameFor(profile: ReturnType<typeof useAuth>["profile"]): string {
  if (profile?.full_name) {
    return profile.full_name;
  }
  if (profile?.email) {
    return profile.email.split("@")[0];
  }
  return "";
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const displayName = displayNameFor(profile);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // Tracks the pathname the drawer's open/closed state was last computed
  // against, so the render-phase reset below (React's documented "Resetting
  // state when a prop changes" pattern —
  // https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes)
  // can detect a route change without an effect: on the render where
  // `pathname` no longer matches `prevPathname`, close the drawer and record
  // the new pathname in the same pass, so it can't fire again for the same
  // navigation.
  const [prevPathname, setPrevPathname] = useState(pathname);
  const drawerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Whatever had focus right before the drawer opened (the hamburger button,
  // in every real usage). Restored on close/unmount, same reasoning as
  // Modal.tsx's previouslyFocusedElement.
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  function closeDrawer() {
    setIsDrawerOpen(false);
  }

  async function handleLogout() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setLogoutError(null);
    const { error } = await signOut();
    if (error) {
      // supabase-js keeps the local session alive when the revoke call
      // fails, so the cookie is still live. Staying put with a visible
      // error is honest; bouncing to /login would show a sign-in form to
      // someone who is in fact still signed in.
      setLogoutError("Could not sign you out. Check your connection and try again.");
      setIsSigningOut(false);
      return;
    }
    // replace(), not push(): the portal page must not be one Back away.
    // refresh() drops the cached RSC render that still holds the profile.
    router.replace("/admin/login");
    router.refresh();
  }

  // Standard mobile-nav behavior: close the drawer automatically on route
  // change so it never sits open, covering the page the user just navigated
  // to. A stale open drawer after a nav click would otherwise require a
  // second, unrelated tap to dismiss. Adjusted during render rather than in
  // a useEffect (see prevPathname's comment above) — React discards this
  // render's output and immediately re-renders when setState is called
  // during render, so prevPathname already matches pathname on the next
  // pass and this can't fire again for the same navigation.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsDrawerOpen(false);
  }

  // Steps 1 & 3 (mirrors src/portals/admin/components/ui/modal.tsx's corresponding effect,
  // Task 3.1, exactly — see that file's comment for the full "why one effect
  // with the exit half in cleanup" rationale): open -> stash the trigger
  // element, move focus into the drawer, lock background scroll. Close/
  // unmount -> undo both, via cleanup rather than the close handler, so it
  // fires even if the drawer disappears for a reason other than the user
  // closing it.
  useEffect(() => {
    if (!isDrawerOpen) return;

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;

    // Prefer the drawer's own heading as the initial focus target, same as
    // Modal.tsx, falling back to the first focusable element.
    const drawer = drawerRef.current;
    const focusable = drawer ? getFocusableElements(drawer) : [];
    const initialFocusTarget = headingRef.current ?? focusable[0] ?? null;
    initialFocusTarget?.focus();

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      previouslyFocusedElement.current?.focus();
    };
  }, [isDrawerOpen]);

  // Step 2 (mirrors Modal.tsx's second effect): Escape closes the drawer;
  // Tab/Shift+Tab cycle focus without ever leaving it. Focusable elements are
  // re-queried on every keypress rather than cached, for the same reason as
  // Modal.tsx — the drawer's contents can change while open.
  useEffect(() => {
    if (!isDrawerOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
        return;
      }

      if (event.key !== "Tab") return;

      const drawer = drawerRef.current;
      if (!drawer) return;

      const focusable = getFocusableElements(drawer);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || active === headingRef.current || !drawer.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  function renderNavLinks() {
    return NAV_ITEMS.map((item) => {
      // Anchored the same way the shared request guard (src/shared/guard/decide.ts)
      // matches auth paths, with an explicit "/" boundary rather than a bare
      // startsWith: a bare startsWith(item.href) would also light up
      // "/admin/dashboard" for a hypothetical future route like
      // "/dashboard-legacy". None of NAV_ITEMS' five hrefs are a string
      // prefix of another today (checked: /dashboard, /yellow-card,
      // /issue-reports, /convention-center, /sla-reports all diverge at the
      // second path segment), so this only changes behavior for nested
      // routes under a given item, e.g. "/yellow-card/123".
      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          className={`rounded-none border-l-[3px] py-2 pl-[9px] pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900 ${
            isActive
              ? "border-blue-900 bg-blue-50 font-semibold text-blue-950"
              : "border-transparent font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          {item.label}
        </Link>
      );
    });
  }

  return (
    <>
      {/* Mobile top bar: replaces the always-visible sidebar below md with a
          hamburger button that opens the sidebar as an off-canvas drawer. */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <img
            src="/lucena-seal.png"
            alt="Official seal of the City of Lucena"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <span className="text-sm font-bold text-gray-900">Lucena City Admin</span>
        </div>
        <button
          type="button"
          aria-label="Open navigation menu"
          aria-expanded={isDrawerOpen}
          onClick={() => setIsDrawerOpen(true)}
          className="rounded-none border border-gray-300 p-2 text-lg leading-none text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900"
        >
          <span aria-hidden="true">☰</span>
        </button>
      </div>

      {/* Desktop sidebar: unchanged in content/behavior from before this
          task, just hidden below the md breakpoint (the mobile top bar +
          drawer take over there). */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white px-4 py-6 md:flex">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <img
              src="/lucena-seal.png"
              alt="Official seal of the City of Lucena"
              className="h-10 w-10 shrink-0 object-contain"
            />
            <div>
              <p className="text-lg font-bold text-gray-900">Lucena City</p>
              <p className="text-xs text-gray-500">Admin Portal</p>
            </div>
          </div>
          {displayName && (
            <p className="mt-2 text-xs text-blue-900">Welcome back, {displayName}</p>
          )}
        </div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
          Modules
        </p>
        <nav className="flex flex-1 flex-col gap-1">{renderNavLinks()}</nav>
        <p className="mt-6 text-[10px] leading-4 text-gray-500">
          City Government of Lucena
          <br />
          Quezon Province · Cityhood 1961
        </p>
        {logoutError && (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {logoutError}
          </p>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={isSigningOut}
          className="mt-3 rounded-none border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningOut ? "Signing out…" : "Logout"}
        </button>
      </aside>

      {/* Mobile off-canvas drawer: only mounted while open (mirrors
          Modal.tsx's `if (!isOpen) return null`), so it never duplicates the
          desktop sidebar's nav links in the accessibility tree when closed.
          `md:hidden` keeps it from ever being reachable on desktop, where the
          hamburger that opens it is itself hidden. */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden="true"
            onClick={closeDrawer}
            className="fixed inset-0 bg-black/50"
          />
          <div
            ref={drawerRef}
            data-testid="mobile-nav-drawer"
            className="fixed inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col overflow-y-auto border-r border-gray-200 bg-white px-4 py-6 shadow-xl"
          >
            <div className="mb-6 flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <img
                  src="/lucena-seal.png"
                  alt="Official seal of the City of Lucena"
                  className="h-10 w-10 shrink-0 object-contain"
                />
                <div>
                  <h2
                    ref={headingRef}
                    tabIndex={-1}
                    // Same focus-ring convention Task 3.1 established on
                    // Modal's heading (this is the drawer's initial-focus
                    // target on every open, same as there), finalized as
                    // `focus-visible:` by Task 3.3.
                    className="text-lg font-bold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900"
                  >
                    Lucena City
                  </h2>
                  <p className="text-xs text-gray-500">Admin Portal</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={closeDrawer}
                className="text-gray-500 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-900"
              >
                ✕
              </button>
            </div>
            {displayName && (
              <p className="mb-4 text-xs text-blue-900">Welcome back, {displayName}</p>
            )}
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
              Modules
            </p>
            <nav className="flex flex-1 flex-col gap-1">{renderNavLinks()}</nav>
            <p className="mt-6 text-[10px] leading-4 text-gray-500">
              City Government of Lucena
              <br />
              Quezon Province · Cityhood 1961
            </p>
            {logoutError && (
              <p role="alert" className="mt-3 text-xs text-red-600">
                {logoutError}
              </p>
            )}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSigningOut}
              className="mt-3 rounded-none border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigningOut ? "Signing out…" : "Logout"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
