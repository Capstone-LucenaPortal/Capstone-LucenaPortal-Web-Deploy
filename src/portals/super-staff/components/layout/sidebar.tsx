"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Settings,
  Megaphone,
  CalendarDays,
  Inbox,
  ScrollText,
  HeartPulse,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { useUnsavedChanges } from "@/portals/super-staff/components/providers/unsaved-changes-provider";
import { listContactMessages } from "@/portals/super-staff/features/inbox/lib/queries";
import { countUnread } from "@/portals/super-staff/features/inbox/lib/status";
import { REFRESH_MS } from "@/portals/super-staff/features/system-health/hooks/use-system-health";
import {
  checkReachability,
  getSystemHealth,
} from "@/portals/super-staff/features/system-health/lib/queries";
import { SYSTEM_HEALTH_HREF } from "@/portals/super-staff/features/system-health/lib/routes";
import { STATUS_WORD } from "@/portals/super-staff/features/system-health/components/panel";
import { navDot, reachabilityStatus, worse } from "@/portals/super-staff/features/system-health/lib/status";
import type { HealthStatus } from "@/portals/super-staff/features/system-health/types";
import { cn } from "@/portals/super-staff/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; icon: LucideIcon; items: NavItem[] };
type NavEntry = NavItem | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup => "items" in entry;

const navEntries: NavEntry[] = [
  { href: "/super-staff/accounts", label: "Accounts", icon: Users },
  { href: "/super-staff/configuration", label: "Configuration", icon: Settings },
  {
    label: "Content",
    icon: Megaphone,
    items: [
      { href: "/super-staff/announcements", label: "Announcements", icon: Megaphone },
      { href: "/super-staff/events", label: "Events", icon: CalendarDays },
      { href: "/super-staff/inbox", label: "Inbox", icon: Inbox },
    ],
  },
  { href: "/super-staff/audit-log", label: "Audit Log", icon: ScrollText },
  { href: SYSTEM_HEALTH_HREF, label: "System Health", icon: HeartPulse },
];

// /super-staff/configuration only redirects to its first tab (its page.tsx).
const REDIRECTS_TO: Partial<Record<string, string>> = {
  "/super-staff/configuration": "/super-staff/configuration/incidents",
};

const STORAGE_KEY = "lucena-sidebar-collapsed";

const DOT_CLASS = { amber: "bg-amber-400", red: "bg-red-500" } as const;

/** What the System Health dot shows: a status, a failed read, or nothing (not a Super Staff). */
type HealthReading = HealthStatus | "unreadable" | null;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [unread, setUnread] = useState(0);
  const [health, setHealth] = useState<HealthReading>(null);
  const { requestLeave } = useUnsavedChanges();

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    listContactMessages()
      .then((m) => setUnread(countUnread(m)))
      .catch(() => setUnread(0)); // a nav badge must never break navigation
  }, []);

  // The System Health dot follows the snapshot's overall status and the app's
  // reachability, refreshed on the same 60 s beat as the page so an alert
  // shows on every Super-staff page. A failed read is red: the absence of data
  // must never look like health.
  useEffect(() => {
    let active = true;
    function load() {
      Promise.all([getSystemHealth(), checkReachability()])
        .then(([h, r]) => {
          if (!active) return;
          setHealth(h === null ? null : worse(h.status, reachabilityStatus(r)));
        })
        .catch(() => {
          if (active) setHealth("unreadable");
        });
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  // No two routes share a prefix, so startsWith is an unambiguous active check.
  function renderItem({ href, label, icon: Icon }: NavItem, nested: boolean) {
    const active = pathname.startsWith(href);
    const badge = href === "/super-staff/inbox" && unread > 0 ? unread : null;
    const dot =
      href !== SYSTEM_HEALTH_HREF ? null : health === "unreadable" ? "red" : navDot(health);
    return (
      <Link
        key={href}
        href={href}
        // Leaving a page with unsaved edits asks first; the guard navigates on
        // "Discard changes". A link that redirects back to this page isn't
        // leaving it, so it stays put. onNavigate skips Ctrl/Cmd+click (new tab).
        onNavigate={(e) => {
          if (REDIRECTS_TO[href] === pathname || !requestLeave(href)) e.preventDefault();
        }}
        title={collapsed ? label : undefined}
        className={cn(
          "relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
          collapsed && "justify-center",
          !collapsed && nested && "pl-9",
          active
            ? "bg-white/10 text-white font-semibold"
            : "text-blue-100 hover:bg-white/10 hover:text-white",
        )}
      >
        <span className="relative shrink-0">
          <Icon className="h-5 w-5" />
          {dot !== null && (
            <span
              className={cn(
                "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-lucena-blue",
                DOT_CLASS[dot],
              )}
            />
          )}
        </span>
        <span className={cn("ml-3 flex-1", collapsed && "sr-only")}>
          {label}
          {dot !== null && health !== null && (
            <>
              {" "}
              <span className="sr-only">
                ({health === "unreadable" ? "Can't read system health" : STATUS_WORD[health]})
              </span>
            </>
          )}
        </span>
        {badge !== null && (
          <span
            className={cn(
              "rounded-full bg-white px-1.5 py-0.5 text-xs font-semibold text-lucena-blue",
              collapsed && "absolute translate-x-3 -translate-y-3",
            )}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside
      className={cn(
        "h-screen bg-lucena-blue flex flex-col shrink-0 transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/15">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
              <Image
                src="/Lucena_City_Seal.png"
                alt="Lucena City seal"
                width={28}
                height={28}
                className="object-contain"
              />
            </span>
            <span className="font-bold text-white truncate">LucenaPortal</span>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-md text-blue-100 hover:bg-white/10 hover:text-white"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto flex flex-col gap-1 p-3">
        {navEntries.map((entry) => {
          if (!isGroup(entry)) return renderItem(entry, false);
          // Collapsed at 64px wide, a nested indent is invisible — render the
          // group's children flat (icons only) instead of a meaningless heading.
          if (collapsed) {
            return (
              <div key={entry.label} className="contents">
                {entry.items.map((item) => renderItem(item, false))}
              </div>
            );
          }
          return (
            <div key={entry.label} className="mt-2 flex flex-col gap-1">
              <span className="flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-200">
                <entry.icon className="h-4 w-4 shrink-0" />
                <span className="ml-3">{entry.label}</span>
              </span>
              {entry.items.map((item) => renderItem(item, true))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
