"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useReportUnsavedChanges,
  useUnsavedChanges,
} from "@/portals/super-staff/components/providers/unsaved-changes-provider";
import { cn } from "@/portals/super-staff/lib/utils";

const TABS = [
  { href: "/super-staff/configuration/incidents", label: "Incidents" },
  { href: "/super-staff/configuration/yellow-card", label: "Yellow Card" },
  { href: "/super-staff/configuration/booking", label: "Booking" },
  { href: "/super-staff/configuration/site-info", label: "Site Info" },
  { href: "/super-staff/configuration/calendar", label: "Holidays & Office Hours" },
];

// The rail reports the tab's dirty flag to the shell's unsaved-changes guard,
// which owns the "Discard unsaved changes?" modal and the reload/close warning.
export function ConfigTabRail({ dirty }: { dirty: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  useReportUnsavedChanges(dirty);
  const { requestLeave } = useUnsavedChanges();

  const go = (href: string) => {
    if (href === pathname) return;
    if (requestLeave(href)) router.push(href);
  };

  return (
    <div className="flex border-b border-gray-200">
      {TABS.map((tab) => (
        <button
          key={tab.href}
          onClick={() => go(tab.href)}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium",
            pathname === tab.href
              ? "border-lucena-blue text-lucena-blue"
              : "border-transparent text-gray-500 hover:text-gray-700",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
