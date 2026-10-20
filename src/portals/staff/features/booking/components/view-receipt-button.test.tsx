import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewReceiptButton } from "./view-receipt-button";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ViewReceiptButton", () => {
  it("opens the document through the proxy route, not a signed URL", () => {
    // A signed URL is a bearer token; the proxy keeps the credential on the
    // server and puts only a document id in front of the browser.
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ViewReceiptButton documentId="doc-1" />);
    fireEvent.click(screen.getByRole("button", { name: "View Receipt" }));

    expect(openSpy).toHaveBeenCalledWith(
      "/staff/api/booking/documents/doc-1",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
