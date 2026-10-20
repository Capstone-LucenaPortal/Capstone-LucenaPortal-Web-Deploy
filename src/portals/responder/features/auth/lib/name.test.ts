import { describe, expect, it } from "vitest";
import { firstNameOf, initialsOf } from "./name";

describe("initialsOf", () => {
  it("takes the first letters of the first TWO words", () => {
    // Not first-and-last. "Dela Cruz", "De Leon" and "San Pedro" are compound
    // surnames and common here: last-word initials would render "Juan Dela
    // Cruz" as JC, which reads as a different person.
    expect(initialsOf("Juan Dela Cruz")).toBe("JD");
    expect(initialsOf("Maria San Pedro")).toBe("MS");
  });

  it("handles a two-word name", () => {
    expect(initialsOf("Ana Reyes")).toBe("AR");
  });

  it("handles a single-word name", () => {
    expect(initialsOf("Madonna")).toBe("M");
  });

  it("ignores surrounding and repeated whitespace", () => {
    expect(initialsOf("  juan   dela cruz  ")).toBe("JD");
  });

  it("returns an empty string for an empty name", () => {
    // The avatar renders this directly; it must be "" and not "undefined".
    expect(initialsOf("")).toBe("");
    expect(initialsOf("   ")).toBe("");
  });
});

describe("firstNameOf", () => {
  it("returns the first word", () => {
    // Citizens see department + first name only (account spec Q6) — the full
    // legal name never leaves internal surfaces.
    expect(firstNameOf("Juan Dela Cruz")).toBe("Juan");
  });

  it("ignores surrounding whitespace", () => {
    expect(firstNameOf("  Ana Reyes ")).toBe("Ana");
  });

  it("returns an empty string for an empty name", () => {
    expect(firstNameOf("")).toBe("");
    expect(firstNameOf("   ")).toBe("");
  });
});
