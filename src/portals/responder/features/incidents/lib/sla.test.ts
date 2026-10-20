import { describe, expect, it } from "vitest";
import { formatDuration, relativeTime, slaProgress } from "@/portals/responder/features/incidents/lib/sla";
import { anIncident } from "@/portals/responder/features/incidents/lib/fixtures";

const NOW = new Date("2026-08-12T00:08:00.000Z");

/** One armed instant for every case, so a window is stated in hours only. */
const ARMED = "2026-08-12T00:00:00.000Z";
const hoursAfterArming = (h: number) =>
  new Date(Date.parse(ARMED) + h * 3_600_000).toISOString();

describe("relativeTime", () => {
  const minutesAgo = (n: number) =>
    new Date(NOW.getTime() - n * 60_000).toISOString();

  it("counts in minutes under an hour", () => {
    expect(relativeTime(minutesAgo(8), NOW)).toBe("8m ago");
    expect(relativeTime(minutesAgo(42), NOW)).toBe("42m ago");
  });

  it("counts in whole hours under a day", () => {
    expect(relativeTime(minutesAgo(120), NOW)).toBe("2h ago");
    expect(relativeTime(minutesAgo(295), NOW)).toBe("4h ago");
  });

  it("counts in days past twenty-four hours", () => {
    expect(relativeTime(minutesAgo(60 * 30), NOW)).toBe("1d ago");
  });

  it("collapses the first minute to 'just now'", () => {
    expect(relativeTime(minutesAgo(0), NOW)).toBe("just now");
  });
});

describe("slaProgress", () => {
  it("returns null when no clock is running", () => {
    const unverified = anIncident({
      is_verified: false,
      sla_armed_at: null,
      sla_due_at: null,
    });
    expect(slaProgress(unverified, NOW)).toBeNull();
  });

  it("returns null when the promise is due but was never armed", () => {
    // The two must never disagree — a due date with no origin is unmeasurable,
    // not a bar drawn from an assumed start.
    expect(
      slaProgress(anIncident({ sla_armed_at: null }), NOW),
    ).toBeNull();
  });

  it("measures from the armed instant, not from submission", () => {
    const incident = anIncident({
      submitted_at: "2026-08-10T00:00:00.000Z", // filed two days early
      sla_armed_at: "2026-08-12T00:00:00.000Z", // verified only now
      sla_due_at: "2026-08-12T04:00:00.000Z", // 4h critical window
    });
    const oneHourIn = new Date("2026-08-12T01:00:00.000Z");

    // From submission this would read ~1200%. From the armed instant it is 25%.
    expect(slaProgress(incident, oneHourIn)!.percentElapsed).toBe(25);
  });

  it("counts down inside the promise", () => {
    const sla = slaProgress(
      anIncident({ sla_armed_at: ARMED, sla_due_at: hoursAfterArming(4) }),
      NOW,
    )!;

    expect(sla.remaining).toBe("3h 52m");
    expect(sla.window).toBe("4h");
    expect(sla.overdue).toBe(false);
    expect(sla.percentElapsed).toBe(3);
  });

  it("counts up past a missed promise", () => {
    const sla = slaProgress(
      anIncident({ sla_armed_at: ARMED, sla_due_at: hoursAfterArming(4) }),
      new Date("2026-08-12T04:55:00.000Z"),
    )!;

    expect(sla.remaining).toBe("55m");
    expect(sla.overdue).toBe(true);
    // Deliberately past 100 — the bar clamps, the number does not.
    expect(sla.percentElapsed).toBe(123);
  });

  it("counts long windows in days, but states the promise in hours", () => {
    const sla = slaProgress(
      anIncident({ sla_armed_at: ARMED, sla_due_at: hoursAfterArming(72) }),
      new Date("2026-08-12T06:00:00.000Z"),
    )!;

    expect(sla.remaining).toBe("2d 18h");
    expect(sla.window).toBe("72h");
  });

  it("says a long-missed promise in days, not in four-digit hours", () => {
    // INC-2026-000117's demo card read "1300h 49m overdue". SCRUM-193.
    const sla = slaProgress(
      anIncident({ sla_armed_at: ARMED, sla_due_at: hoursAfterArming(4) }),
      new Date(Date.parse(hoursAfterArming(4)) + (1300 * 60 + 49) * 60_000),
    )!;

    expect(sla.overdue).toBe(true);
    expect(sla.remaining).toBe("54d 4h");
  });

  it("crosses into at_risk at half the budget and into late at the deadline", () => {
    const fourHour = anIncident({
      sla_armed_at: ARMED,
      sla_due_at: hoursAfterArming(4),
    });

    expect(slaProgress(fourHour, new Date(hoursAfterArming(1)))!.tone).toBe(
      "running",
    );
    expect(slaProgress(fourHour, new Date(hoursAfterArming(2)))!.tone).toBe(
      "at_risk",
    );
    expect(slaProgress(fourHour, new Date(hoursAfterArming(4)))!.tone).toBe(
      "late",
    );
  });
});

describe("formatDuration", () => {
  const MIN = 60_000;
  const H = 60 * MIN;
  const D = 24 * H;

  it("counts in minutes under an hour", () => {
    expect(formatDuration(55 * MIN)).toBe("55m");
    expect(formatDuration(0)).toBe("0m");
  });

  it("counts in hours and minutes under a day, dropping minutes on the hour", () => {
    expect(formatDuration(3 * H + 52 * MIN)).toBe("3h 52m");
    expect(formatDuration(4 * H)).toBe("4h");
    expect(formatDuration(23 * H + 59 * MIN)).toBe("23h 59m");
  });

  /**
   * Past a day the minutes are noise and the hours stop being readable —
   * nobody holds "1300h" in their head as eight weeks. Days and hours, with
   * the hours dropped once they land on the day, as minutes are on the hour.
   */
  it("counts in days and hours from a day on", () => {
    expect(formatDuration(D)).toBe("1d");
    expect(formatDuration(D + 30 * MIN)).toBe("1d");
    expect(formatDuration(D + 5 * H + 59 * MIN)).toBe("1d 5h");
    expect(formatDuration(54 * D + 4 * H + 49 * MIN)).toBe("54d 4h");
  });
});
