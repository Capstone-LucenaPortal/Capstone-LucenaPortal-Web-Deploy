import { Badge } from "@/portals/staff/components/ui/badge";
import { STATUS_BADGE_VARIANT, STATUS_LABELS } from "../lib/status";
import type { YellowCardStatus } from "../types";

export function YellowCardStatusBadge({ status }: { status: YellowCardStatus }) {
  return (
    <Badge variant={STATUS_BADGE_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
  );
}
