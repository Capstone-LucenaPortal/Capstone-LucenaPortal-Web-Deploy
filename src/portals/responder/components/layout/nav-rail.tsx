"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/portals/responder/lib/utils";
import { DutySwitch } from "@/portals/responder/components/ui/duty-switch";
import { useDuty } from "@/portals/responder/features/auth/hooks/use-session";
import { NAV_ITEMS, type NavCounts } from "@/portals/responder/components/layout/nav-items";

/**
 * Desktop navigation: a persistent blue rail. Starts collapsed to icons —
 * the hamburger widens it to show labels and badges, pushing the content
 * rather than overlaying it.
 */
export function NavRail({
  counts,
  hasActiveClaim,
}: {
  counts: NavCounts;
  hasActiveClaim: boolean;
}) {
  const pathname = usePathname();
  const { onDuty } = useDuty();
  const [expanded, setExpanded] = useState(false);

  return (
    <nav
      aria-label="Main"
      data-on-dark
      className={cn(
        "hidden shrink-0 flex-col bg-lucena-blue text-white transition-[width] duration-200 md:flex",
        expanded ? "w-58" : "w-19",
      )}
    >
      <div
        className={cn(
          "flex px-2.5 pt-3 pb-2",
          expanded ? "justify-start" : "justify-center",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/12 text-white hover:bg-white/20"
        >
          <Menu size={19} aria-hidden />
        </button>
      </div>

      <ul className="flex flex-1 flex-col gap-1 px-2.5 py-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const badge = item.badgeKey ? counts[item.badgeKey] : 0;
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={expanded ? undefined : item.label}
                aria-label={expanded ? undefined : item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 overflow-hidden rounded-md py-2.75 text-sm whitespace-nowrap",
                  expanded ? "px-3" : "justify-center px-2.75",
                  active
                    ? "bg-white/15 font-semibold text-white"
                    : "font-medium text-blue-100 hover:bg-white/8",
                )}
              >
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon size={19} aria-hidden />
                  {/* Collapsed, there is no room for a badge — a dot keeps the
                      signal without the number. */}
                  {!expanded && badge > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -top-0.5 -right-1 h-2 w-2 rounded-full ring-2 ring-lucena-blue",
                        item.badgeTone === "alert"
                          ? "bg-red-500"
                          : "bg-lucena-yellow",
                      )}
                    />
                  )}
                  {!expanded && item.pulseKey && hasActiveClaim && (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-1 h-2 w-2 animate-pulse rounded-full bg-lucena-yellow ring-2 ring-lucena-blue"
                    />
                  )}
                </span>

                {expanded && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge > 0 && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-px text-[11px] font-bold",
                          item.badgeTone === "alert"
                            ? "bg-red-600 text-white"
                            : "bg-lucena-yellow text-gray-900",
                        )}
                      >
                        {badge}
                      </span>
                    )}
                    {item.pulseKey && hasActiveClaim && (
                      <span
                        aria-label="Active claim"
                        className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-lucena-yellow"
                      />
                    )}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div
        className={cn(
          "flex items-center gap-3 border-t border-white/15 px-4 pt-3 pb-4",
          !expanded && "justify-center px-2.5",
        )}
      >
        <DutySwitch size="sm" onDark />
        {expanded && (
          <span className="text-[12.5px] font-semibold whitespace-nowrap">
            {onDuty ? "On duty" : "Off duty"}
          </span>
        )}
      </div>
    </nav>
  );
}
