import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClosureReasonBadge } from "./closure-reason-badge";

describe("ClosureReasonBadge", () => {
  it("names why an incident closed", () => {
    render(<ClosureReasonBadge reason="expired_unverified" />);
    expect(screen.getByText("Expired (Unverified)")).toBeInTheDocument();
  });

  it("distinguishes a confirmed close from a duplicate", () => {
    const { rerender } = render(<ClosureReasonBadge reason="citizen_confirmed" />);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    rerender(<ClosureReasonBadge reason="duplicate" />);
    expect(screen.getByText("Duplicate")).toBeInTheDocument();
  });

  it("renders nothing when there is no reason", () => {
    // Every non-closed incident. A badge reading "—" would be noise on 19 of 25
    // rows.
    const { container } = render(<ClosureReasonBadge reason={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
