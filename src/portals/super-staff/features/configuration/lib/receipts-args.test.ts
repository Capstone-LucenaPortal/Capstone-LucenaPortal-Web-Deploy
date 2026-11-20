import { describe, expect, it } from "vitest";
import { toAgencyIdentityArgs, toOfficerArgs } from "./receipts-args";

describe("toOfficerArgs", () => {
  it("builds exactly what update_officer_of_record declares, every field trimmed", () => {
    expect(
      toOfficerArgs({
        service: "yellow_card",
        fullName: "  Maria Santos ",
        unit: " City Health Office",
        designation: "Officer-in-Charge  ",
        isPlaceholder: true,
      }),
    ).toEqual({
      p_service: "yellow_card",
      p_full_name: "Maria Santos",
      p_unit: "City Health Office",
      p_designation: "Officer-in-Charge",
    });
  });

  it("never sends is_placeholder — the RPC always writes false itself", () => {
    const args = toOfficerArgs({
      service: "booking",
      fullName: "a",
      unit: "b",
      designation: "c",
      isPlaceholder: false,
    });
    expect(args).not.toHaveProperty("p_is_placeholder");
  });
});

describe("toAgencyIdentityArgs", () => {
  it("builds exactly what save_agency_identity declares, both fields trimmed", () => {
    expect(
      toAgencyIdentityArgs({
        agencyName: " City Government of Lucena ",
        sealPath: "agency/seal-1763600000000.png",
      }),
    ).toEqual({
      p_agency_name: "City Government of Lucena",
      p_seal_path: "agency/seal-1763600000000.png",
    });
  });
});
