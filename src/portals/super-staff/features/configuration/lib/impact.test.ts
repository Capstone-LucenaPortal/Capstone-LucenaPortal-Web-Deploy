import { describe, expect, it } from "vitest";
import { bookingImpact, incidentImpact, yellowCardImpact } from "./impact";
import type { BookingConfig, IncidentsConfig } from "../types";

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
  changeoverHours: 1,
};

describe("incidentImpact", () => {
  it("is all-null for an unchanged config", () => {
    expect(incidentImpact(incidents, incidents)).toEqual({
      sla: null,
      atRisk: null,
      unverified: null,
    });
  });

  it("names the old and new SLA for a level that moved", () => {
    const draft = { ...incidents, slaHours: { ...incidents.slaHours, Critical: 3 } };
    const { sla } = incidentImpact(incidents, draft);
    expect(sla).toContain("3h instead of 4h");
    expect(sla).toContain("In-flight incidents keep their armed target.");
  });

  it("summarizes the at-risk threshold move", () => {
    expect(incidentImpact(incidents, { ...incidents, atRiskThresholdPct: 60 }).atRisk)
      .toContain("60%");
  });

  // l57 shipped two distinct sweeper passes; the note must describe both.
  it("describes all three lifecycle knobs when any one moves", () => {
    const { unverified } = incidentImpact(incidents, {
      ...incidents,
      confirmationWindowDays: 4,
    });
    expect(unverified).toContain("nudges a reporter on day 5");
    expect(unverified).toContain("auto-closes a resolved report on day 7");
    expect(unverified).toContain("closes a never-verified report after 4 days");
  });
});

describe("yellowCardImpact", () => {
  const yellowCard = { processingTimeTargetDays: 2, atRiskThresholdPct: 67 };

  it("is all-null for an unchanged config", () => {
    expect(yellowCardImpact(yellowCard, yellowCard)).toEqual({ target: null, atRisk: null });
  });

  it("describes the new target, which applies to new applications only", () => {
    const { target } = yellowCardImpact(yellowCard, { ...yellowCard, processingTimeTargetDays: 1 });
    expect(target).toContain("1 working day.");
    expect(target).toContain("new applications only");
  });

  /**
   * Unlike the target, the threshold is not snapshotted: the database reads it
   * on every queue read, so the note must not promise "new applications only".
   */
  it("says the threshold moves every running application at once", () => {
    const { atRisk } = yellowCardImpact(yellowCard, { ...yellowCard, atRiskThresholdPct: 50 });
    expect(atRisk).toContain("50%");
    expect(atRisk).toContain("was 67%");
    expect(atRisk).toContain("every running application");
    expect(atRisk).not.toContain("new applications only");
  });
});

describe("bookingImpact", () => {
  it("is all-null for an unchanged config", () => {
    expect(bookingImpact(booking, booking)).toEqual({
      financial: null,
      hours: null,
      changeover: null,
    });
  });

  it("describes the downpayment and the unpaid-hold sweep together", () => {
    const impact = bookingImpact(booking, { ...booking, downpaymentPct: 40 });
    expect(impact.financial).toContain("40% downpayment");
    expect(impact.financial).toContain("swept 48 hours");
    expect(impact.hours).toBeNull();
  });

  it("describes the window the citizen form will offer when hours move", () => {
    const impact = bookingImpact(booking, { ...booking, openingHour: 9 });
    expect(impact.hours).toContain("9:00–17:00");
    expect(impact.hours).toContain("2-hour minimum");
    expect(impact.hours).toContain("reads these live");
  });

  // ADR 0010: the Changeover is snapshotted onto each Booking at submit.
  it("names the new Changeover and says existing Bookings keep theirs", () => {
    const impact = bookingImpact(booking, { ...booking, changeoverHours: 2 });
    expect(impact.changeover).toBe(
      "Each new booking keeps its space free for 2 hour(s) after the event so the LCC can reset it. Bookings already made keep the changeover they were booked with.",
    );
    expect(impact.financial).toBeNull();
    expect(impact.hours).toBeNull();
  });

  // "free for 0 hour(s)" is nonsense; 0 means the Changeover is off.
  it("says a Changeover of 0 turns it off for new Bookings", () => {
    expect(bookingImpact(booking, { ...booking, changeoverHours: 0 }).changeover).toBe(
      "New bookings will have no changeover: the space can be booked again as soon as the event ends. Bookings already made keep the changeover they were booked with.",
    );
  });

  it("stays silent on a Changeover the form is refusing", () => {
    expect(bookingImpact(booking, { ...booking, changeoverHours: 5 }).changeover).toBeNull();
    expect(bookingImpact(booking, { ...booking, changeoverHours: Number.NaN }).changeover)
      .toBeNull();
  });
});
