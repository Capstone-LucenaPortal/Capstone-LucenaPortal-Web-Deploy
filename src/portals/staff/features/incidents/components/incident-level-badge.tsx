import { Badge } from "@/portals/staff/components/ui/badge";
import { LEVEL_BADGE_VARIANT, LEVEL_LABELS } from "../lib/status";
import type { IncidentLevel } from "../types";

export function IncidentLevelBadge({ level }: { level: IncidentLevel }) {
  return <Badge variant={LEVEL_BADGE_VARIANT[level]}>{LEVEL_LABELS[level]}</Badge>;
}
