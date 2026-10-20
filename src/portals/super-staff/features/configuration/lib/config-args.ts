import type { BookingConfig, IncidentsConfig, YellowCardConfig } from "../types";

/**
 * save_*_config coalesces every NULL parameter to the column's current value, so
 * an omitted argument means "leave unchanged". That is why the two withheld
 * knobs are simply absent here rather than read and echoed back: a round-trip
 * would clobber a value changed by migration between load and save.
 *
 * balance_due_days_before_event — its consumer (booking balance reminders) is a
 * separate job that does not exist; wiring it would be a dead knob.
 */
export function toBookingConfigArgs(c: BookingConfig) {
  return {
    p_downpayment_pct: c.downpaymentPct,
    p_opening_hour: c.openingHour,
    p_closing_hour: c.closingHour,
    p_min_duration_hours: c.minDurationHours,
    p_payment_window_hours: c.paymentWindowHours,
  };
}

/**
 * max_photos_per_cycle is withheld: a technical ceiling rather than city policy,
 * and the one knob with an irreversible cost — no bucket exposes a delete policy
 * to any role and there is no PITR on the free plan, so raising it permanently
 * increases storage nobody can reclaim.
 */
export function toIncidentConfigArgs(c: IncidentsConfig) {
  return {
    p_sla_hours_critical: c.slaHours.Critical,
    p_sla_hours_high: c.slaHours.High,
    p_sla_hours_medium: c.slaHours.Medium,
    p_sla_hours_low: c.slaHours.Low,
    p_at_risk_threshold_pct: c.atRiskThresholdPct,
    p_nudge_day: c.nudgeDay,
    p_auto_close_day: c.autoCloseDay,
    p_confirmation_window_days: c.confirmationWindowDays,
    p_max_active_reports_per_citizen: c.maxActiveReportsPerCitizen,
  };
}

export function toYellowCardConfigArgs(c: YellowCardConfig) {
  return {
    p_processing_time_target_days: c.processingTimeTargetDays,
    p_at_risk_threshold_pct: c.atRiskThresholdPct,
  };
}
