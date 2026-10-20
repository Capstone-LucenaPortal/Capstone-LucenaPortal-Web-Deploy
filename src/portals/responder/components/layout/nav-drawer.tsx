"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/portals/responder/lib/utils";
import { Modal } from "@/portals/responder/components/ui/modal";
import { DutySwitch } from "@/portals/responder/components/ui/duty-switch";
import { useDuty, useSession } from "@/portals/responder/features/auth/hooks/use-session";
import { NAV_ITEMS, type NavCounts } from "@/portals/responder/components/layout/nav-items";
import { dutyLine } from "@/portals/responder/features/alerts/components/phone-alerts";
import { usePhoneAlerts } from "@/portals/responder/features/alerts/hooks/use-phone-alerts";

/**
 * Phone navigation: slides in over the content behind a scrim. Modal, so the
 * `<nav>` landmark sits inside a dialog; focus, Escape and the page behind are
 * `Modal`'s (SCRUM-223).
 */
export function NavDrawer({
  open,
  onClose,
  counts,
  hasActiveClaim,
}: {
  open: boolean;
  onClose: () => void;
  counts: NavCounts;
  hasActiveClaim: boolean;
}) {
  const pathname = usePathname();
  const { onDuty } = useDuty();
  const { responder } = useSession();
  const { status: alerts } = usePhoneAlerts();

  // Past `md` the drawer is display:none and the rail takes over. Left open
  // through a rotate or a resize it would keep the page inert with nothing on
  // screen to close, so it closes itself.
  useEffect(() => {
    if (!open || !window.matchMedia) return;
    const wide = window.matchMedia("(min-width: 48rem)");
    const onChange = (e: { matches: boolean }) => {
      if (e.matches) onClose();
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Modal onClose={onClose} className="fixed inset-0 z-70 flex md:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        data-scrim
        onClick={onClose}
        className="animate-scrim-in absolute inset-0 bg-gray-900/45"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        tabIndex={-1}
        className="animate-nav-in relative flex h-full w-68 shadow-2xl"
      >
        <nav
          aria-label="Main"
          data-on-dark
          className="flex w-full flex-col bg-lucena-blue text-white"
        >
          <div className="flex items-center gap-2.5 border-b border-white/15 px-4 pt-4.5 pb-3.5">
            <span
              aria-hidden
              className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-lucena-blue"
            >
              LC
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-bold">
                {responder.full_name}
              </p>
              <p className="text-[11.5px] text-blue-100">
                {responder.department_label}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="flex h-8 w-8 shrink-0 items-center justify-center text-blue-100 hover:text-white"
            >
              <X size={19} aria-hidden />
            </button>
          </div>

          <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              const badge = item.badgeKey ? counts[item.badgeKey] : 0;
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[14.5px]",
                      active
                        ? "bg-white/15 font-semibold text-white"
                        : "font-medium text-blue-100 hover:bg-white/8",
                    )}
                  >
                    <Icon size={19} aria-hidden />
                    <span className="flex-1">{item.label}</span>

                    {badge > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-px text-[11px] font-bold",
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
                        className="h-2 w-2 animate-pulse rounded-full bg-lucena-yellow"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-white/15 px-4 pt-3.5 pb-4.5">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p id="drawer-duty-label" className="text-[13.5px] font-semibold">
                  {onDuty ? "On duty" : "Off duty"}
                </p>
                <p className="text-[11px] text-blue-100">
                  {dutyLine(onDuty, alerts)}
                </p>
              </div>
              <DutySwitch size="md" onDark labelledBy="drawer-duty-label" />
            </div>
          </div>
        </nav>
      </div>
    </Modal>
  );
}
