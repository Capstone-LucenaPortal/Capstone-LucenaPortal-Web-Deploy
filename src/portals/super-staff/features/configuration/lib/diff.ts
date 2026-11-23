import type {
  BookingConfig,
  IncidentLevel,
  IncidentsConfig,
  YellowCardConfig,
} from "../types";
import { INCIDENT_LEVELS } from "../types";
import type { AgencyIdentity, Officer } from "./receipts-types";
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
    { get: (c) => c.changeoverHours, label: "Changeover (hours)" },
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

/** For the string fields whose RPC btrims before comparing. */
const trimmed = (value: string) => value.trim();

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
    trimmed,
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

// ── Receipts — mirror update_officer_of_record's and save_agency_identity's
// v_labels. Both RPCs btrim before comparing, so these trim too.

/**
 * The three fields, plus the placeholder flip. `update_officer_of_record`
 * ALWAYS writes is_placeholder = false and audits it as
 * "Placeholder true → false", so a placeholder's first save shows that line
 * as well. It is never a change on its own: the draft cannot set the flag, so
 * an untouched placeholder is not dirty.
 */
export function diffOfficer(before: Officer, after: Officer): ConfigChange[] {
  const changes = diffFields(
    before,
    after,
    [
      { get: (o) => o.fullName, label: "Name" },
      { get: (o) => o.unit, label: "Unit" },
      { get: (o) => o.designation, label: "Designation" },
    ],
    trimmed,
  );
  if (changes.length > 0 && before.isPlaceholder) {
    changes.push({ label: "Placeholder", before: "true", after: "false" });
  }
  return changes;
}

export function diffAgencyIdentity(
  before: AgencyIdentity,
  after: AgencyIdentity,
): ConfigChange[] {
  return diffFields(
    before,
    after,
    [
      { get: (a) => a.agencyName, label: "Agency name" },
      { get: (a) => a.sealPath, label: "Seal" },
    ],
    trimmed,
  );
}
