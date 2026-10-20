import { cache } from "react";
import { createClient } from "@/shared/supabase/server";
import { DEFAULT_AT_RISK_THRESHOLD } from "./sla";

/**
 * Pure. `at_risk_threshold_pct` is stored as a whole percentage and consumed as
 * a fraction. Anything outside 1–100 is treated as unreadable rather than
 * obeyed: a zero would mark every armed incident at risk, and a 500 would mark
 * none, and both are worse than the stored default.
 */
export function toThreshold(pct: number | null | undefined): number {
  if (typeof pct !== "number" || pct <= 0 || pct > 100) {
    return DEFAULT_AT_RISK_THRESHOLD;
  }
  return pct / 100;
}

/**
 * Server-only glue. React's cache() dedupes across a single render pass, so a
 * queue page that needs the threshold for both the table and the At Risk card
 * reads it once.
 *
 * A read failure returns the default rather than throwing: the threshold decides
 * a badge colour, and failing the whole queue because a one-row config table was
 * unreachable would not be a trade anyone wants.
 *
 * The view is `staff_incident_config`, NOT `public_incident_config`. l53 put
 * `at_risk_threshold_pct` behind the staff gate and left the public view with
 * the citizen-facing columns only; verified by live query on 2026-08-08.
 */
export const getAtRiskThreshold = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_incident_config")
    .select("at_risk_threshold_pct")
    .maybeSingle();

  return toThreshold((data as { at_risk_threshold_pct: number | null } | null)
    ?.at_risk_threshold_pct);
});
