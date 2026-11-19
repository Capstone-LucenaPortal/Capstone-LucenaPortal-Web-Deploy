import { describe, it, expect } from "vitest";
import { adminDisplayName } from "./display-name";

// The name the Sidebar welcomes and the Dashboard greets, both from the
// server's read of my_staff_profile.
describe("adminDisplayName", () => {
  it("uses the full name", () => {
    expect(
      adminDisplayName({ full_name: "Maria Santos", email: "maria.santos@lucena.local" }),
    ).toBe("Maria Santos");
  });

  it("falls back to the part of the email before the @", () => {
    expect(adminDisplayName({ full_name: null, email: "juan.delacruz@lucena.local" })).toBe(
      "juan.delacruz",
    );
  });

  it("is empty when there is neither", () => {
    expect(adminDisplayName({ full_name: null, email: null })).toBe("");
    expect(adminDisplayName(null)).toBe("");
  });
});
