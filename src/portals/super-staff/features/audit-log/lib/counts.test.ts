import { describe, expect, it } from "vitest";
import type { AuditArea, AuditEntry } from "../types";
import { computeAreaCounts } from "./counts";

const mk = (area: AuditArea): AuditEntry => ({
  id: `aud-${area}-${Math.random()}`,
  timestamp: "2026-07-15T09:00:00+08:00",
  actor: "Maria Santos",
  area,
  change: "Something changed",
  target: "Target",
  targetId: null,
  sessionId: null,
  ipAddress: null,
  userAgent: null,
  references: [],
});

describe("computeAreaCounts", () => {
  it("counts each area and the total", () => {
    const rows = [
      mk("accounts"),
      mk("configuration"),
      mk("configuration"),
      mk("content"),
      mk("auth"),
      mk("auth"),
    ];
    const c = computeAreaCounts(rows);
    expect(c.all).toBe(6);
    expect(c.accounts).toBe(1);
    expect(c.configuration).toBe(2);
    expect(c.content).toBe(1);
    expect(c.auth).toBe(2);
  });

  it("reports zeros for an empty log", () => {
    const c = computeAreaCounts([]);
    expect(c).toEqual({
      accounts: 0,
      configuration: 0,
      catalogs: 0,
      content: 0,
      pii_access: 0,
      calendar: 0,
      auth: 0,
      all: 0,
    });
  });

  it("counts an unknown area toward the total without crashing", () => {
    const counts = computeAreaCounts([
      {
        id: "1",
        timestamp: "2026-08-01T00:00:00+08:00",
        actor: "A",
        area: "future_area" as never,
        change: "x",
        target: "y",
        targetId: null,
        sessionId: null,
        ipAddress: null,
        userAgent: null,
        references: [],
      },
    ]);
    expect(counts.all).toBe(1);
    expect(counts.accounts).toBe(0);
  });
});
