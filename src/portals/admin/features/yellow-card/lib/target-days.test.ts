import { yellowCardTargetDays } from "@/portals/admin/features/yellow-card/lib/target-days";

// sla_target_hours is the configured days × the database's 9-hour working day
// (l70a D5), so 3 days is 27 and 2 days is 18. 48 is the legacy calendar-hours
// value applications filed before l70a keep.
function rows(...hours: (number | null)[]) {
  return hours.map((sla_target_hours) => ({ sla_target_hours }));
}

describe("yellowCardTargetDays", () => {
  it("names the configured days when every row was scored against them", () => {
    expect(yellowCardTargetDays(rows(27, 27, 27), 3)).toBe(3);
    expect(yellowCardTargetDays(rows(18, 18), 2)).toBe(2);
  });

  it("names no days when the rows carry two targets", () => {
    expect(yellowCardTargetDays(rows(27, 18), 3)).toBeNull();
  });

  it("names no days when every row is on a target that is no longer configured", () => {
    expect(yellowCardTargetDays(rows(27, 27), 2)).toBeNull();
  });

  it("names no days when a row carries the legacy 48 calendar hours", () => {
    expect(yellowCardTargetDays(rows(27, 48), 3)).toBeNull();
    expect(yellowCardTargetDays(rows(48), 3)).toBeNull();
  });

  it("names no days when a row has no target", () => {
    expect(yellowCardTargetDays(rows(27, null), 3)).toBeNull();
  });

  it("names no days when the config could not be read", () => {
    expect(yellowCardTargetDays(rows(27, 27), null)).toBeNull();
    expect(yellowCardTargetDays([], null)).toBeNull();
  });

  it("names the configured days for an empty set: that is the target new filings get", () => {
    expect(yellowCardTargetDays([], 3)).toBe(3);
  });
});
