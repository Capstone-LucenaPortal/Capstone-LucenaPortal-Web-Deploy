// src/portals/admin/features/sla/components/sla-row-filter-banner.tsx
import { Button } from "@/portals/admin/components/ui/button";
import type { SlaRowFilter } from "@/portals/admin/features/sla/lib/sla-links";

const FILTER_TEXT: Record<SlaRowFilter, string> = {
  late: "that finished late in the selected range",
  "past-due": "past due now, whatever the date range",
};

/**
 * Says which SLA Reports filter narrows the table below, and clears it
 * (#127). `noun` is what the table lists: "applications", "reports" or
 * "bookings" (#175).
 */
export function SlaRowFilterBanner({
  filter,
  noun,
  onClear,
}: {
  filter: SlaRowFilter;
  noun: string;
  onClear: () => void;
}) {
  return (
    <div className="mx-6 mt-4 flex flex-wrap items-center justify-between gap-2 border border-amber-200 bg-amber-50 px-4 py-2">
      <p className="text-sm text-gray-800">{`Showing only ${noun} ${FILTER_TEXT[filter]}`}</p>
      <Button variant="secondary" onClick={onClear}>
        Clear filter
      </Button>
    </div>
  );
}
