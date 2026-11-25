import { describe, expect, it } from "vitest";
import { toRpcError } from "@/portals/super-staff/lib/supabase/errors";
import { maintenanceErrorMessage } from "./maintenance-errors";

// Every message below is the l125b raise text verbatim (header §3 and the
// function bodies), with the `%` placeholders filled in.

const FALLBACK = "Could not save. Try again.";
const say = (code: string, message: string) =>
  maintenanceErrorMessage(toRpcError({ code, message }), FALLBACK);

describe("maintenanceErrorMessage", () => {
  it("names the clashing booking references", () => {
    const text = say(
      "23P01",
      "add_maintenance_period: the Atrium is booked during those days: BK-2026-0012, BK-2026-0031; cancel or move those bookings first",
    );
    expect(text).toBe(
      "The Atrium is booked during those days: BK-2026-0012, BK-2026-0031. Cancel or move those bookings first.",
    );
  });

  it("names the references on an extension or reactivation clash too", () => {
    expect(
      say(
        "23P01",
        "update_maintenance_period: the Arena is booked during those days: BK-2026-0040; cancel or move those bookings first",
      ),
    ).toBe("The Arena is booked during those days: BK-2026-0040. Cancel or move those bookings first.");
  });

  it("refuses a first day in the past in plain words", () => {
    expect(
      say("22023", "add_maintenance_period: the first day 2026-11-20 is before today (2026-11-25)"),
    ).toBe("The first day, 2026-11-20, is in the past. Today is 2026-11-25.");
  });

  it("refuses a last day in the past in plain words", () => {
    expect(
      say("22023", "update_maintenance_period: the last day 2026-11-24 is before today (2026-11-25)"),
    ).toBe("The last day, 2026-11-24, is in the past. Today is 2026-11-25.");
  });

  it("refuses a last day before the first day", () => {
    expect(
      say("22023", "add_maintenance_period: the last day 2026-12-01 is before the first day 2026-12-03"),
    ).toBe("The last day, 2026-12-01, is before the first day, 2026-12-03.");
  });

  it("explains why an ended period cannot be extended", () => {
    expect(
      say(
        "22023",
        "update_maintenance_period: the period ended on 2026-11-20; extending it would add days before today (2026-11-25)",
      ),
    ).toBe(
      "This period ended on 2026-11-20. Extending it would close days that have already passed, so add a new period from today (2026-11-25) instead.",
    );
  });

  it("asks for a reason", () => {
    expect(say("22023", "update_maintenance_period: a reason is required, at most 500 characters")).toBe(
      "Enter a reason, at most 500 characters.",
    );
  });

  it("shows any other 22023 without the function name", () => {
    expect(say("22023", "add_maintenance_period: space is required")).toBe("Space is required.");
  });

  it("reads an unknown Space as a stale screen", () => {
    expect(say("23503", "add_maintenance_period: unknown space gym")).toMatch(/^That Space no longer exists/);
  });

  it("reads PT404 as not found and 42501 as not permitted", () => {
    expect(say("PT404", "update_maintenance_period: no maintenance period 1234")).toMatch(/^Not found/);
    expect(say("42501", "add_maintenance_period: caller is not an active Super Staff")).toMatch(/^Not permitted/);
  });

  it("falls back for anything else", () => {
    expect(maintenanceErrorMessage(new Error("network"), FALLBACK)).toBe(FALLBACK);
    expect(say("XX000", "boom")).toBe(FALLBACK);
  });
});
