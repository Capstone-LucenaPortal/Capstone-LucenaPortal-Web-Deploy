import { describe, expect, it } from "vitest";
import { toRpcError } from "@/portals/super-staff/lib/supabase/errors";
import { calendarErrorMessage } from "./calendar-errors";

const FALLBACK = "Could not save. Try again.";

describe("calendarErrorMessage", () => {
  it("reads PT404 from a stale screen as not found", () => {
    const e = toRpcError({ code: "PT404", message: "update_holiday: no holiday 1234" });
    expect(calendarErrorMessage(e, FALLBACK)).toMatch(/^Not found/);
  });

  it("reads 42501 as not permitted", () => {
    const e = toRpcError({
      code: "42501",
      message: "set_office_hours: caller is not an active Super Staff",
    });
    expect(calendarErrorMessage(e, FALLBACK)).toMatch(/^Not permitted/);
  });

  it("shows the database's own 22023 message — close before open", () => {
    const message =
      "set_office_hours: close_time 08:00:00 must be after open_time 17:00:00";
    expect(calendarErrorMessage(toRpcError({ code: "22023", message }), FALLBACK)).toBe(
      message,
    );
  });

  it("shows the database's 23505 message — a date that already has an entry", () => {
    const message =
      "add_holiday: 2026-12-25 already has a holiday entry; edit or reactivate it instead";
    expect(calendarErrorMessage(toRpcError({ code: "23505", message }), FALLBACK)).toBe(
      message,
    );
  });

  it("falls back for anything else", () => {
    expect(calendarErrorMessage(new Error("network"), FALLBACK)).toBe(FALLBACK);
    expect(
      calendarErrorMessage(toRpcError({ code: "XX000", message: "boom" }), FALLBACK),
    ).toBe(FALLBACK);
  });
});
