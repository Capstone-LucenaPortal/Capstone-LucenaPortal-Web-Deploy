import { describe, expect, it } from "vitest";
import { RpcError } from "./errors";
import { requiredColumn } from "./rows";

describe("requiredColumn", () => {
  it("passes a present value straight through", () => {
    expect(requiredColumn(30, "downpayment_pct", "super_booking_config")).toBe(30);
  });

  it("passes zero through — a zero opening hour is midnight, not a missing value", () => {
    expect(requiredColumn(0, "opening_hour", "super_booking_config")).toBe(0);
  });

  it("refuses a null rather than coercing it", () => {
    // §7.1: the portal "must not render a null as 0". The base tables declare
    // these columns NOT NULL; only the definer view types them nullable,
    // because PostgREST cannot know the gate guarantees a row. So a null is a
    // broken invariant, not a value to substitute for.
    expect(() =>
      requiredColumn(null, "downpayment_pct", "super_booking_config"),
    ).toThrow(RpcError);
  });

  it("names the column and the view it came from", () => {
    expect(() =>
      requiredColumn(null, "nudge_day", "super_incident_config"),
    ).toThrow(/super_incident_config\.nudge_day/);
  });

  it("classifies the breakage as unexpected, so the caller shows its own copy", () => {
    try {
      requiredColumn(null, "nudge_day", "super_incident_config");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RpcError);
      expect((e as RpcError).kind).toBe("unexpected");
    }
  });
});
