import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";
import UnknownAddress from "./[...slug]/page";

// An unknown address under /super-staff lands here inside the Super Staff
// shell, never on the Citizen 404 (#30).
describe("Super Staff not-found", () => {
  it("says the page does not exist and leads back to Accounts", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/super-staff/accounts"]);
  });

  it("is what an address no Super Staff page matches renders", () => {
    expect(() => UnknownAddress()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
