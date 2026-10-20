import { Badge } from "@/portals/super-staff/components/ui/badge";
import { areaLabel } from "../lib/area";
import type { AuditArea } from "../types";

/**
 * The Area column is a categorical label, not a status, so it stays on the
 * neutral `default` variant for every area — semantic colors (success/warning/
 * destructive) would imply a good/bad meaning the area does not carry.
 *
 * The variant map is keyed off the seven `audit_area` enum values so a member
 * added by a later migration still renders (via `areaLabel`) instead of blanking.
 */
const VARIANTS: Record<AuditArea, "default"> = {
  accounts: "default",
  configuration: "default",
  catalogs: "default",
  content: "default",
  pii_access: "default",
  calendar: "default",
  auth: "default",
};

export function AreaBadge({ area }: { area: AuditArea }) {
  return <Badge variant={VARIANTS[area] ?? "default"}>{areaLabel(area)}</Badge>;
}
