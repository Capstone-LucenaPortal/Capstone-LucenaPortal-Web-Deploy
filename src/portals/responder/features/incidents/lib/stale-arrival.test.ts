import { describe, expect, it } from "vitest";
import { isStaleArrival } from "@/portals/responder/features/incidents/lib/stale-arrival";
import type { IncidentStatus } from "@/portals/responder/features/incidents/types";

const INC = "00000000-0000-4000-8000-000000000124";

const arrival = { event_code: "incident_pool_arrival", record_id: INC };
const visibleAs = (status: IncidentStatus) => new Map([[INC, status]]);

describe("isStaleArrival", () => {
  it("is stale when my department can no longer see the report (rerouted away or rejected)", () => {
    expect(isStaleArrival(arrival, new Map())).toBe(true);
  });

  it("is stale when the report is closed", () => {
    expect(isStaleArrival(arrival, visibleAs("closed"))).toBe(true);
  });

  it.each(["open", "in_pool", "in_progress", "resolved"] as const)(
    "is live while the report is %s",
    (status) => {
      expect(isStaleArrival(arrival, visibleAs(status))).toBe(false);
    },
  );

  it("is never stale for any other kind of notification, even one whose report is gone", () => {
    expect(
      isStaleArrival({ event_code: "incident_pooled", record_id: INC }, new Map()),
    ).toBe(false);
  });

  it("is never stale for an arrival with no report on it", () => {
    expect(
      isStaleArrival({ event_code: "incident_pool_arrival", record_id: null }, new Map()),
    ).toBe(false);
  });
});
