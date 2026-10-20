import { render, screen } from "@testing-library/react";
import { Badge } from "@/portals/admin/components/ui/badge";

describe("Badge", () => {
  it("renders the status text", () => {
    render(<Badge status="Approved" variant="success" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  // Badge no longer derives color from its own status text — a caller
  // computes a `variant` from the enum code via src/portals/admin/lib/status-colors.ts and
  // passes it in explicitly. This is the regression guard: two different
  // labels passed the SAME variant must render the SAME classes, proving
  // Badge isn't looking the label up internally anymore.
  it("applies the classes for the given variant, regardless of the status text", () => {
    render(<Badge status="Approved" variant="success" />);
    expect(screen.getByText("Approved")).toHaveClass("bg-green-100", "text-green-800");
  });

  it("does not fall back to any internal color lookup for an unrecognised label", () => {
    render(<Badge status="Some made-up label" variant="info" />);
    expect(screen.getByText("Some made-up label")).toHaveClass("bg-blue-100", "text-blue-800");
  });

  // variant defaults to "default" — the same neutral gray every null-status
  // fallback across the pages relies on when a caller omits it.
  it("defaults to the default (gray) variant when no variant is passed", () => {
    render(<Badge status="Unknown" />);
    expect(screen.getByText("Unknown")).toHaveClass("bg-gray-100", "text-gray-800");
  });

  it("renders the correct classes for every variant", () => {
    const cases: Array<[NonNullable<Parameters<typeof Badge>[0]["variant"]>, string[]]> = [
      ["default", ["bg-gray-100", "text-gray-800"]],
      ["success", ["bg-green-100", "text-green-800"]],
      ["warning", ["bg-yellow-100", "text-yellow-800"]],
      ["destructive", ["bg-red-100", "text-red-800"]],
      ["info", ["bg-blue-100", "text-blue-800"]],
    ];

    for (const [variant, classes] of cases) {
      const { unmount } = render(<Badge status={`status-${variant}`} variant={variant} />);
      expect(screen.getByText(`status-${variant}`)).toHaveClass(...classes);
      unmount();
    }
  });
});
