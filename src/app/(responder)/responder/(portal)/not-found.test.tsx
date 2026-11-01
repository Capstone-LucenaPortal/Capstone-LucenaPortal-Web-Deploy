import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";
import UnknownAddress from "./[...slug]/page";

// An unknown address under /responder lands here inside the PortalShell,
// never on the Citizen 404 (#30).
describe("Responder not-found", () => {
  it("says the page does not exist and leads back to the pool", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/responder/pool"]);
  });

  it("is what an address no Responder page matches renders", () => {
    expect(() => UnknownAddress()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
