import { describe, expect, it } from "vitest";
import { buildSearchFilter } from "./search-filter";

const COLUMNS = ["reference_number", "barangay_name"] as const;

describe("buildSearchFilter", () => {
  it("names every column against the same quoted, wildcarded term", () => {
    expect(buildSearchFilter(COLUMNS, "santos")).toBe(
      'reference_number.ilike."%santos%",barangay_name.ilike."%santos%"',
    );
  });

  it("survives a reference number, which is what people actually paste", () => {
    expect(buildSearchFilter(["reference_number"], "BK-2026-000031")).toBe(
      'reference_number.ilike."%BK-2026-000031%"',
    );
  });

  it("strips the characters that would break or= filter syntax", () => {
    // A comma or paren here would end the filter list early; a quote would
    // close the value; an asterisk is a PostgREST wildcard.
    expect(buildSearchFilter(["last_name"], 'Dela Cruz, Juan (Jr.)*')).toBe(
      'last_name.ilike."%Dela Cruz Juan Jr.%"',
    );
    expect(buildSearchFilter(["address"], 'a,b(c)*d"e')).toBe(
      'address.ilike."%abcde%"',
    );
  });

  it("strips a backslash, which would escape the quote that closes the value", () => {
    expect(buildSearchFilter(["address"], 'a\\"b')).toBe(
      'address.ilike."%ab%"',
    );
  });

  it("returns null for a blank or whitespace-only term", () => {
    expect(buildSearchFilter(COLUMNS, "")).toBeNull();
    expect(buildSearchFilter(COLUMNS, "   ")).toBeNull();
    expect(buildSearchFilter(COLUMNS, undefined)).toBeNull();
  });

  /**
   * The caller skips the filter entirely on null. Returning a filter here
   * would match every row against "%%" — a full scan dressed as a search.
   */
  it("returns null when stripping leaves nothing behind", () => {
    expect(buildSearchFilter(COLUMNS, "(),*")).toBeNull();
  });
});
