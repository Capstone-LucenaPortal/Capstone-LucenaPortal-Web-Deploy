import { describe, expect, it } from "vitest";
import { healthyLine } from "./summary";

const summary = { samples7d: 2016, healthyPct7d: 93.3 };

describe("healthyLine", () => {
  it("states the 7-day figure as a share of samples", () => {
    expect(healthyLine(summary)).toBe("System healthy 93.3% of samples (last 7 days)");
  });

  // App reachability is not sampled, so the figure must never claim uptime.
  it("never calls the figure uptime", () => {
    expect(healthyLine(summary).toLowerCase()).not.toContain("uptime");
  });

  it("says there are no samples yet right after deploy, rather than 0%", () => {
    expect(healthyLine({ ...summary, samples7d: 0, healthyPct7d: null })).toBe(
      "System healthy: no samples yet (last 7 days)",
    );
  });
});
