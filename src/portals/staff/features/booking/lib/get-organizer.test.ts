import { describe, it, expect } from "vitest";
import { getOrganizer } from "./get-organizer";

describe("getOrganizer", () => {
  it("returns the organization name when present", () => {
    expect(
      getOrganizer({
        organization_name: "Tech Community PH",
        contact_person: "Juan Dela Cruz",
      })
    ).toBe("Tech Community PH");
  });

  it("falls back to the contact person when there is no organization", () => {
    expect(
      getOrganizer({ organization_name: null, contact_person: "Maria Santos" })
    ).toBe("Maria Santos");
  });

  it("treats a blank organization name as absent", () => {
    // submit_booking nullifies blanks, but the original fixtures were
    // direct-inserted and a direct insert can still produce an empty string.
    expect(
      getOrganizer({ organization_name: "", contact_person: "Maria Santos" })
    ).toBe("Maria Santos");
    expect(
      getOrganizer({ organization_name: "   ", contact_person: "Maria Santos" })
    ).toBe("Maria Santos");
  });
});
