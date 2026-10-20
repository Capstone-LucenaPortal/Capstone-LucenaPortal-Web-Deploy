import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GcashReceiptPreviewPage from "./page";

describe("GcashReceiptPreviewPage", () => {
  it("renders the generic placeholder text", () => {
    render(<GcashReceiptPreviewPage />);
    expect(screen.getByText("GCash Receipt Here")).toBeInTheDocument();
  });
});
