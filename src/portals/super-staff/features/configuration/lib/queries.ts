import { createClient } from "@/shared/supabase/client";
import { requiredColumn } from "@/portals/super-staff/lib/supabase/rows";
import { singleRow } from "@/portals/super-staff/lib/supabase/select";
import type { BookingConfig, IncidentsConfig, YellowCardConfig } from "../types";

// l62 added these three. Reading public_* instead would work for Booking and
// Yellow Card and FAIL for Incidents: at_risk_threshold_pct is deliberately
// absent from public_incident_config (that view is granted to anon), and
// staff_incident_config is gated is_active_staff('staff'), which a super_staff
// does not match — roles here are exact, not hierarchical.
const BOOKING_COLUMNS =
  "downpayment_pct, payment_window_hours, min_duration_hours, opening_hour, closing_hour";
const INCIDENT_COLUMNS =
  "sla_hours_critical, sla_hours_high, sla_hours_medium, sla_hours_low, at_risk_threshold_pct, nudge_day, auto_close_day, confirmation_window_days, max_active_reports_per_citizen";
const YELLOW_CARD_COLUMNS = "processing_time_target_days, at_risk_threshold_pct";

/**
 * Every column of these views is nullable in the generated types, and each row
 * below takes that shape straight from `singleRow` rather than asserting a
 * non-null one the view does not promise. `requiredColumn` is what turns each
 * value back into a number, and it throws rather than substituting: §7.1
 * requires that the portal "must not render a null as `0`", and every one of
 * these columns is NOT NULL on its base table.
 *
 * Zero rows is a different failure and is handled elsewhere: `.single()` raises
 * PGRST116, which the error seam reads as `permission` — these views return no
 * rows at all to anyone who is not an active super_staff.
 */

const BOOKING_VIEW = "super_booking_config";

export async function getBookingConfig(): Promise<BookingConfig> {
  const row = await singleRow(
    createClient().from(BOOKING_VIEW).select(BOOKING_COLUMNS).single(),
  );
  const required = (value: number | null, column: string) =>
    requiredColumn(value, column, BOOKING_VIEW);

  return {
    downpaymentPct: required(row.downpayment_pct, "downpayment_pct"),
    openingHour: required(row.opening_hour, "opening_hour"),
    closingHour: required(row.closing_hour, "closing_hour"),
    minDurationHours: required(row.min_duration_hours, "min_duration_hours"),
    paymentWindowHours: required(row.payment_window_hours, "payment_window_hours"),
  };
}

const INCIDENT_VIEW = "super_incident_config";

export async function getIncidentsConfig(): Promise<IncidentsConfig> {
  const row = await singleRow(
    createClient().from(INCIDENT_VIEW).select(INCIDENT_COLUMNS).single(),
  );
  const required = (value: number | null, column: string) =>
    requiredColumn(value, column, INCIDENT_VIEW);

  return {
    slaHours: {
      Critical: required(row.sla_hours_critical, "sla_hours_critical"),
      High: required(row.sla_hours_high, "sla_hours_high"),
      Medium: required(row.sla_hours_medium, "sla_hours_medium"),
      Low: required(row.sla_hours_low, "sla_hours_low"),
    },
    atRiskThresholdPct: required(row.at_risk_threshold_pct, "at_risk_threshold_pct"),
    nudgeDay: required(row.nudge_day, "nudge_day"),
    autoCloseDay: required(row.auto_close_day, "auto_close_day"),
    confirmationWindowDays: required(
      row.confirmation_window_days,
      "confirmation_window_days",
    ),
    maxActiveReportsPerCitizen: required(
      row.max_active_reports_per_citizen,
      "max_active_reports_per_citizen",
    ),
  };
}

const YELLOW_CARD_VIEW = "super_yellow_card_config";

export async function getYellowCardConfig(): Promise<YellowCardConfig> {
  const row = await singleRow(
    createClient().from(YELLOW_CARD_VIEW).select(YELLOW_CARD_COLUMNS).single(),
  );
  const required = (value: number | null, column: string) =>
    requiredColumn(value, column, YELLOW_CARD_VIEW);

  return {
    processingTimeTargetDays: required(
      row.processing_time_target_days,
      "processing_time_target_days",
    ),
    // l80. Readable here and NEVER on public_yellow_card_config (anon).
    atRiskThresholdPct: required(row.at_risk_threshold_pct, "at_risk_threshold_pct"),
  };
}
