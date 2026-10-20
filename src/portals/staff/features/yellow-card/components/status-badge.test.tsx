import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YellowCardStatusBadge } from "./status-badge";
import type { YellowCardStatus } from "../types";

describe("YellowCardStatusBadge", () => {
  const cases: Array<[YellowCardStatus, string]> = [
    ["pending", "Pending Review"],
    ["resubmitted", "Resubmitted"],
    ["revision_requested", "Revision Requested"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
  ];

  it.each(cases)("renders %s as %s", (status, label) => {
    render(<YellowCardStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
