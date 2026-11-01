import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";
import UnknownAddress from "./[...slug]/page";

// An unknown address under /staff, and an unknown id on a detail page, land
// here inside the Staff shell, never on the Citizen 404 (#30).
describe("Staff not-found", () => {
  it("says the page does not exist and leads back to the Staff dashboard", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/staff/dashboard"]);
  });

  it("is what an address no Staff page matches renders", () => {
    expect(() => UnknownAddress()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
