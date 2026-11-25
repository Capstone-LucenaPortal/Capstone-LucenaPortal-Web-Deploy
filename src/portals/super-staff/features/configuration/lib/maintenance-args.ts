import type { FnArgs } from "@/portals/super-staff/lib/supabase/rpc";
import type { MaintenancePeriod, NewMaintenancePeriod } from "./maintenance-types";

// Like the calendar RPCs, the maintenance pair has NO argument defaults: an
// omitted name matches no signature and is a loud PGRST202 404. Every builder
// names every argument, every time.

export const toAddMaintenancePeriodArgs = (
  p: NewMaintenancePeriod,
): FnArgs<"add_maintenance_period"> => ({
  p_space_code: p.spaceCode,
  p_first_day: p.firstDay,
  p_last_day: p.lastDay,
  p_reason: p.reason,
});

/** The first day is NOT a parameter (ADR 0012). A period that started on the
 *  wrong day is retired and a new one added, so the Audit Log says what
 *  happened instead of a start rewritten under days already closed. */
export const toUpdateMaintenancePeriodArgs = (
  p: MaintenancePeriod,
): FnArgs<"update_maintenance_period"> => ({
  p_id: p.id,
  p_last_day: p.lastDay,
  p_reason: p.reason,
  p_is_active: p.isActive,
});
