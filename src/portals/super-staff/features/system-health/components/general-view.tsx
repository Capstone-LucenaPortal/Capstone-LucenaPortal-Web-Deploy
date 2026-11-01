"use client";

import { ServiceImpact } from "@/portals/super-staff/features/monitoring/components/service-impact";
import { StatusOverview } from "./status-overview";
import { useSystemHealthData } from "./system-health-shell";

/**
 * System Health's landing page: the banner and one tile per section, then
 * Admin's service numbers as Service impact, last.
 */
export function GeneralView() {
  const data = useSystemHealthData();
  return (
    <div>
      <StatusOverview data={data} />
      <div className="mt-10">
        {/* Reloads with the rest of the page, on the same 60 s beat. */}
        <ServiceImpact refreshKey={data.loadedAt.getTime()} />
      </div>
    </div>
  );
}
