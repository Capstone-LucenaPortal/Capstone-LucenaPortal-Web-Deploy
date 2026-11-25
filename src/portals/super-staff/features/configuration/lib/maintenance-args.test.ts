import { describe, expect, it } from "vitest";
import {
  toAddMaintenancePeriodArgs,
  toUpdateMaintenancePeriodArgs,
} from "./maintenance-args";

// Both maintenance RPCs have NO argument defaults (l125b §2.3): an omitted
// name is a PGRST202 404. Each builder must produce exactly the declared
// argument set — asserted with toEqual, which fails on a missing key.

describe("toAddMaintenancePeriodArgs", () => {
  it("builds exactly what add_maintenance_period declares", () => {
    expect(
      toAddMaintenancePeriodArgs({
        spaceCode: "atrium",
        firstDay: "2026-12-01",
        lastDay: "2026-12-03",
        reason: "Aircon repair",
      }),
    ).toEqual({
      p_space_code: "atrium",
      p_first_day: "2026-12-01",
      p_last_day: "2026-12-03",
      p_reason: "Aircon repair",
    });
  });
});

describe("toUpdateMaintenancePeriodArgs", () => {
  const period = {
    id: "11111111-1111-1111-1111-111111111111",
    spaceCode: "arena",
    spaceLabel: "Arena",
    firstDay: "2026-12-01",
    lastDay: "2026-12-05",
    reason: "Repainting",
    isActive: false,
  };

  it("builds exactly what update_maintenance_period declares", () => {
    expect(toUpdateMaintenancePeriodArgs(period)).toEqual({
      p_id: "11111111-1111-1111-1111-111111111111",
      p_last_day: "2026-12-05",
      p_reason: "Repainting",
      p_is_active: false,
    });
  });

  it("never sends the first day — a wrong start is retired and re-added", () => {
    expect(toUpdateMaintenancePeriodArgs(period)).not.toHaveProperty("p_first_day");
  });
});
