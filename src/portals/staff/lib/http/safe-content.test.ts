import { describe, expect, it } from "vitest";
import { safeContentHeaders } from "./safe-content";

describe("safeContentHeaders", () => {
  it("shows a JPEG inline, which is the ordinary voter ID case", () => {
    const headers = safeContentHeaders("image/jpeg");
    expect(headers["Content-Type"]).toBe("image/jpeg");
    expect(headers["Content-Disposition"]).toBe("inline");
  });

  it("shows a PNG inline", () => {
    expect(safeContentHeaders("image/png")["Content-Disposition"]).toBe("inline");
  });

  it("shows a PDF inline", () => {
    const headers = safeContentHeaders("application/pdf");
    expect(headers["Content-Type"]).toBe("application/pdf");
    expect(headers["Content-Disposition"]).toBe("inline");
  });

  it.each([
    "image/svg+xml",
    "text/html",
    "application/xhtml+xml",
    "application/xml",
    "text/xml",
  ])("never serves %s inline, because it would run script on our origin", (mime) => {
    const headers = safeContentHeaders(mime);
    expect(headers["Content-Type"]).toBe("application/octet-stream");
    expect(headers["Content-Disposition"]).toBe("attachment");
  });

  it("forces download for anything not on the allowlist, not just known-dangerous types", () => {
    // An allowlist, not a blocklist: a type nobody thought of must be inert.
    const headers = safeContentHeaders("application/x-shockwave-flash");
    expect(headers["Content-Type"]).toBe("application/octet-stream");
    expect(headers["Content-Disposition"]).toBe("attachment");
  });

  it("treats a missing content type as untrusted", () => {
    expect(safeContentHeaders(undefined)["Content-Disposition"]).toBe("attachment");
    expect(safeContentHeaders("")["Content-Disposition"]).toBe("attachment");
  });

  it("ignores parameters and casing when matching the allowlist", () => {
    expect(safeContentHeaders("IMAGE/JPEG; charset=binary")["Content-Disposition"]).toBe(
      "inline",
    );
  });

  it("always sends nosniff and a sandbox, whatever the type", () => {
    for (const mime of ["image/png", "image/svg+xml", undefined]) {
      const headers = safeContentHeaders(mime);
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Content-Security-Policy"]).toContain("sandbox");
    }
  });

  it("never lets a citizen's ID sit in a shared cache", () => {
    expect(safeContentHeaders("image/png")["Cache-Control"]).toContain("no-store");
    expect(safeContentHeaders("image/png")["Cache-Control"]).toContain("private");
  });
});
