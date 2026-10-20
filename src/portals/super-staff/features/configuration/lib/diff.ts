import type {
  BookingConfig,
  IncidentLevel,
  IncidentsConfig,
  YellowCardConfig,
} from "../types";
import { INCIDENT_LEVELS } from "../types";
import type { SiteInfo } from "./site-info-types";

/**
 * A single old→new change. Values are RAW — the unit belongs to the label,
 * because that is how the database composes its audit line:
 *   label || ' ' || before || ' → ' || after
 * If these strings drift from the RPCs' v_labels maps, the confirm modal
 * promises one thing and the audit log records another.
 */
export type ConfigChange = { label: string; before: string; after: string };

export function formatChange(c: ConfigChange): string {
  return `${c.label} ${c.before} → ${c.after}`;
}

/**
 * Generic field differ: one entry per field whose rendered value actually
 * moved. `render` runs BEFORE the comparison, which is what lets the string
 * fields trim without a second copy of this loop — a value that only differs
 * by whitespace is not a change the database will record either.
 */
function diffFields<T, V>(
  before: T,
  after: T,
  fields: { get: (c: T) => V; label: string }[],
  render: (value: V) => string = (value) => `${value}`,
): ConfigChange[] {
  const changes: ConfigChange[] = [];
  for (const f of fields) {
    const b = render(f.get(before));
    const a = render(f.get(after));
    if (b !== a) changes.push({ label: f.label, before: b, after: a });
  }
  return changes;
}

// ── Booking — mirrors save_booking_config's v_labels ────────────────────────
export function diffBooking(before: BookingConfig, after: BookingConfig) {
  return diffFields(before, after, [
    { get: (c) => c.downpaymentPct, label: "Downpayment (%)" },
    { get: (c) => c.paymentWindowHours, label: "Payment window (hours)" },
    { get: (c) => c.minDurationHours, label: "Minimum duration (hours)" },
    { get: (c) => c.openingHour, label: "Opening hour" },
    { get: (c) => c.closingHour, label: "Closing hour" },
  ]);
}

// ── Incidents — mirrors save_incident_config's v_labels ─────────────────────
const SLA_LABELS: Record<IncidentLevel, string> = {
  Critical: "Critical SLA (hours)",
  High: "High SLA (hours)",
  Medium: "Medium SLA (hours)",
  Low: "Low SLA (hours)",
};

export function diffIncidents(before: IncidentsConfig, after: IncidentsConfig) {
  return diffFields(before, after, [
    ...INCIDENT_LEVELS.map((level) => ({
      get: (c: IncidentsConfig) => c.slaHours[level],
      label: SLA_LABELS[level],
    })),
    { get: (c: IncidentsConfig) => c.atRiskThresholdPct, label: "At-risk threshold (%)" },
    { get: (c: IncidentsConfig) => c.nudgeDay, label: "Nudge day" },
    { get: (c: IncidentsConfig) => c.autoCloseDay, label: "Auto-close day" },
    { get: (c: IncidentsConfig) => c.confirmationWindowDays, label: "Confirmation window (days)" },
    { get: (c: IncidentsConfig) => c.maxActiveReportsPerCitizen, label: "Max active reports per citizen" },
  ]);
}

// ── Site info — mirrors save_site_info's v_labels ───────────────────────────
// The RPC btrims both values before comparing, so trimming here too keeps the
// modal from announcing a change the database will not record.
export function diffSiteInfo(before: SiteInfo, after: SiteInfo): ConfigChange[] {
  return diffFields(
    before,
    after,
    [
      { get: (c) => c.trunkline, label: "Trunkline" },
      { get: (c) => c.officeHours, label: "Office hours" },
    ],
    (value) => value.trim(),
  );
}

// ── Yellow Card — mirrors save_yellow_card_config's v_labels ────────────────
export function diffYellowCard(before: YellowCardConfig, after: YellowCardConfig) {
  return diffFields(before, after, [
    {
      get: (c) => c.processingTimeTargetDays,
      label: "Processing time target (days)",
    },
    { get: (c) => c.atRiskThresholdPct, label: "At-risk threshold (%)" },
  ]);
}
