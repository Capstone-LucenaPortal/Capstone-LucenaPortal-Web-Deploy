import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// ADR 0009: every staff-side Portal and the employee sign-in are kept out of
// search results with noindex, and robots.txt names none of them, since a
// Disallow line would advertise the paths.

vi.mock("next/font/google", () => ({ Inter: () => ({ className: "" }), Instrument_Sans: () => ({ className: "", variable: "" }) }));

describe("noindex on the City employee side", () => {
  it.each([
    ["/employee", () => import("@/app/(employee)/layout")],
    ["/staff", () => import("@/app/(staff)/layout")],
    ["/super-staff", () => import("@/app/(super-staff)/layout")],
    ["/responder", () => import("@/app/(responder)/layout")],
    ["/admin", () => import("@/app/(admin)/layout")],
  ])("serves %s with noindex, nofollow", async (_path, load) => {
    const { metadata } = await load();

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("leaves the employee paths out of robots.txt", () => {
    const robots = readFileSync(path.resolve(__dirname, "../../public/robots.txt"), "utf8");

    expect(robots).not.toMatch(/employee|staff|responder|admin/i);
  });
});
