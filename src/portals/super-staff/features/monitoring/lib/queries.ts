import { createClient } from "@/shared/supabase/client";
import { singleRow } from "@/portals/super-staff/lib/supabase/select";
import type { Metrics } from "../types";

// One line — see the plan's global constraints.
const METRIC_COLUMNS =
  "sla_compliance_pct, sla_compliance_pct_prev, at_risk_now, at_risk_prev, open_backlog, open_backlog_prev, bookings_7d, bookings_7d_prev";

/** `super_metrics` is a one-row aggregate view, so zero rows means the gate
 *  refused — that should surface as an error, not as blank tiles. */
export async function getMetrics(): Promise<Metrics> {
  const row = await singleRow(
    createClient().from("super_metrics").select(METRIC_COLUMNS).single(),
  );
  return {
    slaCompliancePct: row.sla_compliance_pct,
    slaCompliancePctPrev: row.sla_compliance_pct_prev,
    atRiskNow: row.at_risk_now,
    atRiskPrev: row.at_risk_prev,
    openBacklog: row.open_backlog,
    openBacklogPrev: row.open_backlog_prev,
    bookings7d: row.bookings_7d,
    bookings7dPrev: row.bookings_7d_prev,
  };
}
