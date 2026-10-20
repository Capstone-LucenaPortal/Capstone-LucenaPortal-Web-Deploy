import { describe, expect, it } from "vitest";
import { forensicContext, toEntries, toEntry } from "./entry";
import type { AuditRow } from "./entry";

// `super_audit_log` is a definer view, so PostgREST types every column
// nullable — it cannot know the view's own guarantees. This is where that
// pessimism gets turned back into a domain type.
const row = (patch: Partial<AuditRow> = {}): AuditRow => ({
  id: "a1",
  occurred_at: "2026-08-12T02:15:00Z",
  actor_name: "Ramon Cruz",
  area: "configuration",
  target_id: "booking_config",
  target_label: "Booking configuration",
  change: "Downpayment (%) 50 → 30",
  detail: null,
  session_id: null,
  ip_address: null,
  user_agent: null,
  ...patch,
});

describe("toEntry", () => {
  it("carries a complete row through", () => {
    expect(toEntry(row())).toEqual({
      id: "a1",
      timestamp: "2026-08-12T02:15:00Z",
      actor: "Ramon Cruz",
      area: "configuration",
      change: "Downpayment (%) 50 → 30",
      target: "Booking configuration",
      targetId: "booking_config",
      detail: undefined,
      sessionId: null,
      ipAddress: null,
      userAgent: null,
    });
  });

  it("attributes an actorless entry to System — the RPCs write some unattended", () => {
    expect(toEntry(row({ actor_name: null }))?.actor).toBe("System");
  });

  it("keeps a null target_id rather than inventing one", () => {
    // Histories match on target_id, never on the label — a rename must not
    // orphan a history, and a fabricated id would attach it to the wrong row.
    expect(toEntry(row({ target_id: null }))?.targetId).toBeNull();
  });

  it("falls back to an em dash for a missing target label", () => {
    expect(toEntry(row({ target_label: null }))?.target).toBe("—");
  });

  it("carries the Forensic Context the entry was written under", () => {
    // DB l79: the session, IP and user agent are copied onto the row at write
    // time, so they survive the session ending.
    const e = toEntry(
      row({
        area: "auth",
        session_id: "0fd577a5-c206-4422-9339-cf6c7e23767e",
        ip_address: "113.19.143.164",
        user_agent: "Mozilla/5.0",
      }),
    );
    expect(e?.area).toBe("auth");
    expect(e?.sessionId).toBe("0fd577a5-c206-4422-9339-cf6c7e23767e");
    expect(e?.ipAddress).toBe("113.19.143.164");
    expect(e?.userAgent).toBe("Mozilla/5.0");
  });

  it("reads an IP that is not a string as absent", () => {
    // PostgREST types the inet column `unknown`; never render an object.
    expect(toEntry(row({ ip_address: { addr: "x" } }))?.ipAddress).toBeNull();
  });

  it("drops a row missing any of id, occurred_at or area", () => {
    expect(toEntry(row({ id: null }))).toBeNull();
    expect(toEntry(row({ occurred_at: null }))).toBeNull();
    expect(toEntry(row({ area: null }))).toBeNull();
  });
});

describe("toEntries", () => {
  it("keeps the order it was given and drops only the unusable rows", () => {
    const entries = toEntries([
      row({ id: "a1" }),
      row({ id: null }),
      row({ id: "a3" }),
    ]);
    expect(entries.map((e) => e.id)).toEqual(["a1", "a3"]);
  });

  it("treats no data at all as an empty log, not as a failure", () => {
    expect(toEntries(null)).toEqual([]);
  });
});

describe("forensicContext", () => {
  it("lists the session, IP address and user agent that are present, in that order", () => {
    const e = toEntry(
      row({ session_id: "s-1", ip_address: "198.51.100.7", user_agent: "UA" }),
    )!;
    expect(forensicContext(e)).toEqual([
      { label: "Session", value: "s-1" },
      { label: "IP address", value: "198.51.100.7" },
      { label: "User agent", value: "UA" },
    ]);
  });

  it("keeps the session when its IP and user agent are unknown", () => {
    const e = toEntry(row({ session_id: "s-1" }))!;
    expect(forensicContext(e)).toEqual([{ label: "Session", value: "s-1" }]);
  });

  it("is empty for a system entry or one written before l79 -- nothing is invented", () => {
    expect(forensicContext(toEntry(row())!)).toEqual([]);
  });
});
