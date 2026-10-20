import { describe, expect, it } from "vitest";
import {
  toBookingConfigArgs,
  toIncidentConfigArgs,
  toYellowCardConfigArgs,
} from "./config-args";

describe("toBookingConfigArgs", () => {
  const booking = {
    downpaymentPct: 50,
    openingHour: 8,
    closingHour: 17,
    minDurationHours: 2,
    paymentWindowHours: 48,
  };

  it("builds exactly the five arguments the tab edits", () => {
    expect(toBookingConfigArgs(booking)).toEqual({
      p_downpayment_pct: 50,
      p_opening_hour: 8,
      p_closing_hour: 17,
      p_min_duration_hours: 2,
      p_payment_window_hours: 48,
    });
  });

  it("never sends balance_due_days_before_event — omitted means unchanged", () => {
    expect(toBookingConfigArgs(booking)).not.toHaveProperty(
      "p_balance_due_days_before_event",
    );
  });

  it("never sends a discount rate — no such value exists in the database", () => {
    expect(Object.keys(toBookingConfigArgs(booking)).join()).not.toMatch(/discount/);
  });
});

describe("toIncidentConfigArgs", () => {
  const incidents = {
    slaHours: { Critical: 4, High: 8, Medium: 24, Low: 72 },
    atRiskThresholdPct: 50,
    nudgeDay: 5,
    autoCloseDay: 7,
    confirmationWindowDays: 3,
    maxActiveReportsPerCitizen: 5,
  } as const;

  it("flattens slaHours into the four named parameters", () => {
    expect(toIncidentConfigArgs(incidents)).toEqual({
      p_sla_hours_critical: 4,
      p_sla_hours_high: 8,
      p_sla_hours_medium: 24,
      p_sla_hours_low: 72,
      p_at_risk_threshold_pct: 50,
      p_nudge_day: 5,
      p_auto_close_day: 7,
      p_confirmation_window_days: 3,
      p_max_active_reports_per_citizen: 5,
    });
  });

  it("never sends max_photos_per_cycle — raising it permanently increases storage nobody can reclaim", () => {
    expect(toIncidentConfigArgs(incidents)).not.toHaveProperty(
      "p_max_photos_per_cycle",
    );
  });
});

describe("toYellowCardConfigArgs", () => {
  // l80 added the threshold. Both arguments, by the names the RPC declares.
  it("builds both arguments save_yellow_card_config declares", () => {
    expect(
      toYellowCardConfigArgs({ processingTimeTargetDays: 3, atRiskThresholdPct: 67 }),
    ).toEqual({
      p_processing_time_target_days: 3,
      p_at_risk_threshold_pct: 67,
    });
  });
});
