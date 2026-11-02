import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SiteFooter from "./footer";

vi.mock("@/portals/citizen/lib/supabase/catalogs", () => ({
  catalogService: { getSiteInfo: async () => null },
}));

// ADR 0009: the way in for City employees is a small link in the citizen
// footer, and only there.
describe("SiteFooter", () => {
  it("links City employees to their sign-in", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "City employee sign-in" })).toHaveAttribute("href", "/employee");
  });
});
