"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck,
  IdCard,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/portals/staff/lib/utils";
import type { Module } from "@/portals/staff/features/auth/types";

interface NavItem {
  label: string;
  href: string;
  module: Module | null;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/staff/dashboard", module: null, icon: LayoutDashboard },
  { label: "Yellow Card", href: "/staff/yellow-card", module: "yellow-card", icon: IdCard },
  { label: "Incidents", href: "/staff/incidents", module: "incidents", icon: AlertTriangle },
  { label: "Booking", href: "/staff/booking", module: "booking", icon: CalendarCheck },
];

const COLLAPSED_STORAGE_KEY = "lucena-sidebar-collapsed";

interface SidebarProps {
  assignedModules: Module[];
}

export function Sidebar({ assignedModules }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  };

  const visibleItems = navItems.filter(
    (item) => item.module === null || assignedModules.includes(item.module)
  );

  return (
    <aside
      className={cn(
        "h-screen bg-lucena-blue flex flex-col shrink-0 transition-[width] duration-200",
        collapsed ? "w-16" : "w-60"
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
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-md text-blue-100 hover:bg-white/10 hover:text-white shrink-0"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-white/10 text-white font-semibold"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={cn(collapsed ? "sr-only" : "ml-3")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
