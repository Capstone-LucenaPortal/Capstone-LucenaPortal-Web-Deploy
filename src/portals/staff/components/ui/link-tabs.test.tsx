import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinkTabs } from "./link-tabs";

const options = [
  { value: "all", label: "All", count: 30, href: "/yellow-card" },
  { value: "pending", label: "Pending Review", count: 3, href: "/yellow-card?status=pending" },
  { value: "withdrawn", label: "Withdrawn", count: 9, href: "/yellow-card?status=withdrawn" },
];

describe("LinkTabs", () => {
  it("renders one link per option with its count", () => {
    render(<LinkTabs options={options} activeValue="all" />);

    expect(screen.getByRole("link", { name: /All \(30\)/ })).toHaveAttribute(
      "href",
      "/yellow-card",
    );
    expect(screen.getByRole("link", { name: /Pending Review \(3\)/ })).toHaveAttribute(
      "href",
      "/yellow-card?status=pending",
    );
  });

  it("marks only the active tab as current for assistive technology", () => {
    render(<LinkTabs options={options} activeValue="pending" />);

    expect(screen.getByRole("link", { name: /Pending Review/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /All/ })).not.toHaveAttribute("aria-current");
  });
});
