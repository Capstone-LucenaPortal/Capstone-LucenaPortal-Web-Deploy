import { describe, expect, it } from "vitest";
import { historyStats } from "@/portals/responder/features/incidents/lib/history-stats";
import { aHistoryRow } from "@/portals/responder/features/incidents/lib/fixtures";

const NOW = new Date("2026-08-12T12:00:00.000Z");

const onTime = aHistoryRow({
  id: "on-time",
  sla_due_at: "2026-08-12T04:00:00.000Z",
  resolved_at: "2026-08-12T02:00:00.000Z",
});

const late = aHistoryRow({
  id: "late",
  sla_due_at: "2026-08-12T04:00:00.000Z",
  resolved_at: "2026-08-12T09:00:00.000Z",
});

const unverified = aHistoryRow({
  id: "unverified",
  is_verified: false,
  sla_armed_at: null,
  sla_due_at: null,
  resolved_at: "2026-08-12T03:00:00.000Z",
});

const lastMonth = aHistoryRow({
  id: "last-month",
  sla_due_at: "2026-07-20T04:00:00.000Z",
  resolved_at: "2026-07-20T02:00:00.000Z",
  my_last_outcome_at: "2026-07-20T02:00:00.000Z",
});

describe("historyStats", () => {
  it("gives null rather than 0% on an account with no history", () => {
    const stats = historyStats([], NOW);
    expect(stats.slaMetPercent).toBeNull();
    expect(stats.reopenedCount).toBe(0);
  });

  it("counts one on-time and one late resolution as 50%", () => {
    expect(historyStats([onTime, late], NOW).slaMetPercent).toBe(50);
  });

  it("excludes an unverified ticket rather than counting it as a failure", () => {
    // Story 51: no clock ever ran on it, so it cannot count against anyone.
    // Were it counted as a miss this would read 50 instead of 100.
    expect(historyStats([onTime, unverified], NOW).slaMetPercent).toBe(100);
  });

  it("excludes work finished before this month", () => {
    // `late` is the only measurable row inside August.
    expect(historyStats([late, lastMonth], NOW).slaMetPercent).toBe(0);
  });

  it("gives null when the only rows are outside the month or unmeasurable", () => {
    expect(historyStats([lastMonth, unverified], NOW).slaMetPercent).toBeNull();
  });

  it("does not count a released or rejected ticket in the rate", () => {
    const released = aHistoryRow({
      id: "released",
      my_last_outcome: "released",
      resolved_at: null,
    });
    expect(historyStats([onTime, released], NOW).slaMetPercent).toBe(100);
  });

  it("sums reopen counts across every row, whatever the outcome", () => {
    const reopened = aHistoryRow({ id: "reopened", reopened_count: 2 });
    const alsoReopened = aHistoryRow({ id: "also", reopened_count: 1 });
    expect(historyStats([onTime, reopened, alsoReopened], NOW).reopenedCount).toBe(
      3,
    );
  });
});
