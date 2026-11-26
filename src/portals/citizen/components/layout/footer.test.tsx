import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SiteFooter from "./footer";
import { HELPDESK_EMAIL } from "@/portals/citizen/lib/contact-info";

const getSiteInfo = vi.fn();

vi.mock("@/portals/citizen/lib/supabase/catalogs", () => ({
  catalogService: { getSiteInfo: () => getSiteInfo() },
}));

function telLinks(container: HTMLElement) {
  return container.querySelectorAll('a[href^="tel:"]');
}

beforeEach(() => {
  getSiteInfo.mockReset();
  getSiteInfo.mockResolvedValue(null);
});

// ADR 0009: the way in for City employees is a small link in the citizen
// footer, and only there.
describe("SiteFooter", () => {
  it("links City employees to their sign-in", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "City employee sign-in" })).toHaveAttribute("href", "/employee");
  });

  // #47: the footer used to show and dial a hard-coded trunkline until Site
  // Info answered. Only a number the city saved is ever shown.
  describe("the trunkline", () => {
    it("shows no phone number while Site Info loads, but keeps the helpdesk email", () => {
      getSiteInfo.mockReturnValue(new Promise(() => {}));
      const { container } = render(<SiteFooter />);

      expect(telLinks(container)).toHaveLength(0);
      expect(screen.getByRole("link", { name: HELPDESK_EMAIL })).toHaveAttribute("href", `mailto:${HELPDESK_EMAIL}`);
      expect(container.textContent).not.toMatch(/please call/i);
    });

    it("shows the saved trunkline as a tel: link once Site Info answers", async () => {
      getSiteInfo.mockResolvedValue({ trunkline: "(042) 788-2298", office_hours: null });
      render(<SiteFooter />);

      expect(await screen.findByRole("link", { name: "(042) 788-2298" })).toHaveAttribute("href", "tel:+63427882298");
    });

    it("shows no phone number when Site Info has none", async () => {
      const { container } = render(<SiteFooter />);
      await vi.waitFor(() => expect(getSiteInfo).toHaveBeenCalled());
      await Promise.resolve();

      expect(telLinks(container)).toHaveLength(0);
    });

    it("shows no phone number when the Site Info read fails", async () => {
      getSiteInfo.mockRejectedValue(new Error("network down"));
      const { container } = render(<SiteFooter />);
      await vi.waitFor(() => expect(getSiteInfo).toHaveBeenCalled());
      await Promise.resolve();

      expect(telLinks(container)).toHaveLength(0);
      expect(screen.getByRole("link", { name: HELPDESK_EMAIL })).toBeInTheDocument();
    });
  });
});
