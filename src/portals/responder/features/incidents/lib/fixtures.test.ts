import { describe, expect, it } from "vitest";
import { anIncident } from "@/portals/responder/features/incidents/lib/fixtures";

describe("anIncident", () => {
  it("defaults to a verified, unclaimed, critical pool incident", () => {
    const incident = anIncident();
    expect(incident.status).toBe("in_pool");
    expect(incident.is_verified).toBe(true);
    expect(incident.assigned_responder_id).toBeNull();
  });

  it("takes overrides, including nulling the phone on an anonymous report", () => {
    const incident = anIncident({
      is_verified: false,
      sla_due_at: null,
      reporter_first_name: "Anonymous",
      reporter_phone: null,
    });
    expect(incident.sla_due_at).toBeNull();
    expect(incident.reporter_phone).toBeNull();
  });
});
