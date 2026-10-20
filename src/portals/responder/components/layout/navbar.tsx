"use client";

import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import { cn } from "@/portals/responder/lib/utils";
import { useSession } from "@/portals/responder/features/auth/hooks/use-session";

/**
 * Top bar. The hamburger is phone-only — from `md` up the rail owns
 * navigation, so the header shows the LC mark and the responder's name
 * instead.
 */
export function Navbar({
  onOpenNav,
  unreadCount,
}: {
  onOpenNav: () => void;
  unreadCount: number;
}) {
  const { responder, duty, onDuty, toggleDuty } = useSession();

  return (
    <header className="shrink-0 border-b-[3px] border-lucena-blue bg-white">
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-3">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-900 hover:bg-gray-100 md:hidden"
        >
          <Menu size={22} aria-hidden />
        </button>

        <span
          aria-hidden
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lucena-blue text-[11px] font-bold text-white md:flex"
        >
          LC
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.08em] text-gray-500 uppercase">
            Department
          </p>
          <p className="text-sm leading-tight font-bold text-pretty text-gray-900">
            {responder.department_label}
          </p>
        </div>

        <span className="mr-1 hidden text-[12.5px] text-gray-500 lg:inline">
          {responder.full_name}
          {duty && ` · ${duty.onDuty} of ${duty.total} on duty`}
        </span>

        <button
          type="button"
          onClick={toggleDuty}
          aria-pressed={onDuty}
          className={cn(
            "flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold",
            onDuty ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "h-2 w-2 rounded-full",
              onDuty ? "bg-green-600" : "bg-gray-400",
            )}
          />
          {onDuty ? "On duty" : "Off duty"}
        </button>

        <Link
          href="/responder/notifications"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
        >
          <Bell size={19} aria-hidden />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute top-2 right-2 h-2 w-2 rounded-full border-[1.5px] border-white bg-red-600"
            />
          )}
        </Link>
      </div>
    </header>
  );
}
