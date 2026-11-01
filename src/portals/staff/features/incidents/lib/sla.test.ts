import { describe, expect, it } from "vitest";
import { deriveSlaState } from "./sla";
import type { IncidentQueueItem } from "../types";

const NOW = new Date("2026-08-07T12:00:00+08:00");

function row(over: Partial<IncidentQueueItem> = {}): IncidentQueueItem {
  return {
    id: "i1",
    reference_number: "INC-2026-000001",
    type_label: "Flooding",
    incident_level: "critical",
    status: "in_pool",
    closure_reason: null,
    is_verified: true,
    barangay_name: "Cotta",
    submitted_at: "2026-08-07T06:00:00+08:00",
    sla_armed_at: "2026-08-07T08:00:00+08:00",
    sla_due_at: "2026-08-07T12:00:00+08:00",
    resolved_at: null,
    closed_at: null,
    duplicate_of: null,
    original_reference: null,
    ...over,
  };
}

describe("deriveSlaState", () => {
  it("suspends the clock while unverified", () => {
    // No proof, no clock. This is the state 13 of 25 sandbox rows are in.
    expect(deriveSlaState(row({ is_verified: false }), NOW, 0.5)).toBe("suspended");
  });

  it("reports not_armed when verified but never routed", () => {
    expect(
      deriveSlaState(row({ sla_due_at: null, sla_armed_at: null }), NOW, 0.5),
    ).toBe("not_armed");
  });

  it("is healthy below the threshold", () => {
    // Armed 08:00, due 12:00, now 09:00 => 25% elapsed.
    expect(
      deriveSlaState(row(), new Date("2026-08-07T09:00:00+08:00"), 0.5),
    ).toBe("healthy");
  });

  it("is at_risk at exactly the threshold", () => {
    // 10:00 of an 08:00-12:00 window => exactly 50%.
    expect(
      deriveSlaState(row(), new Date("2026-08-07T10:00:00+08:00"), 0.5),
    ).toBe("at_risk");
  });

  it("honours a threshold other than one half", () => {
    // The same 50% moment is still healthy when the configured cut is 75%.
    expect(
      deriveSlaState(row(), new Date("2026-08-07T10:00:00+08:00"), 0.75),
    ).toBe("healthy");
  });

  it("breaches once the deadline passes", () => {
    expect(
      deriveSlaState(row(), new Date("2026-08-07T12:00:01+08:00"), 0.5),
    ).toBe("breached");
  });

  it("reports met when resolved inside the window", () => {
    expect(
      deriveSlaState(
        row({ status: "resolved", resolved_at: "2026-08-07T11:00:00+08:00" }),
        NOW,
        0.5,
      ),
    ).toBe("met");
  });

  it("reports breached when resolved after the deadline", () => {
    expect(
      deriveSlaState(
        row({ status: "resolved", resolved_at: "2026-08-07T13:00:00+08:00" }),
        NOW,
        0.5,
      ),
    ).toBe("breached");
  });

  it("does not score an armed report that expired", () => {
    // Expiry closes a report nobody fixed, so there is no service to judge. A
    // late closed_at used to read Breached, as if the desk had missed it.
    expect(
      deriveSlaState(
        row({
          status: "closed",
          closure_reason: "expired_unverified",
          resolved_at: null,
          closed_at: "2026-08-07T14:00:00+08:00",
        }),
        NOW,
        0.5,
      ),
    ).toBe("not_scored");
  });

  it("does not score an expired report even when it carries a resolved_at", () => {
    // The closure reason wins over the timestamps, as Admin's incidentMet has it.
    expect(
      deriveSlaState(
        row({
          status: "closed",
          closure_reason: "expired_unverified",
          resolved_at: "2026-08-07T11:00:00+08:00",
          closed_at: "2026-08-07T14:00:00+08:00",
        }),
        NOW,
        0.5,
      ),
    ).toBe("not_scored");
  });

  // INC-2026-000124 to 000128: routed, then refused as Invalid minutes later,
  // read Met. Refused as a Duplicate after the deadline read Breached.
  it.each([
    ["invalid", "before", "2026-08-07T09:00:00+08:00"],
    ["invalid", "after", "2026-08-07T14:00:00+08:00"],
    ["duplicate", "before", "2026-08-07T09:00:00+08:00"],
    ["duplicate", "after", "2026-08-07T14:00:00+08:00"],
  ] as const)(
    "does not score a routed report refused as %s %s the deadline",
    (closure_reason, _when, closed_at) => {
      expect(
        deriveSlaState(
          row({ status: "closed", closure_reason, resolved_at: null, closed_at }),
          NOW,
          0.5,
        ),
      ).toBe("not_scored");
    },
  );

  it.each(["citizen_confirmed", "auto_confirmed"] as const)(
    "still scores a closure by %s against resolved_at",
    (closure_reason) => {
      const closed = (resolved_at: string) =>
        deriveSlaState(
          row({
            status: "closed",
            closure_reason,
            resolved_at,
            closed_at: "2026-08-10T12:00:00+08:00",
          }),
          NOW,
          0.5,
        );
      expect(closed("2026-08-07T11:00:00+08:00")).toBe("met");
      expect(closed("2026-08-07T13:00:00+08:00")).toBe("breached");
    },
  );

  it("still reads not_armed for a verified report refused before routing", () => {
    expect(
      deriveSlaState(
        row({
          status: "closed",
          closure_reason: "invalid",
          sla_armed_at: null,
          sla_due_at: null,
          closed_at: "2026-08-07T14:00:00+08:00",
        }),
        NOW,
        0.5,
      ),
    ).toBe("not_armed");
  });

  it("still suspends an unverified report refused as invalid", () => {
    expect(
      deriveSlaState(
        row({
          status: "closed",
          closure_reason: "invalid",
          is_verified: false,
          closed_at: "2026-08-07T14:00:00+08:00",
        }),
        NOW,
        0.5,
      ),
    ).toBe("suspended");
  });

  it("suspends a closed incident that never armed", () => {
    expect(
      deriveSlaState(
        row({
          status: "closed",
          is_verified: false,
          sla_armed_at: null,
          sla_due_at: null,
          closed_at: "2026-08-07T14:00:00+08:00",
        }),
        NOW,
        0.5,
      ),
    ).toBe("suspended");
  });
});
