"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/portals/super-staff/lib/utils";
import type { SystemHealthData } from "../hooks/use-system-health";
import { SYSTEM_HEALTH_HREF, sectionHref } from "../lib/routes";
import { GROUP_HEADING, SECTIONS, sectionStatuses, worstStatus, type SectionGroup } from "../lib/status";
import type { HealthStatus } from "../types";
import { STATUS_WORD, TONE_STYLE } from "./panel";

function NavLink({
  href,
  label,
  status,
}: {
  href: string;
  label: string;
  /** undefined = not loaded yet, so no dot. */
  status: HealthStatus | undefined;
}) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm",
        active ? "bg-white font-semibold text-lucena-blue shadow-sm" : "text-gray-600 hover:bg-white/70",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          status === undefined ? "bg-transparent" : TONE_STYLE[status].fill,
        )}
      />
      <span className="flex-1">{label}</span>
      {status !== undefined && (
        <>
          {" "}
          <span className="sr-only">({STATUS_WORD[status]})</span>
        </>
      )}
    </Link>
  );
}

const GROUPS: SectionGroup[] = ["service", "platform"];

/**
 * System Health's second-level nav: General, then the Citizen services and the
 * Platform components, each with a dot for its status. General's dot is the
 * worst of them.
 */
export function SectionNav({ data }: { data: SystemHealthData | null }) {
  const sections = data === null ? null : sectionStatuses(data.health, data.reachability);
  return (
    <nav aria-label="System Health sections" className="shrink-0 lg:w-56">
      <NavLink
        href={SYSTEM_HEALTH_HREF}
        label="General"
        status={sections === null ? undefined : worstStatus(sections)}
      />
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {GROUP_HEADING[group]}
          </p>
          {SECTIONS.filter((s) => s.group === group).map(({ key, label }) => (
            <NavLink
              key={key}
              href={sectionHref(key)}
              label={label}
              status={sections?.find((s) => s.key === key)?.status}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}
