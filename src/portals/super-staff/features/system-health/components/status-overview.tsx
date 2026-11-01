import Link from "next/link";
import {
  Activity,
  Bell,
  CalendarDays,
  Database,
  HardDrive,
  IdCard,
  KeyRound,
  Siren,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/portals/super-staff/lib/utils";
import type { SystemHealthData } from "../hooks/use-system-health";
import { worstCheck } from "../lib/checks";
import { formatMs, formatSeconds } from "../lib/format";
import { sectionHref } from "../lib/routes";
import {
  GROUP_HEADING,
  rootCauses,
  sectionInfo,
  sectionStatuses,
  worstStatus,
  type SectionGroup,
  type SectionKey,
  type SectionStatus,
} from "../lib/status";
import { healthyLine } from "../lib/summary";
import type { HealthStatus } from "../types";
import { STATUS_WORD, TONE_STYLE } from "./panel";

const BANNER_TITLE: Record<HealthStatus, string> = {
  ok: "All systems working",
  warning: "Something needs a look",
  critical: "Something needs attention now",
};

const ICON: Record<SectionKey, LucideIcon> = {
  yellow_card: IdCard,
  incidents: Siren,
  lcc: CalendarDays,
  database: Database,
  storage: HardDrive,
  notifications: Bell,
  jobs: Activity,
  accounts: KeyRound,
};

/** General's rows of tiles, in order, each with its grid. */
const ROWS: Array<[group: SectionGroup, grid: string]> = [
  ["service", "md:grid-cols-3"],
  ["platform", "md:grid-cols-3 xl:grid-cols-5"],
];

/**
 * A section's own trouble in one line: its worst check, with its count and
 * oldest age, or "All checks OK". A dependency's trouble is not in it; that
 * is "Affected by".
 */
function ownLine({ key, ownStatus }: SectionStatus, { health, reachability }: SystemHealthData): string {
  // The one fold-in (lib/status): when Database reads worse than the database
  // grades itself, it is the app's grade, so name the round trip.
  if (key === "database" && ownStatus !== health.sections.database.own_status) {
    if (reachability === null) return "Health check did not answer";
    if (!reachability.db_ok) return "Database did not answer";
    return `Response time ${formatMs(reachability.ms)}`;
  }
  const check = worstCheck(health.sections[key].checks);
  if (check === null) {
    return key === "database" && reachability !== null
      ? `All checks OK · ${formatMs(reachability.ms)} round trip`
      : "All checks OK";
  }
  const count = check.count === null ? "" : `: ${check.count.toLocaleString("en-PH")}`;
  const oldest = check.oldest_seconds === null ? "" : ` · oldest ${formatSeconds(check.oldest_seconds)}`;
  return `${check.label}${count}${oldest}`;
}

/** "Storage, Background jobs": the sections' labels, in the order given. */
function sectionLabels(keys: SectionKey[]): string {
  return keys.map((k) => sectionInfo(k).label).join(", ");
}

/**
 * General's banner and its two rows of tiles. The banner is coloured by the
 * worst section, response time included; when it is not ok it names each root
 * cause once: a failing component with the services it affects, then a
 * service whose own checks fail. Each tile shows its worst check and what it
 * is affected by, and leads to its section's page.
 */
export function StatusOverview({ data }: { data: SystemHealthData }) {
  const { health, reachability, summary } = data;
  const sections = sectionStatuses(health, reachability);
  const causes = rootCauses(sections);
  const overall = worstStatus(sections);
  return (
    <>
      <div
        role={overall === "ok" ? undefined : "status"}
        className={cn("rounded-lg p-6 shadow-sm", TONE_STYLE[overall].solid)}
      >
        <h2 className="text-2xl font-bold">{BANNER_TITLE[overall]}</h2>
        {causes.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm font-medium">
            {causes.map((c) => (
              <li key={c.key}>
                {`${c.label}: ${STATUS_WORD[c.ownStatus]} · ${ownLine(c, data)}`}
                {c.affects.length > 0 && ` · affects ${sectionLabels(c.affects.map((s) => s.key))}`}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm opacity-90">{healthyLine(summary)}</p>
      </div>

      {ROWS.map(([group, grid]) => (
        <section key={group} aria-labelledby={`${group}-row`} className="mt-6">
          <h2 id={`${group}-row`} className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {GROUP_HEADING[group]}
          </h2>
          <div className={cn("mt-2 grid grid-cols-2 gap-4", grid)}>
            {sections
              .filter((s) => s.group === group)
              .map((section) => {
                const { key, label, status, affectedBy } = section;
                const Icon = ICON[key];
                return (
                  <Link
                    key={key}
                    href={sectionHref(key)}
                    className={cn(
                      "rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow",
                      TONE_STYLE[status].border,
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      <span className={cn("h-2.5 w-2.5 rounded-full", TONE_STYLE[status].fill)} />
                    </div>
                    <p className="mt-3 font-semibold text-gray-900">{label}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      <span className="sr-only">{STATUS_WORD[status]}.</span> {ownLine(section, data)}
                    </p>
                    {affectedBy.length > 0 && (
                      <p className={cn("mt-1 text-xs font-medium", TONE_STYLE[status].text)}>
                        Affected by {sectionLabels(affectedBy)}
                      </p>
                    )}
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </>
  );
}
