import type { NewHoliday } from "./calendar-types";
import type { BookingConfig, IncidentsConfig, YellowCardConfig } from "../types";

export type ConfigErrors = Record<string, string>;

const isPositiveInt = (n: number) => Number.isInteger(n) && n >= 1;

/**
 * Both modules' at-risk thresholds share the database's CHECK (1..99): 0 would
 * switch the warning off, 100 collapse it into a breach.
 */
const isThresholdPct = (n: number) => Number.isInteger(n) && n >= 1 && n <= 99;
const THRESHOLD_ERROR = "Enter a percentage between 1 and 99.";

/**
 * Catalog rows validate through the same `ConfigErrors` seam the scalar forms
 * use, and for the same reason: a cleared number input is `valueAsNumber` ===
 * NaN, which JSON-serializes to `null` against RPCs that are FULL REPLACES with
 * no argument defaults. `numValue` in the views guards display only.
 *
 * Two functions, not one: `booking_classifications` has no editable label (and
 * `update_booking_classification` does not accept one), so validating a label
 * there would make a row with an empty label in the database unsavable.
 */
export function validateCatalogOrder(row: { sortOrder: number }): ConfigErrors {
  return Number.isInteger(row.sortOrder) && row.sortOrder >= 0
    ? {}
    : { sortOrder: "Enter a whole number ≥ 0." };
}

export function validateCatalogRow(row: {
  label: string;
  sortOrder: number;
}): ConfigErrors {
  const errors = validateCatalogOrder(row);
  if (row.label.trim().length === 0) errors.label = "Enter a label.";
  return errors;
}

/** `save_site_info` raises 22023 for a blank scalar; catching it here is kinder. */
export function validateSiteInfo(c: {
  trunkline: string;
  officeHours: string;
}): ConfigErrors {
  const errors: ConfigErrors = {};
  if (!c.trunkline.trim()) errors.trunkline = "The trunkline cannot be blank.";
  if (!c.officeHours.trim()) errors.officeHours = "Office hours cannot be blank.";
  return errors;
}

/** A site-info entry is a catalog row that also carries the published value. */
export function validateSiteInfoEntry(row: {
  label: string;
  value: string;
  sortOrder: number;
}): ConfigErrors {
  const errors = validateCatalogRow(row);
  if (row.value.trim().length === 0) errors.value = "Enter a value.";
  return errors;
}

/**
 * ⚠️ The DATABASE owns `color_hex` — `update_post_category` raises 22023 for
 * anything that is not `#RRGGBB`, and the announcements list renders its swatch
 * straight from the column. Refusing the save here is the kinder path; the
 * RPC's own message still gets through if it fires anyway.
 */
const HEX = /^#[0-9A-Fa-f]{6}$/;

export const isHexColor = (value: string) => HEX.test(value);

export function validatePostCategory(row: {
  label: string;
  colorHex: string | null;
  sortOrder: number;
}): ConfigErrors {
  const errors = validateCatalogRow(row);
  // A null colour is valid: the column is nullable and the list falls back.
  if (row.colorHex !== null && !isHexColor(row.colorHex)) {
    errors.colorHex = "Use a 6-digit hex like #0B5FFF.";
  }
  return errors;
}

export function validateIncidents(c: IncidentsConfig): ConfigErrors {
  const errors: ConfigErrors = {};

  for (const [level, hours] of Object.entries(c.slaHours)) {
    if (!isPositiveInt(hours)) errors[`sla-${level}`] = "Enter whole hours ≥ 1.";
  }

  if (!isThresholdPct(c.atRiskThresholdPct)) errors.atRisk = THRESHOLD_ERROR;

  if (!isPositiveInt(c.nudgeDay)) errors.nudgeDay = "Enter a day ≥ 1.";
  if (!isPositiveInt(c.autoCloseDay)) errors.autoCloseDay = "Enter a day ≥ 1.";
  if (
    isPositiveInt(c.nudgeDay) &&
    isPositiveInt(c.autoCloseDay) &&
    c.autoCloseDay <= c.nudgeDay
  ) {
    errors.autoCloseDay = "Auto-close must fall after the nudge day.";
  }

  if (!isPositiveInt(c.confirmationWindowDays)) {
    errors.confirmationWindow = "Enter a day ≥ 1.";
  }
  if (!isPositiveInt(c.maxActiveReportsPerCitizen)) {
    errors.maxActiveReports = "Enter a count ≥ 1.";
  }

  return errors;
}

export function validateYellowCard(c: YellowCardConfig): ConfigErrors {
  const errors: ConfigErrors = {};
  if (!isPositiveInt(c.processingTimeTargetDays)) {
    errors.processingDays = "Enter a whole number of working days ≥ 1.";
  }
  if (!isThresholdPct(c.atRiskThresholdPct)) errors.atRisk = THRESHOLD_ERROR;
  return errors;
}

const isPct = (n: number) => Number.isInteger(n) && n >= 0 && n <= 100;
const isHour = (n: number) => Number.isInteger(n) && n >= 0 && n <= 23;

/**
 * The cross-field rules are not cosmetic: opening_hour, closing_hour and
 * min_duration_hours are read LIVE by the citizen booking form
 * (LCCStep3Scheduling.tsx), so an incoherent pair makes the public form
 * unusable rather than merely looking wrong here.
 */
export function validateBooking(c: BookingConfig): ConfigErrors {
  const errors: ConfigErrors = {};
  if (!isPct(c.downpaymentPct)) errors.downpayment = "Enter a percentage between 0 and 100.";
  if (!isHour(c.openingHour)) errors.openingHour = "Enter an hour between 0 and 23.";
  if (!isHour(c.closingHour)) errors.closingHour = "Enter an hour between 0 and 23.";
  if (isHour(c.openingHour) && isHour(c.closingHour) && c.closingHour <= c.openingHour) {
    errors.closingHour = "Closing hour must be after the opening hour.";
  }
  if (!isPositiveInt(c.minDurationHours)) errors.minDuration = "Enter whole hours ≥ 1.";
  if (
    isPositiveInt(c.minDurationHours) &&
    isHour(c.openingHour) &&
    isHour(c.closingHour) &&
    c.minDurationHours > c.closingHour - c.openingHour
  ) {
    errors.minDuration = "The minimum booking is longer than the day is open.";
  }
  if (!isPositiveInt(c.paymentWindowHours)) errors.paymentWindow = "Enter whole hours ≥ 1.";
  return errors;
}

/**
 * The holiday writers raise 22023 for a blank name or source, a name over 120
 * or a source over 200 characters — the table's CHECKs. Catching it here names
 * the field; the RPC's own message still gets through if it fires anyway.
 * The source is never optional: it is how an Auditor tells a 7 a.m. typhoon
 * suspension from a typo (user story 18).
 */
export function validateHoliday(h: { name: string; source: string }): ConfigErrors {
  const errors: ConfigErrors = {};
  const name = h.name.trim();
  const source = h.source.trim();
  if (!name) errors.name = "Enter a name.";
  else if (name.length > 120) errors.name = "At most 120 characters.";
  if (!source) errors.source = "Enter the proclamation or declaration that made it.";
  else if (source.length > 200) errors.source = "At most 200 characters.";
  return errors;
}

/** An add also carries the date — the one field an edit cannot change. */
export function validateNewHoliday(h: NewHoliday): ConfigErrors {
  const errors = validateHoliday(h);
  if (!h.holidayDate) errors.holidayDate = "Pick a date.";
  return errors;
}

// 00:00–23:59, plus 24:00 (end of day), which set_office_hours accepts.
const OPEN_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CLOSE_TIME = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

/**
 * Format only. A close at or before the open is deliberately NOT checked here:
 * set_office_hours refuses it with a 22023 whose message the screen shows, and
 * a second copy of that rule in the portal could only drift from the real one.
 */
export function validateOfficeHours(d: {
  open: boolean;
  openTime: string;
  closeTime: string;
}): ConfigErrors {
  if (!d.open) return {};
  const errors: ConfigErrors = {};
  if (!OPEN_TIME.test(d.openTime)) errors.openTime = "Enter a time as HH:MM.";
  if (!CLOSE_TIME.test(d.closeTime)) errors.closeTime = "Enter a time as HH:MM (24:00 for end of day).";
  return errors;
}
