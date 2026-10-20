import { describe, expect, it } from "vitest";
import { toTiles } from "./tiles";

const metrics = {
  slaCompliancePct: 88,
  slaCompliancePctPrev: 85,
  atRiskNow: 12,
  atRiskPrev: null,
  openBacklog: 47,
  openBacklogPrev: 41,
  bookings7d: 9,
  bookings7dPrev: 9,
};

describe("toTiles", () => {
  it("builds four tiles in a fixed order", () => {
    expect(toTiles(metrics).map((t) => t.label)).toEqual([
      "SLA Compliance",
      "At-Risk Now",
      "Open Backlog",
      "Bookings (7d)",
    ]);
  });

  it("labels a rise and marks the direction up", () => {
    const [sla] = toTiles(metrics);
    expect(sla.value).toBe("88%");
    expect(sla.deltaLabel).toBe("3% vs prev");
    expect(sla.direction).toBe("up");
  });

  it("omits the delta entirely when the prior period is null", () => {
    const [, atRisk] = toTiles(metrics);
    expect(atRisk.value).toBe("12");
    expect(atRisk.deltaLabel).toBeUndefined();
    expect(atRisk.direction).toBe("flat");
  });

  it("reports flat when the two periods match", () => {
    const [, , , bookings] = toTiles(metrics);
    expect(bookings.deltaLabel).toBe("0 vs prev");
    expect(bookings.direction).toBe("flat");
  });

  it("renders an em dash when a metric itself is null", () => {
    const [sla] = toTiles({ ...metrics, slaCompliancePct: null });
    expect(sla.value).toBe("—");
    expect(sla.deltaLabel).toBeUndefined();
  });
});
