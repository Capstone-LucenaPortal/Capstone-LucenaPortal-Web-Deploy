import { describe, expect, it } from "vitest";
import { AUDIT_AREAS, areaLabel, isAuditArea } from "./area";

describe("audit areas", () => {
  it("lists the seven database enum values in display order", () => {
    expect(AUDIT_AREAS).toEqual([
      "accounts",
      "configuration",
      "catalogs",
      "content",
      "pii_access",
      "calendar",
      "auth",
    ]);
  });

  it("gives each area a display label", () => {
    expect(areaLabel("accounts")).toBe("Accounts");
    expect(areaLabel("configuration")).toBe("Configuration");
    expect(areaLabel("catalogs")).toBe("Catalogs");
    expect(areaLabel("content")).toBe("Content");
    expect(areaLabel("pii_access")).toBe("PII access");
    expect(areaLabel("calendar")).toBe("Calendar");
    expect(areaLabel("auth")).toBe("Authentication");
  });

  it("degrades gracefully for a value added to the enum later", () => {
    expect(areaLabel("something_new" as never)).toBe("something_new");
  });

  it("recognises known areas and rejects unknown ones", () => {
    expect(isAuditArea("content")).toBe(true);
    expect(isAuditArea("Announcements")).toBe(false);
  });
});
