import { describe, expect, it } from "vitest";
import { arrivalLabel, newArrivals } from "./queue-activity";

describe("newArrivals", () => {
  it("reports nothing when the count has not moved", () => {
    expect(newArrivals(6, 6)).toBe(0);
  });

  it("reports the difference when work arrives", () => {
    expect(newArrivals(6, 7)).toBe(1);
    expect(newArrivals(6, 9)).toBe(3);
  });

  it("clamps at zero when colleagues clear the backlog faster than it fills", () => {
    // Baseline 6, two decided by someone else, nothing new arrived. There is
    // less work than at load, not negative new work.
    expect(newArrivals(6, 4)).toBe(0);
  });

  it("handles an empty queue at load, which is the common case late in the day", () => {
    expect(newArrivals(0, 0)).toBe(0);
    expect(newArrivals(0, 2)).toBe(2);
  });
});

describe("arrivalLabel", () => {
  it("is null at zero so the badge renders nothing rather than '0 new'", () => {
    expect(arrivalLabel(0, "new")).toBeNull();
  });

  it("stays singular for one", () => {
    expect(arrivalLabel(1, "new")).toBe("1 new");
  });

  it("uses the same wording for many, because the noun does not pluralise", () => {
    expect(arrivalLabel(4, "new")).toBe("4 new");
  });

  it("takes the noun from the caller, so a module can say something other than 'new'", () => {
    // Booking's badge sits beside a whole-view backlog level for the same set,
    // so "3 new" there would read as a second, contradictory total.
    expect(arrivalLabel(3, "more waiting")).toBe("3 more waiting");
  });

  it("says nothing at zero whatever the noun", () => {
    expect(arrivalLabel(0, "more waiting")).toBeNull();
  });
});
