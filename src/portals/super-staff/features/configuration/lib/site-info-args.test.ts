import { describe, expect, it } from "vitest";
import { toSiteInfoArgs, toSiteInfoEntryArgs } from "./site-info-args";

describe("toSiteInfoArgs", () => {
  it("builds exactly what save_site_info declares", () => {
    expect(
      toSiteInfoArgs({
        trunkline: "(042) 788-2298",
        officeHours: "Monday to Friday, 8:00 AM – 5:00 PM",
      }),
    ).toEqual({
      p_trunkline: "(042) 788-2298",
      p_office_hours: "Monday to Friday, 8:00 AM – 5:00 PM",
    });
  });
});

describe("toSiteInfoEntryArgs", () => {
  it("builds exactly what update_site_info_entry declares", () => {
    expect(
      toSiteInfoEntryArgs({
        id: "44444444-4444-4444-4444-444444444444",
        kind: "emergency_hotline",
        label: "PDRRMO Emergency",
        value: "(042) 710-3933",
        sortOrder: 20,
        isActive: true,
      }),
    ).toEqual({
      p_id: "44444444-4444-4444-4444-444444444444",
      p_label: "PDRRMO Emergency",
      p_value: "(042) 710-3933",
      p_sort_order: 20,
      p_is_active: true,
    });
  });

  it("never sends kind — an entry does not move between lists", () => {
    const args = toSiteInfoEntryArgs({
      id: "44444444-4444-4444-4444-444444444444",
      kind: "emergency_hotline",
      label: "x",
      value: "y",
      sortOrder: 1,
      isActive: true,
    });
    expect(args).not.toHaveProperty("p_kind");
  });
});
