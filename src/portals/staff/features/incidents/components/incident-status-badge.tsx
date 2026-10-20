import { Badge } from "@/portals/staff/components/ui/badge";
import { STATUS_BADGE_VARIANT, STATUS_LABELS } from "../lib/status";
import type { IncidentStatus } from "../types";

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}
