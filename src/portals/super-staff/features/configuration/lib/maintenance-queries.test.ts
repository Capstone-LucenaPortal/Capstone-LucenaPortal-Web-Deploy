import { describe, expect, it } from "vitest";
import { toMaintenancePeriods, toSpaceStates } from "./maintenance-queries";

const period = (over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  space_code: "atrium",
  space_label: "Atrium",
  first_day: "2026-12-01",
  last_day: "2026-12-03",
  reason: "Aircon repair",
  is_active: true,
  ...over,
});

describe("toMaintenancePeriods", () => {
  it("keeps retired periods — the view is unfiltered on purpose", () => {
    expect(
      toMaintenancePeriods([
        period(),
        period({
          id: "22222222-2222-2222-2222-222222222222",
          space_code: "arena",
          space_label: "Arena",
          first_day: "2026-11-10",
          last_day: "2026-11-12",
          reason: "Repainting",
          is_active: false,
        }),
      ]),
    ).toEqual([
      {
        id: "11111111-1111-1111-1111-111111111111",
        spaceCode: "atrium",
        spaceLabel: "Atrium",
        firstDay: "2026-12-01",
        lastDay: "2026-12-03",
        reason: "Aircon repair",
        isActive: true,
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        spaceCode: "arena",
        spaceLabel: "Arena",
        firstDay: "2026-11-10",
        lastDay: "2026-11-12",
        reason: "Repainting",
        isActive: false,
      },
    ]);
  });

  it("drops a row that cannot be identified or written back", () => {
    expect(
      toMaintenancePeriods([
        period({ id: null }),
        period({ space_code: null }),
        period({ first_day: null }),
        period({ last_day: null }),
      ]),
    ).toEqual([]);
  });

  it("falls back to the code when the label is missing", () => {
    expect(toMaintenancePeriods([period({ space_label: null })])[0].spaceLabel).toBe("atrium");
  });

  it("refuses to render a null is_active as a value", () => {
    expect(() => toMaintenancePeriods([period({ is_active: null })])).toThrow(/is_active/);
  });
});

const state = (over: Record<string, unknown> = {}) => ({
  space_code: "arena",
  space_label: "Arena",
  state: "available",
  maintenance_period_id: null,
  maintenance_reason: null,
  maintenance_last_day: null,
  ...over,
});

describe("toSpaceStates", () => {
  it("reads Available and Reserved with no maintenance details", () => {
    expect(toSpaceStates([state(), state({ space_code: "atrium", space_label: "Atrium", state: "reserved" })])).toEqual([
      { spaceCode: "arena", spaceLabel: "Arena", state: "available", maintenanceReason: null, maintenanceLastDay: null },
      { spaceCode: "atrium", spaceLabel: "Atrium", state: "reserved", maintenanceReason: null, maintenanceLastDay: null },
    ]);
  });

  it("carries the covering period's reason and last day while Under Maintenance", () => {
    expect(
      toSpaceStates([
        state({
          state: "under_maintenance",
          maintenance_period_id: "11111111-1111-1111-1111-111111111111",
          maintenance_reason: "Repainting",
          maintenance_last_day: "2026-12-05",
        }),
      ]),
    ).toEqual([
      {
        spaceCode: "arena",
        spaceLabel: "Arena",
        state: "under_maintenance",
        maintenanceReason: "Repainting",
        maintenanceLastDay: "2026-12-05",
      },
    ]);
  });

  it("drops a row with no code or a state it does not know", () => {
    expect(toSpaceStates([state({ space_code: null }), state({ state: null }), state({ state: "closed" })])).toEqual([]);
  });
});
