import type { AuditArea } from "../types";

/** The `audit_area` enum, in the order the filter tabs show it. */
export const AUDIT_AREAS: AuditArea[] = [
  "accounts",
  "configuration",
  "catalogs",
  "content",
  "pii_access",
  "calendar",
  "auth",
];

const LABELS: Record<AuditArea, string> = {
  accounts: "Accounts",
  configuration: "Configuration",
  catalogs: "Catalogs",
  content: "Content",
  pii_access: "PII access",
  calendar: "Calendar",
  auth: "Authentication",
};

/** Display label. An enum member added in a later migration renders as itself
 *  rather than blank — the portal must not swallow a real audit row. */
export function areaLabel(area: AuditArea): string {
  return LABELS[area] ?? String(area);
}

export function isAuditArea(value: string): value is AuditArea {
  return (AUDIT_AREAS as string[]).includes(value);
}
