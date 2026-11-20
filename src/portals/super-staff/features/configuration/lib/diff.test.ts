import { describe, expect, it } from "vitest";
import {
  diffAgencyIdentity,
  diffBooking,
  diffIncidents,
  diffOfficer,
  diffSiteInfo,
  diffYellowCard,
  formatChange,
} from "./diff";

const booking = {
  downpaymentPct: 50,
  openingHour: 8,
  closingHour: 17,
  minDurationHours: 2,
  paymentWindowHours: 48,
};

const incidents = {
  slaHours: { Critical: 4, High: 8, Medium: 24, Low: 72 },
  atRiskThresholdPct: 50,
  nudgeDay: 5,
  autoCloseDay: 7,
  confirmationWindowDays: 3,
  maxActiveReportsPerCitizen: 5,
} as const;

describe("the frozen label table", () => {
  // These strings are read out of the RPC bodies (save_booking_config,
  // save_incident_config, save_yellow_card_config v_labels maps) and are the
  // contract: the modal must say what the audit log will say.
  it("uses the RPC's booking labels verbatim", () => {
    expect(diffBooking(booking, { ...booking, downpaymentPct: 60 })).toEqual([
      { label: "Downpayment (%)", before: "50", after: "60" },
    ]);
    expect(diffBooking(booking, { ...booking, openingHour: 9 })[0].label)
      .toBe("Opening hour");
    expect(diffBooking(booking, { ...booking, closingHour: 18 })[0].label)
      .toBe("Closing hour");
    expect(diffBooking(booking, { ...booking, minDurationHours: 3 })[0].label)
      .toBe("Minimum duration (hours)");
    expect(diffBooking(booking, { ...booking, paymentWindowHours: 24 })[0].label)
      .toBe("Payment window (hours)");
  });

  it("uses the RPC's incident labels verbatim", () => {
    const sla = (level: "Critical" | "High" | "Medium" | "Low", n: number) =>
      diffIncidents(incidents, {
        ...incidents,
        slaHours: { ...incidents.slaHours, [level]: n },
      })[0].label;
    expect(sla("Critical", 3)).toBe("Critical SLA (hours)");
    expect(sla("High", 9)).toBe("High SLA (hours)");
    expect(sla("Medium", 25)).toBe("Medium SLA (hours)");
    expect(sla("Low", 73)).toBe("Low SLA (hours)");

    expect(diffIncidents(incidents, { ...incidents, atRiskThresholdPct: 60 })[0].label)
      .toBe("At-risk threshold (%)");
    expect(diffIncidents(incidents, { ...incidents, nudgeDay: 6 })[0].label)
      .toBe("Nudge day");
    expect(diffIncidents(incidents, { ...incidents, autoCloseDay: 8 })[0].label)
      .toBe("Auto-close day");
    expect(diffIncidents(incidents, { ...incidents, confirmationWindowDays: 4 })[0].label)
      .toBe("Confirmation window (days)");
    expect(diffIncidents(incidents, { ...incidents, maxActiveReportsPerCitizen: 6 })[0].label)
      .toBe("Max active reports per citizen");
  });

  it("uses the RPC's site-info labels verbatim", () => {
    const before = { trunkline: "(042) 788-2298", officeHours: "8-5" };
    expect(diffSiteInfo(before, { ...before, trunkline: "(042) 788-2299" })).toEqual([
      { label: "Trunkline", before: "(042) 788-2298", after: "(042) 788-2299" },
    ]);
    expect(diffSiteInfo(before, { ...before, officeHours: "9-6" })[0].label)
      .toBe("Office hours");
  });

  it("uses the RPC's yellow-card labels verbatim", () => {
    const before = { processingTimeTargetDays: 2, atRiskThresholdPct: 67 };
    expect(diffYellowCard(before, { ...before, processingTimeTargetDays: 3 }))
      .toEqual([
        { label: "Processing time target (days)", before: "2", after: "3" },
      ]);
    // l80's v_labels entry — the incident wording, so one audit vocabulary.
    expect(diffYellowCard(before, { ...before, atRiskThresholdPct: 50 }))
      .toEqual([
        { label: "At-risk threshold (%)", before: "67", after: "50" },
      ]);
  });
});

describe("value formatting", () => {
  it("emits RAW integers — the unit lives in the label, as the RPC writes it", () => {
    const [change] = diffIncidents(incidents, {
      ...incidents,
      slaHours: { ...incidents.slaHours, Critical: 3 },
    });
    expect(change.before).toBe("4");
    expect(change.after).toBe("3");
    expect(change.before).not.toContain("h");
  });

  it("composes the exact line the audit log will show", () => {
    const [change] = diffIncidents(incidents, {
      ...incidents,
      slaHours: { ...incidents.slaHours, Critical: 3 },
    });
    expect(formatChange(change)).toBe("Critical SLA (hours) 4 → 3");
  });
});

describe("no-op saves", () => {
  it("returns nothing when nothing changed", () => {
    expect(diffBooking(booking, booking)).toEqual([]);
    expect(diffIncidents(incidents, incidents)).toEqual([]);
  });

  // save_site_info btrims before comparing, so surrounding whitespace is not a
  // change the database will record — the modal must not claim it is.
  it("ignores whitespace-only edits to site info", () => {
    const before = { trunkline: "(042) 788-2298", officeHours: "8-5" };
    expect(diffSiteInfo(before, { trunkline: "  (042) 788-2298  ", officeHours: "8-5 " }))
      .toEqual([]);
  });
});

// ── Receipts (l66) ──────────────────────────────────────────────────────────
// Labels read out of update_officer_of_record's and save_agency_identity's
// v_labels maps. Both RPCs btrim before comparing.

const nominated = {
  service: "incidents" as const,
  fullName: "Jose Rizal",
  unit: "CDRRMO",
  designation: "Department Head",
  isPlaceholder: false,
};

const placeholder = {
  service: "yellow_card" as const,
  fullName: "To be nominated",
  unit: "Pending nomination (SCRUM-105)",
  designation: "Officer of Record",
  isPlaceholder: true,
};

describe("diffOfficer", () => {
  it("uses the RPC's labels verbatim", () => {
    expect(diffOfficer(nominated, { ...nominated, fullName: "Andres Bonifacio" }))
      .toEqual([{ label: "Name", before: "Jose Rizal", after: "Andres Bonifacio" }]);
    expect(diffOfficer(nominated, { ...nominated, unit: "City Engineering" }))
      .toEqual([{ label: "Unit", before: "CDRRMO", after: "City Engineering" }]);
    expect(diffOfficer(nominated, { ...nominated, designation: "OIC" }))
      .toEqual([{ label: "Designation", before: "Department Head", after: "OIC" }]);
  });

  // The RPC always writes is_placeholder = false and audits the flip as
  // "Placeholder true → false", so the dialog shows it too.
  it("shows the placeholder ending when a placeholder officer is edited", () => {
    expect(diffOfficer(placeholder, { ...placeholder, fullName: "Maria Santos" }))
      .toEqual([
        { label: "Name", before: "To be nominated", after: "Maria Santos" },
        { label: "Placeholder", before: "true", after: "false" },
      ]);
  });

  it("returns nothing for an untouched officer, placeholder or not", () => {
    expect(diffOfficer(placeholder, placeholder)).toEqual([]);
    expect(diffOfficer(nominated, nominated)).toEqual([]);
  });

  it("ignores whitespace-only edits", () => {
    expect(diffOfficer(nominated, { ...nominated, fullName: " Jose Rizal  " }))
      .toEqual([]);
  });
});

describe("diffAgencyIdentity", () => {
  const before = { agencyName: "City Government of Lucena", sealPath: "agency/seal.png" };

  it("uses the RPC's labels verbatim", () => {
    expect(diffAgencyIdentity(before, { ...before, agencyName: "Lucena City" }))
      .toEqual([
        { label: "Agency name", before: "City Government of Lucena", after: "Lucena City" },
      ]);
    expect(diffAgencyIdentity(before, { ...before, sealPath: "agency/seal-1-abcdef01.png" }))
      .toEqual([
        { label: "Seal", before: "agency/seal.png", after: "agency/seal-1-abcdef01.png" },
      ]);
  });

  it("ignores whitespace-only edits to the agency name", () => {
    expect(diffAgencyIdentity(before, { ...before, agencyName: " City Government of Lucena " }))
      .toEqual([]);
  });
});
