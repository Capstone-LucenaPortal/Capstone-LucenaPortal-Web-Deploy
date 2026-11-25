/**
 * Where a Space stands today (Citizen `CONTEXT.md`, **Space State**; ADR 0012).
 * Never stored: `super_space_states` works it out on every read, with Under
 * Maintenance taking priority over Reserved, and Reserved over Available.
 */
export const SPACE_STATE_KINDS = ["available", "reserved", "under_maintenance"] as const;
export type SpaceStateKind = (typeof SPACE_STATE_KINDS)[number];

/** One Space's line on the Maintenance card. */
export type SpaceState = {
  spaceCode: string;
  spaceLabel: string;
  state: SpaceStateKind;
  /** Set only while Under Maintenance: the covering period's reason. */
  maintenanceReason: string | null;
  /** Set only while Under Maintenance: the covering period's last day. */
  maintenanceLastDay: string | null;
};

/**
 * A Maintenance Period as `super_maintenance_periods` hands it over. Retired
 * rows are included — the view is unfiltered on purpose (the l58a rule): a
 * retired period that cannot be seen cannot be reactivated.
 */
export type MaintenancePeriod = {
  id: string;
  spaceCode: string;
  spaceLabel: string;
  /** `YYYY-MM-DD`, a whole Manila date. Not editable: a wrong start is fixed
   *  by retiring the period and adding a new one (ADR 0012). */
  firstDay: string;
  /** `YYYY-MM-DD`, inclusive. Extended when repairs overrun, shortened when
   *  they finish early. */
  lastDay: string;
  reason: string;
  isActive: boolean;
};

/** What the add form collects — a Maintenance Period before it has an id. */
export type NewMaintenancePeriod = {
  spaceCode: string;
  firstDay: string;
  lastDay: string;
  reason: string;
};
