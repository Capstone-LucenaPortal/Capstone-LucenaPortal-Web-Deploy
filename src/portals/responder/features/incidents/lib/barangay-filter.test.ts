import { describe, expect, it } from "vitest";
import {
  barangayCounts,
  filterByBarangay,
  poolHref,
  readBarangay,
} from "@/portals/responder/features/incidents/lib/barangay-filter";
import { anIncident } from "@/portals/responder/features/incidents/lib/fixtures";

const pool = [
  anIncident({ id: "a", barangay_name: "Ibabang Iyam" }),
  anIncident({ id: "b", barangay_name: "Cotta" }),
  anIncident({ id: "c", barangay_name: "Ibabang Iyam" }),
  anIncident({ id: "d", barangay_name: "Gulang-Gulang" }),
  anIncident({ id: "e", barangay_name: "Cotta" }),
  anIncident({ id: "f", barangay_name: "Ibabang Iyam" }),
];

describe("readBarangay", () => {
  it("reads no param, an empty one or a blank one as no filter", () => {
    expect(readBarangay(undefined)).toBeNull();
    expect(readBarangay("")).toBeNull();
    expect(readBarangay("   ")).toBeNull();
  });

  it("keeps a chosen barangay, trimmed", () => {
    expect(readBarangay("Ibabang Iyam")).toBe("Ibabang Iyam");
    expect(readBarangay(" Cotta ")).toBe("Cotta");
  });

  it("reads a repeated ?brgy= as its first value rather than crashing", () => {
    // Next hands a repeated key to the page as an array.
    expect(readBarangay(["Cotta", "Dalahican"])).toBe("Cotta");
    expect(readBarangay([])).toBeNull();
  });
});

describe("filterByBarangay", () => {
  it("returns only that barangay's reports", () => {
    expect(filterByBarangay(pool, "Cotta").map((i) => i.id)).toEqual(["b", "e"]);
  });

  it("returns the whole pool when nothing is chosen", () => {
    expect(filterByBarangay(pool, null)).toEqual(pool);
  });

  it("returns nothing for a barangay no report is in, rather than falling back", () => {
    expect(filterByBarangay(pool, "Dalahican")).toEqual([]);
  });
});

describe("barangayCounts", () => {
  it("lists each barangay in the pool once, alphabetically, with its count", () => {
    expect(barangayCounts(pool)).toEqual([
      { name: "Cotta", count: 2 },
      { name: "Gulang-Gulang", count: 1 },
      { name: "Ibabang Iyam", count: 3 },
    ]);
  });

  it("skips a report with no barangay rather than offering a blank row", () => {
    // responder_incidents inner-joins barangays, so this is a guard, not a case.
    expect(
      barangayCounts([anIncident({ barangay_name: null }), ...pool]).map(
        (b) => b.name,
      ),
    ).toEqual(["Cotta", "Gulang-Gulang", "Ibabang Iyam"]);
  });
});

describe("poolHref", () => {
  it("is the bare pool with nothing to carry", () => {
    expect(poolHref({})).toBe("/responder/pool");
    expect(poolHref({ report: null, brgy: null })).toBe("/responder/pool");
  });

  it("carries the report and the barangay, encoded", () => {
    expect(poolHref({ report: "inc-1", brgy: "Ibabang Iyam" })).toBe(
      "/responder/pool?report=inc-1&brgy=Ibabang+Iyam",
    );
  });
});

describe("barangayCounts against the pool", () => {
  it("adds up to the size of the pool", () => {
    const sum = barangayCounts(pool).reduce((total, b) => total + b.count, 0);
    expect(sum).toBe(6);
  });
});
