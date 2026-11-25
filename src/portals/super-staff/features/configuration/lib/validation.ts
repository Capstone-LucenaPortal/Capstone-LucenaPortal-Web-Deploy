import type { NewHoliday } from "./calendar-types";
import type { MaintenancePeriod, NewMaintenancePeriod } from "./maintenance-types";
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
 * booking_config's CHECK (l117). 0 is a real value — the Changeover off — so
 * this is not isPositiveInt. Exported because the impact note must not
 * describe a value the form is refusing.
 */
export const isChangeoverHours = (n: number) =>
  Number.isInteger(n) && n >= 0 && n <= 4;

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
  if (!isChangeoverHours(c.changeoverHours)) {
    errors.changeover = "Enter whole hours from 0 to 4.";
  }
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

/**
 * The maintenance writers' checks that need no clock: a reason of 1–500
 * characters after trimming (JS trim also strips the tabs, CR and LF the l85
 * rule does), and a last day not before the first. Whether a day is in the
 * past is left to the RPCs, which read Manila today themselves; a second copy
 * of that rule here could only disagree with the real one near midnight.
 */
export function validateMaintenancePeriod(
  p: Pick<MaintenancePeriod, "firstDay" | "lastDay" | "reason">,
): ConfigErrors {
  const errors: ConfigErrors = {};
  const reason = p.reason.trim();
  if (!reason) errors.reason = "Enter a reason.";
  else if (reason.length > 500) errors.reason = "At most 500 characters.";
  // ISO dates compare correctly as strings.
  if (!p.lastDay) errors.lastDay = "Pick the last day.";
  else if (p.firstDay && p.lastDay < p.firstDay)
    errors.lastDay = "The last day can't be before the first day.";
  return errors;
}

/** An add also carries the Space and the first day — the fields an edit cannot change. */
export function validateNewMaintenancePeriod(p: NewMaintenancePeriod): ConfigErrors {
  const errors = validateMaintenancePeriod(p);
  if (!p.spaceCode) errors.spaceCode = "Pick a Space.";
  if (!p.firstDay) errors.firstDay = "Pick the first day.";
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

/** Blank after trimming, or longer than `max` after trimming. */
function requiredText(value: string, max: number, blank: string): string | null {
  const v = value.trim();
  if (!v) return blank;
  if (v.length > max) return `At most ${max} characters.`;
  return null;
}

/**
 * Mirrors `update_officer_of_record`'s 22023 checks (and the table's CHECKs):
 * all three fields required after btrim, at most 120 / 200 / 120 characters.
 * The RPC's own message still gets through if one fires anyway.
 */
export function validateOfficer(o: {
  fullName: string;
  unit: string;
  designation: string;
}): ConfigErrors {
  const errors: ConfigErrors = {};
  const fullName = requiredText(o.fullName, 120, "Enter a name.");
  const unit = requiredText(o.unit, 200, "Enter a unit.");
  const designation = requiredText(o.designation, 120, "Enter a designation.");
  if (fullName) errors.fullName = fullName;
  if (unit) errors.unit = unit;
  if (designation) errors.designation = designation;
  return errors;
}

/**
 * Mirrors `save_agency_identity`'s 22023 checks on the name. The seal path is
 * never typed: it comes from the stored value or from `putSeal`, which only
 * mints `agency/` paths, so only its presence is checked here.
 */
export function validateAgencyIdentity(a: {
  agencyName: string;
  sealPath: string;
}): ConfigErrors {
  const errors: ConfigErrors = {};
  const agencyName = requiredText(a.agencyName, 200, "Enter the agency name.");
  if (agencyName) errors.agencyName = agencyName;
  if (!a.sealPath.trim()) errors.sealPath = "Upload a seal.";
  return errors;
}
