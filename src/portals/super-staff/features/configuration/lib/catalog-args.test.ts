import { describe, expect, it } from "vitest";
import {
  toBookingClassificationArgs,
  toBookingEventTypeArgs,
  toBookingVenueArgs,
  toDepartmentArgs,
  toIncidentTypeArgs,
  toPostCategoryArgs,
  toYellowCardDocumentTypeArgs,
} from "./catalog-args";
import type { IncidentType } from "./catalog-types";

describe("toDepartmentArgs", () => {
  it("builds exactly what update_department declares", () => {
    expect(
      toDepartmentArgs({ code: "engineering", label: "Engineering", sortOrder: 1, isActive: true }),
    ).toEqual({
      p_code: "engineering",
      p_label: "Engineering",
      p_sort_order: 1,
      p_is_active: true,
    });
  });
});

describe("toIncidentTypeArgs", () => {
  // base_level is the DATABASE enum, which is lowercase. `IncidentLevel` in
  // ../types is the capitalised vocabulary that keys slaHours — a different
  // thing that merely looks alike.
  const row: IncidentType = {
    code: "pothole",
    label: "Pothole",
    baseLevel: "high",
    categoryCode: "roads",
    defaultDepartmentCode: "engineering",
    sortOrder: 4,
    isActive: true,
  };

  it("builds exactly what update_incident_type declares", () => {
    expect(toIncidentTypeArgs(row)).toEqual({
      p_code: "pothole",
      p_label: "Pothole",
      p_default_department_code: "engineering",
      p_sort_order: 4,
      p_is_active: true,
    });
  });

  it("never sends base_level — it is a public response-time promise the LGU owns", () => {
    expect(toIncidentTypeArgs(row)).not.toHaveProperty("p_base_level");
  });

  it("never sends category_code — migration-owned taxonomy", () => {
    expect(toIncidentTypeArgs(row)).not.toHaveProperty("p_category_code");
  });
});

describe("toBookingVenueArgs", () => {
  it("sends capacity as text and never sends is_hourly", () => {
    const args = toBookingVenueArgs({
      code: "atrium",
      label: "Atrium",
      capacityLabel: "Up to 500 pax",
      isHourly: false,
      sortOrder: 2,
      isActive: true,
    });
    expect(args).toEqual({
      p_code: "atrium",
      p_label: "Atrium",
      p_capacity_label: "Up to 500 pax",
      p_sort_order: 2,
      p_is_active: true,
    });
    expect(args).not.toHaveProperty("p_is_hourly");
  });
});

describe("toBookingClassificationArgs", () => {
  it("sends only eligibility and order — the table has no is_active column", () => {
    const args = toBookingClassificationArgs({
      code: "ngo",
      label: "NGO",
      isDiscountEligible: true,
      sortOrder: 3,
    });
    expect(args).toEqual({
      p_code: "ngo",
      p_is_discount_eligible: true,
      p_sort_order: 3,
    });
    expect(args).not.toHaveProperty("p_label");
    expect(args).not.toHaveProperty("p_is_active");
  });
});

describe("toPostCategoryArgs", () => {
  it("builds exactly what update_post_category declares", () => {
    expect(
      toPostCategoryArgs({
        code: "advisory",
        label: "Advisory",
        colorHex: "#0B5FFF",
        sortOrder: 1,
        isActive: true,
      }),
    ).toEqual({
      p_code: "advisory",
      p_label: "Advisory",
      p_color_hex: "#0B5FFF",
      p_sort_order: 1,
      p_is_active: true,
    });
  });
});

describe("toBookingEventTypeArgs", () => {
  it("builds exactly what update_booking_event_type declares", () => {
    expect(
      toBookingEventTypeArgs({
        code: "wedding",
        label: "Wedding",
        sortOrder: 5,
        isActive: true,
      }),
    ).toEqual({
      p_code: "wedding",
      p_label: "Wedding",
      p_sort_order: 5,
      p_is_active: true,
    });
  });
});

describe("toYellowCardDocumentTypeArgs", () => {
  it("builds exactly what update_yellow_card_document_type declares", () => {
    expect(
      toYellowCardDocumentTypeArgs({
        code: "barangay_clearance",
        label: "Barangay Clearance",
        isRequired: true,
        sortOrder: 2,
        isActive: false,
      }),
    ).toEqual({
      p_code: "barangay_clearance",
      p_label: "Barangay Clearance",
      p_is_required: true,
      p_sort_order: 2,
      p_is_active: false,
    });
  });

  it("carries an inactive row through rather than dropping it — deactivation is the only retirement", () => {
    const args = toYellowCardDocumentTypeArgs({
      code: "old_form",
      label: "Old Form",
      isRequired: false,
      sortOrder: 9,
      isActive: false,
    });
    expect(args.p_is_active).toBe(false);
  });
});
