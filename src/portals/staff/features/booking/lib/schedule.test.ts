import { describe, it, expect } from "vitest";
import { describeHold, describeWait, getEndTime, formatEventDay } from "./schedule";

describe("getEndTime", () => {
  it("adds whole hours to a morning start time", () => {
    expect(getEndTime("08:00", 9)).toBe("17:00");
  });

  it("adds hours that run into the evening", () => {
    expect(getEndTime("19:00", 3)).toBe("22:00");
  });

  it("respects the 6-hour minimum used by flat-rate venues", () => {
    expect(getEndTime("12:00", 6)).toBe("18:00");
  });
});

describe("formatEventDay", () => {
  it("formats the date together with its weekday", () => {
    expect(formatEventDay("2026-08-14")).toBe("Friday, August 14, 2026");
  });
});

describe("describeHold", () => {
  const now = new Date("2026-08-11T12:00:00+08:00");

  it("reports no hold when there is none", () => {
    // hold_expires_at is nulled outright once verify_payment accepts — from
    // there the slot is held for good.
    expect(describeHold(null, "confirmed", now)).toEqual({ kind: "none" });
  });

  it("counts the hours left while the window is open", () => {
    expect(describeHold("2026-08-13T12:00:00+08:00", "awaiting_payment", now)).toEqual(
      { kind: "running", hoursLeft: 48 },
    );
  });

  it("rounds a part-hour up rather than down to zero", () => {
    expect(
      describeHold("2026-08-11T12:30:00+08:00", "awaiting_payment", now),
    ).toEqual({ kind: "running", hoursLeft: 1 });
  });

  it("calls a lapsed window on an awaiting_payment booking expired", () => {
    // submit_downpayment raises 42501 past this point. The organiser cannot
    // pay, so the screen must say so rather than showing a dead countdown.
    expect(
      describeHold("2026-08-10T12:00:00+08:00", "awaiting_payment", now),
    ).toEqual({ kind: "expired" });
  });

  it.each(["pending", "awaiting_resubmission"])(
    "calls a lapsed hold on a %s booking expired too — the sweep cancels it",
    (status) => {
      // l77b: the organiser can no longer upload, and sweep_expired_holds
      // cancels both (expired_unpaid, expired_unrevised).
      expect(describeHold("2026-08-10T12:00:00+08:00", status, now)).toEqual({
        kind: "expired",
      });
    },
  );

  it("reports no hold on a booking in Tier Review, whatever the column says", () => {
    // Staff time never costs the organiser their date (ADR 0002).
    expect(
      describeHold("2026-08-10T12:00:00+08:00", "awaiting_tier_review", now),
    ).toEqual({ kind: "none" });
  });

  it("ignores a lapsed window on a booking that is not awaiting payment", () => {
    // BK-2026-000021 is awaiting_quote with a lapsed hold, and the sweep
    // deliberately spares it. Decision 8: slow quoting is a staff problem, not
    // grounds for dropping a citizen's reservation.
    expect(describeHold("2026-08-10T12:00:00+08:00", "awaiting_quote", now)).toEqual({
      kind: "none",
    });
  });

  it("treats an unparseable timestamp as no hold", () => {
    expect(describeHold("not a date", "awaiting_payment", now)).toEqual({
      kind: "none",
    });
  });

  it("ignores a still-running window on a cancelled booking", () => {
    // Regression: reject_booking leaves hold_expires_at in place, so a booking
    // cancelled BEFORE its hold lapsed kept counting down a payment window
    // nobody can pay into. Observed live on BK-2026-000037.
    expect(describeHold("2026-08-13T12:00:00+08:00", "cancelled", now)).toEqual({
      kind: "none",
    });
  });

  it.each(["confirmed", "fully_paid", "completed"])(
    "ignores a still-running window on a %s booking",
    (status) => {
      // verify_payment nulls hold_expires_at, so these should never carry one.
      // Not relying on that: the hold means nothing once the slot is committed.
      expect(describeHold("2026-08-13T12:00:00+08:00", status, now)).toEqual({
        kind: "none",
      });
    },
  );

  it.each(["pending", "awaiting_resubmission", "awaiting_quote", "payment_verification"])(
    "still counts down on a %s booking, which is genuinely holding a slot",
    (status) => {
      expect(describeHold("2026-08-13T12:00:00+08:00", status, now)).toEqual({
        kind: "running",
        hoursLeft: 48,
      });
    },
  );
});

describe("describeWait", () => {
  const now = new Date("2026-08-11T12:00:00+08:00");

  it("counts whole days once a day has passed", () => {
    expect(describeWait("2026-08-08T09:00:00+08:00", now)).toBe("3 days");
    expect(describeWait("2026-08-10T11:00:00+08:00", now)).toBe("1 day");
  });

  it("counts whole hours inside the first day", () => {
    expect(describeWait("2026-08-11T07:00:00+08:00", now)).toBe("5 hours");
    expect(describeWait("2026-08-11T10:30:00+08:00", now)).toBe("1 hour");
  });

  it("says under an hour rather than zero", () => {
    expect(describeWait("2026-08-11T11:45:00+08:00", now)).toBe("under an hour");
  });

  it("returns null with nothing to measure", () => {
    expect(describeWait(null, now)).toBeNull();
    expect(describeWait("not a date", now)).toBeNull();
  });
});
