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
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { listContactMessages } from "@/portals/super-staff/features/inbox/lib/queries";
import { countUnread } from "@/portals/super-staff/features/inbox/lib/status";
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
  { href: "/super-staff/monitoring", label: "Monitoring", icon: LayoutDashboard },
];

const STORAGE_KEY = "lucena-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    listContactMessages()
      .then((m) => setUnread(countUnread(m)))
      .catch(() => setUnread(0)); // a nav badge must never break navigation
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
    return (
      <Link
        key={href}
        href={href}
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
        <Icon className="h-5 w-5 shrink-0" />
        <span className={cn("ml-3 flex-1", collapsed && "sr-only")}>
          {label}
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
