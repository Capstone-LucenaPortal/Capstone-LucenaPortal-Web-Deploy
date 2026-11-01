import type { HealthStatus, Reachability, SnapshotSectionKey } from "../types";

/**
 * The page's own cut-offs. Every other status is graded by the database; this
 * one cannot be, because only the app can time a round trip.
 */
export const RESPONSE_WARNING_MS = 500;
export const RESPONSE_CRITICAL_MS = 2000;

/** `null` means /api/health itself could not be reached. */
export function reachabilityStatus(r: Reachability | null): HealthStatus {
  if (r === null || !r.ok || !r.db_ok || r.ms > RESPONSE_CRITICAL_MS) return "critical";
  if (r.ms > RESPONSE_WARNING_MS) return "warning";
  return "ok";
}

/**
 * The colour of a System Health dot for a status. `null` (not a Super Staff)
 * paints nothing. A failed read is not `null`: the sidebar paints it red.
 */
export function navDot(overall: HealthStatus | null): "amber" | "red" | null {
  if (overall === "warning") return "amber";
  if (overall === "critical") return "red";
  return null;
}

/** A section by its snapshot key; every section has a page (see SECTIONS). */
export type SectionKey = SnapshotSectionKey;

export type SectionGroup = "service" | "platform";

/** Each group's heading, in the second-level nav and on General. */
export const GROUP_HEADING: Record<SectionGroup, string> = {
  service: "Citizen services",
  platform: "Platform",
};

type SectionInfo = { key: SectionKey; slug: string; label: string; group: SectionGroup };

/**
 * Every section, in nav and tile order: the Citizen services, then the
 * Platform components. Each is one page under General, at its slug.
 */
export const SECTIONS: ReadonlyArray<SectionInfo> = [
  { key: "yellow_card", slug: "yellow-card", label: "Yellow Card", group: "service" },
  { key: "incidents", slug: "incidents", label: "Incidents", group: "service" },
  { key: "lcc", slug: "lcc", label: "LCC Bookings", group: "service" },
  { key: "database", slug: "database", label: "Database", group: "platform" },
  { key: "storage", slug: "storage", label: "Storage", group: "platform" },
  { key: "notifications", slug: "notifications", label: "Notifications", group: "platform" },
  { key: "jobs", slug: "jobs", label: "Background jobs", group: "platform" },
  { key: "accounts", slug: "accounts", label: "Accounts & sign-in", group: "platform" },
];

export function sectionInfo(key: SectionKey): SectionInfo {
  return SECTIONS.find((s) => s.key === key)!;
}

/** The section a page slug names; null = no such section, so Page not found. */
export function sectionFromSlug(slug: string): SectionKey | null {
  return SECTIONS.find((s) => s.slug === slug)?.key ?? null;
}

export type SectionStatus = {
  key: SectionKey;
  label: string;
  group: SectionGroup;
  /** The worst of the section's own graded checks; response time folded into Database. */
  ownStatus: HealthStatus;
  /** The worse of `ownStatus` and every dependency's. */
  status: HealthStatus;
  /** The dependencies that are not ok, worst first. Always empty for a Platform component. */
  affectedBy: SectionKey[];
};

/** The part of the snapshot the sections are graded from (l92's `sections`). */
type SectionGrades = {
  sections: Record<
    SectionKey,
    { own_status: HealthStatus; status: HealthStatus; affected_by: SectionKey[] }
  >;
  dependencies: Record<SectionKey, SectionKey[]>;
};

export const RANK: Record<HealthStatus, number> = { ok: 0, warning: 1, critical: 2 };

export function worse(a: HealthStatus, b: HealthStatus): HealthStatus {
  return RANK[b] > RANK[a] ? b : a;
}

/**
 * Each section's grade, read from the snapshot. The one rollup done here:
 * Database is the worse of the database's own grade and the app-graded
 * response time and reachability, and a service that depends on Database is
 * affected by it when only the app's grade is bad.
 */
export function sectionStatuses(h: SectionGrades, r: Reachability | null): SectionStatus[] {
  const reach = reachabilityStatus(r);
  const own = (key: SectionKey) =>
    key === "database" ? worse(h.sections.database.own_status, reach) : h.sections[key].own_status;
  return SECTIONS.map(({ key, label, group }) => {
    const s = h.sections[key];
    const dependsOnDatabase = h.dependencies[key].includes("database");
    return {
      key,
      label,
      group,
      ownStatus: own(key),
      status: key === "database" || dependsOnDatabase ? worse(s.status, reach) : s.status,
      affectedBy: dependsOnDatabase && reach !== "ok" ? withDatabase(s.affected_by, own) : s.affected_by,
    };
  });
}

/**
 * The database's affected_by (worst first, then dependency order) with
 * Database placed by its folded grade. Database leads every dependency list,
 * so it goes before any dependency graded the same.
 */
function withDatabase(affectedBy: SectionKey[], own: (key: SectionKey) => HealthStatus): SectionKey[] {
  const rest = affectedBy.filter((d) => d !== "database");
  const at = rest.findIndex((d) => RANK[own(d)] <= RANK[own("database")]);
  return at === -1 ? [...rest, "database"] : [...rest.slice(0, at), "database", ...rest.slice(at)];
}

/** A root cause the banner names once: a section whose own checks fail, and the services it affects. */
export type RootCause = SectionStatus & { affects: SectionStatus[] };

/**
 * What General's banner names: each Platform component whose own checks are
 * not ok, with the services it affects, then each service whose own checks
 * are failing; critical first within each. A service whose only problem is a
 * dependency is not named on its own: its cause already is.
 */
export function rootCauses(sections: SectionStatus[]): RootCause[] {
  const failing = (group: SectionGroup) =>
    sections
      .filter((s) => s.group === group && s.ownStatus !== "ok")
      .sort((a, b) => RANK[b.ownStatus] - RANK[a.ownStatus]);
  return [
    ...failing("platform").map((c) => ({ ...c, affects: sections.filter((s) => s.affectedBy.includes(c.key)) })),
    ...failing("service").map((s) => ({ ...s, affects: [] })),
  ];
}

/** The worst section, for General's banner and its nav dot. */
export function worstStatus(sections: SectionStatus[]): HealthStatus {
  return sections.reduce<HealthStatus>((w, s) => worse(w, s.status), "ok");
}
