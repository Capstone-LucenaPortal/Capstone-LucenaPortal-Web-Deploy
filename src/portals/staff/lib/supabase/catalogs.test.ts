import { describe, expect, it } from "vitest";
import { toLabelMap } from "./catalogs";

describe("toLabelMap", () => {
  it("builds a code → label map", () => {
    expect(
      toLabelMap([
        { code: "male", label: "Male" },
        { code: "female", label: "Female" },
      ]),
    ).toEqual({ male: "Male", female: "Female" });
  });

  it("returns an empty map for null rows", () => {
    expect(toLabelMap(null)).toEqual({});
  });

  it("skips rows with a null code or a null label rather than corrupting the map", () => {
    expect(
      toLabelMap([
        { code: null, label: "Orphan" },
        { code: "single", label: null },
        { code: "married", label: "Married" },
      ]),
    ).toEqual({ married: "Married" });
  });
});
