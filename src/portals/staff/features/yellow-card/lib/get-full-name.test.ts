import { describe, expect, it } from "vitest";
import { getFullName } from "./get-full-name";

describe("getFullName", () => {
  it("joins first, middle and last name", () => {
    expect(
      getFullName({
        first_name: "Juan",
        middle_name: "Dizon",
        last_name: "Dela Cruz",
        suffix: null,
      }),
    ).toBe("Juan Dizon Dela Cruz");
  });

  it("omits a null middle name without leaving a double space", () => {
    expect(
      getFullName({
        first_name: "Maria",
        middle_name: null,
        last_name: "Santos",
        suffix: null,
      }),
    ).toBe("Maria Santos");
  });

  it("appends a suffix when the view carries one", () => {
    expect(
      getFullName({
        first_name: "Jose",
        middle_name: "Rizal",
        last_name: "Mercado",
        suffix: "Jr.",
      }),
    ).toBe("Jose Rizal Mercado Jr.");
  });

  it("drops an empty-string suffix rather than trailing a space", () => {
    expect(
      getFullName({
        first_name: "Ana",
        middle_name: null,
        last_name: "Lopez",
        suffix: "",
      }),
    ).toBe("Ana Lopez");
  });
});
