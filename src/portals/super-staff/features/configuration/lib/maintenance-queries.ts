import { createClient } from "@/shared/supabase/client";
import { requiredColumn } from "@/portals/super-staff/lib/supabase/rows";
import { rows } from "@/portals/super-staff/lib/supabase/select";
import type { Database } from "@/shared/supabase/types";
import {
  SPACE_STATE_KINDS,
  type MaintenancePeriod,
  type SpaceState,
  type SpaceStateKind,
} from "./maintenance-types";

type Views = Database["public"]["Views"];
type PeriodRow = Pick<
  Views["super_maintenance_periods"]["Row"],
  "id" | "space_code" | "space_label" | "first_day" | "last_day" | "reason" | "is_active"
>;
type SpaceStateRow = Pick<
  Views["super_space_states"]["Row"],
  "space_code" | "space_label" | "state" | "maintenance_reason" | "maintenance_last_day"
>;

// No audit stamps: who changed a period is the Audit Log's question (area
// 'maintenance'), and selecting a column nothing maps only invites mapping it.
const PERIOD_COLUMNS = "id, space_code, space_label, first_day, last_day, reason, is_active";
const SPACE_STATE_COLUMNS =
  "space_code, space_label, state, maintenance_reason, maintenance_last_day";
const PERIODS_VIEW = "super_maintenance_periods";

const isSpaceState = (s: string | null): s is SpaceStateKind =>
  s !== null && (SPACE_STATE_KINDS as readonly string[]).includes(s);

/**
 * Every Maintenance Period, RETIRED ONES INCLUDED. Never filter on is_active:
 * a retired period that cannot be seen cannot be reactivated.
 *
 * A row with no id, Space or days can neither be rendered nor written back,
 * so it is dropped rather than defaulted.
 */
export function toMaintenancePeriods(data: PeriodRow[]): MaintenancePeriod[] {
  return data
    .map((r) =>
      r.id === null || r.space_code === null || r.first_day === null || r.last_day === null
        ? null
        : {
            id: r.id,
            spaceCode: r.space_code,
            spaceLabel: r.space_label ?? r.space_code,
            firstDay: r.first_day,
            lastDay: r.last_day,
            reason: r.reason ?? "",
            isActive: requiredColumn(r.is_active, "is_active", PERIODS_VIEW),
          },
    )
    .filter((p): p is MaintenancePeriod => p !== null);
}

/**
 * One line per Space. States are text in the database, not an enum (l125b
 * §5), so one this portal does not know is dropped rather than shown as a
 * guess — a wrong "Available" is worse than a missing line.
 */
export function toSpaceStates(data: SpaceStateRow[]): SpaceState[] {
  return data
    .map((r) => {
      const state = r.state;
      return r.space_code === null || !isSpaceState(state)
        ? null
        : {
            spaceCode: r.space_code,
            spaceLabel: r.space_label ?? r.space_code,
            state,
            maintenanceReason: r.maintenance_reason,
            maintenanceLastDay: r.maintenance_last_day,
          };
    })
    .filter((s): s is SpaceState => s !== null);
}

/** Latest first day on top: what is closed now and next is what gets edited. */
export async function listMaintenancePeriods(): Promise<MaintenancePeriod[]> {
  return toMaintenancePeriods(
    await rows(
      createClient()
        .from("super_maintenance_periods")
        .select(PERIOD_COLUMNS)
        .order("first_day", { ascending: false })
        .order("space_code", { ascending: true }),
    ),
  );
}

/**
 * Each Space's state now. Both Spaces are seeded, so an empty list means the
 * gate refused — a definer view answers a wrong caller with zero rows, not an
 * error. The card reads it as "not permitted".
 */
export async function listSpaceStates(): Promise<SpaceState[]> {
  return toSpaceStates(
    await rows(
      createClient()
        .from("super_space_states")
        .select(SPACE_STATE_COLUMNS)
        .order("space_code", { ascending: true }),
    ),
  );
}
