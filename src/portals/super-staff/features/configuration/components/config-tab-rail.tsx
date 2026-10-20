"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/portals/super-staff/components/ui/button";
import { Modal } from "@/portals/super-staff/components/ui/modal";
import { cn } from "@/portals/super-staff/lib/utils";

const TABS = [
  { href: "/super-staff/configuration/incidents", label: "Incidents" },
  { href: "/super-staff/configuration/yellow-card", label: "Yellow Card" },
  { href: "/super-staff/configuration/booking", label: "Booking" },
  { href: "/super-staff/configuration/site-info", label: "Site Info" },
  { href: "/super-staff/configuration/calendar", label: "Holidays & Office Hours" },
];

export function ConfigTabRail({ dirty }: { dirty: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  // Warn on full-page reload/close while there are unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const go = (href: string) => {
    if (href === pathname) return;
    if (dirty) {
      setPending(href);
      return;
    }
    router.push(href);
  };

  return (
    <>
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

      <Modal open={pending !== null} onClose={() => setPending(null)}>
        <h3 className="text-lg font-semibold text-gray-900">
          Discard unsaved changes?
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          You have edits on this tab that haven&rsquo;t been saved. Leaving will
          discard them.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setPending(null)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              const href = pending;
              setPending(null);
              if (href) router.push(href);
            }}
          >
            Discard changes
          </Button>
        </div>
      </Modal>
    </>
  );
}
