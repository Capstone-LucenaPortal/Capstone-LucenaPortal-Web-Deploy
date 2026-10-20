// Domain types for the configuration feature. SCALARS ONLY — the catalogs that
// used to live on IncidentsConfig are separate rows saved through their own
// RPCs; see catalog-types.ts.
export type ConfigModule = "incidents" | "yellow-card" | "booking";
export type IncidentLevel = "Critical" | "High" | "Medium" | "Low";

/**
 * The levels in severity order, most urgent first.
 *
 * Lives beside the type because it IS the type's order: both the diff labels
 * and the impact note walk it, and two copies would silently disagree the day
 * a level is added. Capitalised on purpose — these key the `sla_hours_*`
 * columns and are NOT the lowercase `incident_level` database enum.
 */
export const INCIDENT_LEVELS: IncidentLevel[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
];

export type IncidentsConfig = {
  slaHours: Record<IncidentLevel, number>;
  atRiskThresholdPct: number;
  nudgeDay: number;
  autoCloseDay: number;
  confirmationWindowDays: number;
  maxActiveReportsPerCitizen: number;
};

export type YellowCardConfig = {
  processingTimeTargetDays: number;
  /**
   * l80. The share of each application's processing target, in Working Time,
   * after which Staff see it At risk. Internal: never on public_* views.
   */
  atRiskThresholdPct: number;
};

export type BookingConfig = {
  downpaymentPct: number;
  openingHour: number;
  closingHour: number;
  minDurationHours: number;
  paymentWindowHours: number;
};
