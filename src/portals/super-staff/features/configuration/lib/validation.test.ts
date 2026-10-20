import { describe, expect, it } from "vitest";
import {
  isHexColor,
  validateBooking,
  validateCatalogOrder,
  validateCatalogRow,
  validateHoliday,
  validateIncidents,
  validateNewHoliday,
  validateOfficeHours,
  validatePostCategory,
  validateSiteInfo,
  validateSiteInfoEntry,
  validateYellowCard,
} from "./validation";
import type { BookingConfig, IncidentsConfig } from "../types";

// Local fixtures rather than `./seed` — the seed file is mock data and Task 12
// deletes it. A validation test must not depend on anything mock-backed.
const incidents: IncidentsConfig = {
  slaHours: { Critical: 4, High: 8, Medium: 24, Low: 72 },
  atRiskThresholdPct: 50,
  nudgeDay: 5,
  autoCloseDay: 7,
  confirmationWindowDays: 3,
  maxActiveReportsPerCitizen: 5,
};

const booking: BookingConfig = {
  downpaymentPct: 50,
  openingHour: 8,
  closingHour: 17,
  minDurationHours: 2,
  paymentWindowHours: 48,
};

describe("validateIncidents", () => {
  it("passes a coherent config", () => {
    expect(validateIncidents(incidents)).toEqual({});
  });
  it("rejects a non-positive or fractional SLA hour", () => {
    expect(
      validateIncidents({ ...incidents, slaHours: { ...incidents.slaHours, High: 0 } })["sla-High"],
    ).toBeDefined();
  });
  it("bounds the at-risk threshold to 1..99", () => {
    expect(validateIncidents({ ...incidents, atRiskThresholdPct: 0 }).atRisk).toBeDefined();
    expect(validateIncidents({ ...incidents, atRiskThresholdPct: 100 }).atRisk).toBeDefined();
  });
  it("requires auto-close to fall after the nudge day", () => {
    expect(
      validateIncidents({ ...incidents, nudgeDay: 7, autoCloseDay: 7 }).autoCloseDay,
    ).toBeDefined();
  });
  it("requires a confirmation window of at least a day", () => {
    expect(
      validateIncidents({ ...incidents, confirmationWindowDays: 0 }).confirmationWindow,
    ).toBeDefined();
  });
  it("requires a max-active-reports count of at least one", () => {
    expect(
      validateIncidents({ ...incidents, maxActiveReportsPerCitizen: 0 }).maxActiveReports,
    ).toBeDefined();
  });
});

describe("validateYellowCard", () => {
  const yellowCard = { processingTimeTargetDays: 3, atRiskThresholdPct: 67 };

  it("passes a coherent config and rejects < 1 day", () => {
    expect(validateYellowCard(yellowCard)).toEqual({});
    expect(
      validateYellowCard({ ...yellowCard, processingTimeTargetDays: 0 }).processingDays,
    ).toBeDefined();
  });

  // The CHECK is 1..99: 0 switches the warning off, 100 collapses it into Overdue.
  it("bounds the at-risk threshold to 1..99, as the database does", () => {
    expect(validateYellowCard({ ...yellowCard, atRiskThresholdPct: 0 }).atRisk).toBeDefined();
    expect(validateYellowCard({ ...yellowCard, atRiskThresholdPct: 100 }).atRisk).toBeDefined();
    expect(validateYellowCard({ ...yellowCard, atRiskThresholdPct: 66.5 }).atRisk).toBeDefined();
    expect(validateYellowCard({ ...yellowCard, atRiskThresholdPct: 1 })).toEqual({});
    expect(validateYellowCard({ ...yellowCard, atRiskThresholdPct: 99 })).toEqual({});
  });
});

describe("validateBooking", () => {
  it("passes a coherent config and bounds the downpayment to 0..100", () => {
    expect(validateBooking(booking)).toEqual({});
    expect(validateBooking({ ...booking, downpaymentPct: 120 }).downpayment).toBeDefined();
    expect(validateBooking({ ...booking, downpaymentPct: -5 }).downpayment).toBeDefined();
  });

  it("bounds both hours to 0..23", () => {
    expect(validateBooking({ ...booking, openingHour: -1 }).openingHour).toBeDefined();
    expect(validateBooking({ ...booking, closingHour: 24 }).closingHour).toBeDefined();
  });

  // Cross-field rule one: the citizen form reads both hours live, so an
  // inverted pair yields a window it cannot render.
  it("requires the closing hour to fall after the opening hour", () => {
    expect(validateBooking({ ...booking, openingHour: 17, closingHour: 8 }).closingHour)
      .toBe("Closing hour must be after the opening hour.");
    expect(validateBooking({ ...booking, openingHour: 8, closingHour: 8 }).closingHour)
      .toBeDefined();
  });

  // Cross-field rule two: a minimum longer than the open day offers no slot.
  it("rejects a minimum duration longer than the day is open", () => {
    expect(validateBooking({ ...booking, minDurationHours: 10 }).minDuration)
      .toBe("The minimum booking is longer than the day is open.");
    expect(validateBooking({ ...booking, minDurationHours: 9 }).minDuration)
      .toBeUndefined();
  });

  it("requires whole positive hours for the minimum duration and payment window", () => {
    expect(validateBooking({ ...booking, minDurationHours: 0 }).minDuration).toBeDefined();
    expect(validateBooking({ ...booking, paymentWindowHours: 0 }).paymentWindow).toBeDefined();
  });
});

// ── Catalog rows ───────────────────────────────────────────────────────────
// A cleared number input is `e.target.valueAsNumber` === NaN, which
// JSON-serializes to null against RPCs that are full replaces with no argument
// defaults. Scalars were already safe because requestSave runs validate(draft);
// these give catalog rows the same seam.
describe("validateCatalogOrder", () => {
  it("accepts a whole sort order of zero and above", () => {
    expect(validateCatalogOrder({ sortOrder: 0 })).toEqual({});
    expect(validateCatalogOrder({ sortOrder: 30 })).toEqual({});
  });

  it("rejects the NaN a cleared number input produces", () => {
    expect(validateCatalogOrder({ sortOrder: Number.NaN }).sortOrder).toBe(
      "Enter a whole number ≥ 0.",
    );
  });

  it("rejects a negative or fractional sort order", () => {
    expect(validateCatalogOrder({ sortOrder: -1 }).sortOrder).toBeDefined();
    expect(validateCatalogOrder({ sortOrder: 1.5 }).sortOrder).toBeDefined();
  });
});

describe("validateCatalogRow", () => {
  it("accepts a labelled row with a whole sort order", () => {
    expect(validateCatalogRow({ label: "Covered Court", sortOrder: 10 })).toEqual({});
  });

  it("rejects an emptied label", () => {
    expect(validateCatalogRow({ label: "", sortOrder: 10 }).label).toBe(
      "Enter a label.",
    );
    expect(validateCatalogRow({ label: "   ", sortOrder: 10 }).label).toBeDefined();
  });

  it("carries the sort-order rule rather than restating it", () => {
    expect(validateCatalogRow({ label: "Covered Court", sortOrder: Number.NaN }))
      .toEqual(validateCatalogOrder({ sortOrder: Number.NaN }));
  });

  it("reports both fields at once", () => {
    const errors = validateCatalogRow({ label: "", sortOrder: Number.NaN });
    expect(Object.keys(errors).sort()).toEqual(["label", "sortOrder"]);
  });
});

// ── Site info ──────────────────────────────────────────────────────────────
// Lifted out of site-info-view.tsx, where it was pure logic with no test while
// every sibling validator here was covered.
describe("validateSiteInfo", () => {
  const info = { trunkline: "(042) 373-1000", officeHours: "Mon-Fri 8am-5pm" };

  it("accepts a filled trunkline and office hours", () => {
    expect(validateSiteInfo(info)).toEqual({});
  });

  it("rejects a blank trunkline — save_site_info raises 22023 for one", () => {
    expect(validateSiteInfo({ ...info, trunkline: "   " }).trunkline).toBe(
      "The trunkline cannot be blank.",
    );
  });

  it("rejects blank office hours", () => {
    expect(validateSiteInfo({ ...info, officeHours: "" }).officeHours).toBe(
      "Office hours cannot be blank.",
    );
  });
});

describe("validateSiteInfoEntry", () => {
  const entry = { label: "Police", value: "117", sortOrder: 1 };

  it("accepts a complete entry", () => {
    expect(validateSiteInfoEntry(entry)).toEqual({});
  });

  it("rejects a blank value — an entry with no number helps nobody", () => {
    expect(validateSiteInfoEntry({ ...entry, value: "  " }).value).toBe(
      "Enter a value.",
    );
  });

  it("carries the label and sort-order rules from the shared catalog row", () => {
    expect(validateSiteInfoEntry({ label: "", value: "117", sortOrder: 1 }).label)
      .toBeDefined();
    expect(validateSiteInfoEntry({ ...entry, sortOrder: Number.NaN }).sortOrder)
      .toBeDefined();
  });
});

// ── Post categories ────────────────────────────────────────────────────────
// The DATABASE owns color_hex: update_post_category raises 22023 for anything
// that is not #RRGGBB, so the regex was already load-bearing while living
// untested inside category-manager.tsx.
describe("isHexColor", () => {
  it("accepts a 6-digit hex in either case", () => {
    expect(isHexColor("#0B5FFF")).toBe(true);
    expect(isHexColor("#0b5fff")).toBe(true);
  });

  it("rejects a 3-digit shorthand, a missing hash and a stray suffix", () => {
    expect(isHexColor("#fff")).toBe(false);
    expect(isHexColor("0B5FFF")).toBe(false);
    expect(isHexColor("#0B5FFFF")).toBe(false);
    expect(isHexColor("#0B5FFZ")).toBe(false);
  });
});

describe("validatePostCategory", () => {
  const category = { label: "Advisory", colorHex: "#0B5FFF", sortOrder: 2 };

  it("accepts a labelled category with a valid colour", () => {
    expect(validatePostCategory(category)).toEqual({});
  });

  it("treats no colour at all as valid — the column is nullable", () => {
    expect(validatePostCategory({ ...category, colorHex: null })).toEqual({});
  });

  it("rejects a colour the RPC would reject", () => {
    expect(validatePostCategory({ ...category, colorHex: "#fff" }).colorHex).toBe(
      "Use a 6-digit hex like #0B5FFF.",
    );
  });

  it("carries the label and sort-order rules from the shared catalog row", () => {
    expect(validatePostCategory({ ...category, label: "" }).label).toBeDefined();
    expect(validatePostCategory({ ...category, sortOrder: -2 }).sortOrder)
      .toBeDefined();
  });
});

describe("validateHoliday", () => {
  const holiday = { name: "Christmas Day", source: "RA 9492" };

  it("accepts a named holiday with its source", () => {
    expect(validateHoliday(holiday)).toEqual({});
  });

  it("requires a source — the instrument that declared it", () => {
    expect(validateHoliday({ ...holiday, source: "   " }).source).toBeDefined();
  });

  it("requires a name", () => {
    expect(validateHoliday({ ...holiday, name: "" }).name).toBeDefined();
  });

  it("matches the table's length limits: name 120, source 200", () => {
    expect(validateHoliday({ ...holiday, name: "x".repeat(120) })).toEqual({});
    expect(validateHoliday({ ...holiday, name: "x".repeat(121) }).name).toBeDefined();
    expect(validateHoliday({ ...holiday, source: "x".repeat(200) })).toEqual({});
    expect(validateHoliday({ ...holiday, source: "x".repeat(201) }).source).toBeDefined();
  });
});

describe("validateNewHoliday", () => {
  it("also requires a date", () => {
    const errors = validateNewHoliday({
      holidayDate: "",
      name: "Typhoon suspension",
      kind: "suspension",
      source: "EO 12, s. 2026",
    });
    expect(Object.keys(errors)).toEqual(["holidayDate"]);
  });
});

describe("validateOfficeHours", () => {
  const day = { open: true, openTime: "08:00", closeTime: "17:00" };

  it("accepts an open day with both times", () => {
    expect(validateOfficeHours(day)).toEqual({});
  });

  it("accepts a closed day whatever its times say", () => {
    expect(validateOfficeHours({ open: false, openTime: "", closeTime: "" })).toEqual({});
  });

  it("accepts 24:00 as a close — end of day", () => {
    expect(validateOfficeHours({ ...day, openTime: "00:00", closeTime: "24:00" })).toEqual({});
  });

  it("refuses a missing or malformed time on an open day", () => {
    expect(validateOfficeHours({ ...day, openTime: "" }).openTime).toBeDefined();
    expect(validateOfficeHours({ ...day, closeTime: "5pm" }).closeTime).toBeDefined();
    expect(validateOfficeHours({ ...day, openTime: "24:00" }).openTime).toBeDefined();
    expect(validateOfficeHours({ ...day, closeTime: "24:30" }).closeTime).toBeDefined();
  });

  it("leaves a close before the open to the database, whose 22023 is shown", () => {
    expect(validateOfficeHours({ ...day, openTime: "17:00", closeTime: "08:00" })).toEqual({});
  });
});
