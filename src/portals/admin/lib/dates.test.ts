// src/portals/admin/lib/dates.test.ts
import { customRangeError, formatManilaRangeLabel } from "@/portals/admin/lib/dates";
import { filterByDateRange, formatManilaDate, presetDateRange } from "@/portals/admin/lib/dates";
import { vi } from "vitest";

// presetDateRange must anchor "today" (and every range boundary derived
// from it) to the Asia/Manila calendar day, not whatever day the host's
// local Date getters report. This codebase has hit this exact bug class
// twice before and fixed it the same way both times in the DB repo — l24's
// public_venue_availability, and l31's submit_booking / submit_downpayment
// (migration 20260729132112_l31_booking_manila_timezone_fix.sql), whose
// header explains that a UTC session zone shifts everything eight hours
// and defeats the intended comparison. This does the TypeScript-side
// equivalent: derive the calendar day via Intl.DateTimeFormat with
// timeZone: "Asia/Manila" rather than from the browser's local zone.
describe("presetDateRange — Manila-anchored bounds", () => {
  // Pin the process timezone so this suite's outcome does not depend on
  // the machine running it (CI, a developer's laptop, etc. may all differ).
  // presetDateRange itself no longer reads the host zone at all — it goes
  // through Intl with an explicit "Asia/Manila" — but pinning TZ here keeps
  // the suite deterministic regardless, and lets the boundary test below
  // state precisely what the old browser-local implementation used to
  // produce for the same instant.
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "UTC";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves concrete, hardcoded bounds for Today, Week, Month and Annual", () => {
    // 2026-04-15T05:00:00Z = 2026-04-15 13:00 Manila (a Wednesday) — well
    // clear of the UTC/Manila boundary, so this pins the ordinary case
    // against literal expected values (not the helper's own output).
    vi.useFakeTimers().setSystemTime(new Date("2026-04-15T05:00:00Z"));

    expect(presetDateRange("Today")).toEqual({ from: "2026-04-15", to: "2026-04-15" });
    // Monday-start week: 2026-04-15 is a Wednesday, so the week began Mon 2026-04-13.
    expect(presetDateRange("Week")).toEqual({ from: "2026-04-13", to: "2026-04-15" });
    expect(presetDateRange("Month")).toEqual({ from: "2026-04-01", to: "2026-04-15" });
    expect(presetDateRange("Annual")).toEqual({ from: "2026-01-01", to: "2026-04-15" });
  });

  // The boundary case the old browser-local/UTC logic gets wrong: any
  // instant between 16:00 and 23:59 UTC is already "tomorrow" in Manila.
  // Empirically confirmed against Sandbox: application YC-2026-000061 was
  // submitted 2026-07-30 16:23:45 UTC, i.e. 2026-07-31 00:23 Manila. An
  // admin selecting "Today" on Manila calendar day 2026-07-31 must get
  // bounds naming 2026-07-31 — the old logic named 2026-07-30 (the UTC
  // day) instead, which excluded this exact application from the export.
  it("names the Manila day, not the UTC day, for an instant in the 16:00-23:59 UTC boundary window", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-07-30T16:23:45Z"));

    const result = presetDateRange("Today");

    expect(result).toEqual({ from: "2026-07-31", to: "2026-07-31" });
    // Pin against regressing back to the UTC day this bug used to emit.
    expect(result.from).not.toBe("2026-07-30");
  });
});

type Row = { id: string; submitted_at: string | null };
const rows: Row[] = [
  { id: "before", submitted_at: "2026-07-30T16:00:00Z" }, // 2026-07-31 00:00 Manila
  { id: "inside", submitted_at: "2026-08-02T04:00:00Z" }, // 2026-08-02 12:00 Manila
  { id: "after",  submitted_at: "2026-08-09T00:00:00Z" },
  { id: "nulldate", submitted_at: null },
];
const get = (r: Row) => r.submitted_at;

describe("filterByDateRange", () => {
  it("returns every row when the range is null", () => {
    expect(filterByDateRange(rows, get, null).map((r) => r.id)).toEqual(
      ["before", "inside", "after", "nulldate"],
    );
  });

  it("includes both boundary days in Manila time", () => {
    // A row at 00:00 Manila on the from-day must be INCLUDED. Anchoring to UTC
    // would drop it — that is the l24/l31 bug class this guards.
    const out = filterByDateRange(rows, get, { from: "2026-07-31", to: "2026-08-02" });
    expect(out.map((r) => r.id)).toEqual(["before", "inside"]);
  });

  it("excludes rows outside the range", () => {
    const out = filterByDateRange(rows, get, { from: "2026-08-01", to: "2026-08-03" });
    expect(out.map((r) => r.id)).toEqual(["inside"]);
  });

  it("drops rows with no date rather than throwing", () => {
    const out = filterByDateRange(rows, get, { from: "2026-08-01", to: "2026-08-03" });
    expect(out.map((r) => r.id)).not.toContain("nulldate");
  });
});

// formatManilaDate is the render-layer counterpart to filterByDateRange/
// presetDateRange above: filtering and bucketing are rigorously
// Manila-anchored, but every on-screen date column (Yellow Card's Submitted,
// Incident Reports' Submitted, Convention Center's Event date, and the CSV
// exports that reuse the same formatter) used to build its own
// `toLocaleDateString("en-PH", ...)` call with no `timeZone` option, reading
// the HOST's local zone instead — the fourth recurrence of the l24/l31 bug
// class, this time in the render layer. A row filterByDateRange correctly
// places in August must not then render as "Jul 31" on a host whose local
// zone lags Manila.
describe("formatManilaDate", () => {
  it("returns an em dash for a null value", () => {
    expect(formatManilaDate(null)).toBe("—");
  });

  it("returns the raw string for a value that fails to parse", () => {
    expect(formatManilaDate("not-a-date")).toBe("not-a-date");
  });

  // The boundary case the old host-local logic gets wrong: an instant
  // between 16:00 and 23:59 UTC is already "tomorrow" in Manila. This is the
  // exact instant class presetDateRange's own boundary test above pins
  // (2026-07-30T16:23:45Z), one day later so it does not collide with that
  // fixture. A host whose local zone is UTC (or any zone behind Manila's
  // UTC+8) would render this "Jul 31, 2026" under the old, unguarded
  // toLocaleDateString call; Manila anchoring must render "Aug 1, 2026".
  it("renders the Manila calendar day, not the UTC day, for an instant in the 16:00-23:59 UTC boundary window", () => {
    expect(formatManilaDate("2026-07-31T16:30:00Z")).toBe("Aug 1, 2026");
  });

  // This is the actual regression guard, independent of whichever timezone
  // the machine running the suite happens to be configured with: process.env.TZ
  // mutated mid-process is not a reliable way to force a different EFFECTIVE
  // default timezone inside this Vitest/jsdom worker (V8/ICU resolves and
  // caches a DateTimeFormat's default zone from the process's real ambient
  // zone the first time any Date/Intl operation runs in the worker, well
  // before any test body executes, and does not re-resolve it afterward) —
  // so a host-output-only assertion would spuriously pass on a machine whose
  // real ambient zone already happens to be Asia/Manila, exactly the failure
  // mode that let this bug ship in the first place. Asserting the explicit
  // `timeZone: "Asia/Manila"` option is actually requested is deterministic
  // on any machine: it fails immediately if that option is ever dropped,
  // regardless of what zone the host default resolves to.
  it("always requests the Asia/Manila zone explicitly, never the host default", () => {
    // A plain `vi.spyOn(Intl, "DateTimeFormat")` call-through isn't enough
    // here: `new Intl.DateTimeFormat(...)` is invoked with `new`, and
    // Vitest's spy wraps the constructor via `Reflect.construct(original,
    // args, newTarget)`, which — for this particular native constructor —
    // resolves the resulting instance's prototype from the *mock
    // function's* `newTarget`, not from `Intl.DateTimeFormat.prototype`,
    // leaving the returned object without a `.format` method. Supplying an
    // explicit `function` (not arrow — arrow functions have no [[Construct]]
    // slot, so `Reflect.construct` can't invoke them at all) implementation
    // that itself constructs and returns a real Intl.DateTimeFormat sidesteps
    // that: an explicit object return from a constructor call always wins
    // over the default `this`, regardless of prototype linkage.
    const RealDateTimeFormat = Intl.DateTimeFormat;
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (
      ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
    ) {
      return new RealDateTimeFormat(...args);
    });
    try {
      formatManilaDate("2026-07-31T16:30:00Z");
      expect(spy).toHaveBeenCalledWith("en-PH", expect.objectContaining({ timeZone: "Asia/Manila" }));
    } finally {
      spy.mockRestore();
    }
  });
});

// The mix panels' subtitles used to read a fixed "this month" regardless of
// the selected preset, so an Annual or Custom range described itself as a
// month. They now render this label instead. It was previously a private
// helper inside src/portals/admin/features/sla/lib/sla.ts (feeding SlaRangeStats.rangeLabel); it moved
// here so all four pages share one implementation rather than three of them
// growing their own.
describe("formatManilaRangeLabel", () => {
  it("renders a multi-day range as an en-dash-joined pair of Manila calendar days", () => {
    expect(formatManilaRangeLabel({ from: "2026-08-01", to: "2026-08-09" })).toBe(
      "Aug 1, 2026 – Aug 9, 2026"
    );
  });

  it("collapses a single-day range to one date rather than repeating it", () => {
    expect(formatManilaRangeLabel({ from: "2026-08-09", to: "2026-08-09" })).toBe("Aug 9, 2026");
  });

  // The Custom preset's from/to come straight from <input type="date">, which
  // is transiently "" mid-edit. An unformattable range must fall back to the
  // raw strings rather than letting Intl.DateTimeFormat throw on Invalid Date.
  it("falls back to the raw strings when a bound cannot be parsed", () => {
    expect(formatManilaRangeLabel({ from: "", to: "2026-08-09" })).toBe(" – 2026-08-09");
  });
});

// The Custom preset's bounds go straight from <input type="date"> state into
// the audited export RPC. Named presets are guaranteed well-formed by
// presetDateRange; Custom is user-typed and must be validated before the RPC
// call rather than sent raw (the security-hardening round's item 5).
describe("customRangeError", () => {
  it("accepts a valid range", () => {
    expect(customRangeError("2026-08-01", "2026-08-20")).toBeNull();
  });

  it("accepts a single-day range", () => {
    expect(customRangeError("2026-08-20", "2026-08-20")).toBeNull();
  });

  it("rejects a missing bound (the transient empty string while mid-edit)", () => {
    expect(customRangeError("", "2026-08-20")).toEqual(expect.any(String));
    expect(customRangeError("2026-08-01", "")).toEqual(expect.any(String));
  });

  it("rejects a malformed date", () => {
    expect(customRangeError("08/01/2026", "2026-08-20")).toEqual(expect.any(String));
    expect(customRangeError("2026-08-01", "not-a-date")).toEqual(expect.any(String));
  });

  it("rejects a calendar day that does not exist", () => {
    expect(customRangeError("2026-02-30", "2026-03-01")).toEqual(expect.any(String));
  });

  it("rejects a reversed range", () => {
    expect(customRangeError("2026-08-20", "2026-08-01")).toEqual(expect.any(String));
  });
});
