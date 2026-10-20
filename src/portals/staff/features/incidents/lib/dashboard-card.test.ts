import { describe, expect, it } from "vitest";
import { buildIncidentCard, type IncidentPreviewRow } from "./dashboard-card";

const NOW = new Date("2026-08-07T12:00:00+08:00");

function row(over: Partial<IncidentPreviewRow> = {}): IncidentPreviewRow {
  return {
    id: "i1",
    type_label: "Flooding",
    barangay_name: "Cotta",
    incident_level: "critical",
    is_verified: true,
    status: "in_pool",
    sla_armed_at: "2026-08-07T08:00:00+08:00",
    sla_due_at: "2026-08-07T16:00:00+08:00",
    resolved_at: null,
    closed_at: null,
    ...over,
  };
}

describe("buildIncidentCard", () => {
  it("passes the totals through rather than counting the preview", () => {
    // The rows are only the first three. Counting them would silently cap the
    // figures at the preview limit.
    const card = buildIncidentCard({
      awaitingTriage: 6,
      critical: 9,
      high: 14,
      slaBreaches: 4,
      rows: [row()],
      now: NOW,
      threshold: 0.5,
    });
    // Awaiting Triage is the module's backlog as well as its arrival set, so
    // it is the figure an officer opening the dashboard most needs.
    expect(card.awaitingTriage).toBe(6);
    expect(card.critical).toBe(9);
    expect(card.high).toBe(14);
    expect(card.slaBreaches).toBe(4);
  });

  it("labels a preview row by type and barangay", () => {
    const card = buildIncidentCard({
      awaitingTriage: 0, critical: 1, high: 0, slaBreaches: 0, rows: [row()], now: NOW, threshold: 0.5,
    });
    expect(card.preview[0].label).toBe("Flooding, Brgy. Cotta");
  });

  it("caps the preview at three", () => {
    const card = buildIncidentCard({
      awaitingTriage: 0, critical: 0, high: 0, slaBreaches: 0,
      rows: [row(), row({ id: "b" }), row({ id: "c" }), row({ id: "d" })],
      now: NOW, threshold: 0.5,
    });
    expect(card.preview).toHaveLength(3);
  });

  it("tags a breached row critical and an at-risk row warning", () => {
    const breached = buildIncidentCard({
      awaitingTriage: 0, critical: 0, high: 0, slaBreaches: 1,
      rows: [row({ sla_due_at: "2026-08-07T09:00:00+08:00" })],
      now: NOW, threshold: 0.5,
    });
    expect(breached.preview[0].tag).toEqual({ text: "breached", tone: "critical" });

    const atRisk = buildIncidentCard({
      awaitingTriage: 0, critical: 0, high: 0, slaBreaches: 0,
      rows: [row({ sla_due_at: "2026-08-07T13:00:00+08:00" })],
      now: NOW, threshold: 0.5,
    });
    expect(atRisk.preview[0].tag.tone).toBe("warning");
  });

  it("tags an unverified row by its level, not its clock", () => {
    // 13 of 25 sandbox incidents. "SLA not armed" on every one of them would
    // say nothing; the level is the only signal that distinguishes them.
    const card = buildIncidentCard({
      awaitingTriage: 0, critical: 1, high: 0, slaBreaches: 0,
      rows: [row({ is_verified: false, sla_due_at: null, sla_armed_at: null })],
      now: NOW, threshold: 0.5,
    });
    expect(card.preview[0].tag).toEqual({ text: "critical", tone: "critical" });
  });
});
