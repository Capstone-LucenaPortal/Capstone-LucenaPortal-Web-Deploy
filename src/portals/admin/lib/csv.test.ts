// src/portals/admin/lib/csv.test.ts
//
// escapeCell/toCsv are pure string transforms with no I/O, so this suite
// exercises them directly rather than through downloadCsv's Blob/anchor
// machinery (which each page's own test suite mocks out). A regression here
// silently shifts every following column in a spreadsheet — invisible to a
// human reader who only glances at the file — which is why every special
// character escapeCell claims to handle gets its own pinned case.
import { toCsv } from "@/portals/admin/lib/csv";

describe("toCsv / escapeCell", () => {
  it("leaves a cell with no special characters unquoted", () => {
    expect(toCsv(["Name"], [["Juan Dela Cruz"]])).toBe("Name\nJuan Dela Cruz");
  });

  it("quotes a cell containing a comma", () => {
    expect(toCsv(["Address"], [["123 Rizal St., Barangay One"]])).toBe(
      'Address\n"123 Rizal St., Barangay One"'
    );
  });

  it("quotes a cell containing a double quote and doubles the inner quote", () => {
    expect(toCsv(["Note"], [['Say "hello"']])).toBe('Note\n"Say ""hello"""');
  });

  it("quotes a cell containing a newline", () => {
    expect(toCsv(["Note"], [["line one\nline two"]])).toBe('Note\n"line one\nline two"');
  });

  it("quotes a cell containing a bare carriage return", () => {
    expect(toCsv(["Note"], [["line one\rline two"]])).toBe('Note\n"line one\rline two"');
  });

  it("joins multiple columns with commas and multiple rows with newlines", () => {
    expect(
      toCsv(
        ["Reference", "Status"],
        [
          ["YC-2026-000001", "approved"],
          ["YC-2026-000002", "pending"],
        ]
      )
    ).toBe("Reference,Status\nYC-2026-000001,approved\nYC-2026-000002,pending");
  });

  it("stringifies a number cell without quoting", () => {
    expect(toCsv(["Count"], [[42]])).toBe("Count\n42");
  });

  // CSV injection: a leading =, +, - or @ is evaluated as a formula by
  // Excel/Google Sheets when the file is opened. Yellow Card's export
  // releases full_name/email straight from the database, so this must be
  // neutralized before the cell ever reaches a spreadsheet app.
  describe("CSV-injection neutralization", () => {
    it.each([
      ["=", "=SUM(A1:A9)"],
      ["+", "+1+1"],
      ["-", "-1+1"],
      ["@", "@SUM(A1:A9)"],
    ])("prefixes a cell beginning with %s with a single quote", (_label, input) => {
      const csv = toCsv(["Name"], [[input]]);
      expect(csv).toBe(`Name\n'${input}`);
    });

    it("still quotes a formula-prefixed cell that also contains a comma", () => {
      const csv = toCsv(["Name"], [["=CMD(),1"]]);
      expect(csv).toBe(`Name\n"'=CMD(),1"`);
    });

    it("does not prefix a cell where the special character is not leading", () => {
      const csv = toCsv(["Name"], [["Total = 5"]]);
      expect(csv).toBe("Name\nTotal = 5");
    });
  });
});
