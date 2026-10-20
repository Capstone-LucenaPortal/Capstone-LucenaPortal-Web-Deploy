import { Badge } from "@/portals/super-staff/components/ui/badge";
import type { AnnouncementStatus } from "../types";

const VARIANT: Record<
  AnnouncementStatus,
  "default" | "warning" | "success"
> = {
  Draft: "default",
  Scheduled: "warning",
  Published: "success",
  Expired: "default",
};

/**
 * Expired is off-air but not a draft, so it must not read as either Draft's
 * solid grey or Published's green. It reuses the neutral variant with an
 * outlined treatment — muted, and distinct from both at a glance.
 */
const EXTRA: Partial<Record<AnnouncementStatus, string>> = {
  Expired: "bg-transparent text-gray-500 ring-1 ring-inset ring-gray-300",
};

export function StatusBadge({ status }: { status: AnnouncementStatus }) {
  return (
    <Badge variant={VARIANT[status]} className={EXTRA[status]}>
      {status}
    </Badge>
  );
}
