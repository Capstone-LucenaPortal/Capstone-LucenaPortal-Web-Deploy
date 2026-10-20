import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentsCard } from "./payments-card";
import type { BookingDocument, BookingPayment } from "../types";

function payment(over: Partial<BookingPayment> = {}): BookingPayment {
  return {
    id: "pay-1",
    kind: "downpayment",
    method: "gcash",
    amount: 15000,
    gcash_reference: "GC-4005-0003-7781",
    official_receipt_no: null,
    paid_at: "2026-08-10",
    submitted_at: "2026-08-10T09:46:39+08:00",
    recorded_by_name: null,
    verified_by_name: null,
    verified_at: null,
    rejected_reason: null,
    receipt_document_id: null,
    ...over,
  };
}

function document(over: Partial<BookingDocument> = {}): BookingDocument {
  return {
    id: "doc-1",
    kind: "org_document",
    payment_id: null,
    uploaded_at: "2026-08-11T09:00:00+08:00",
    mime_type: "application/pdf",
    size_bytes: 204800,
    verified_by_name: null,
    verified_at: null,
    superseded_by: null,
    ...over,
  };
}

describe("PaymentsCard — payments", () => {
  it("says no payment has been submitted, rather than rendering a broken table", () => {
    // Seventeen of the twenty-one sandbox bookings are in this state.
    render(<PaymentsCard payments={[]} documents={[]} rateTier="commercial" />);
    expect(
      screen.getByText("No payment has been submitted for this booking yet."),
    ).toBeInTheDocument();
  });

  it("renders a downpayment with its GCash reference", () => {
    render(
      <PaymentsCard payments={[payment()]} documents={[]} rateTier="commercial" />,
    );
    expect(screen.getByText("Downpayment")).toBeInTheDocument();
    expect(screen.getByText("GCash")).toBeInTheDocument();
    expect(screen.getByText("₱15,000.00")).toBeInTheDocument();
    expect(screen.getByText("GC-4005-0003-7781")).toBeInTheDocument();
  });

  it("falls back to the OR number when there is no GCash reference", () => {
    // A balance settled at the cashier's window.
    render(
      <PaymentsCard
        payments={[
          payment({
            kind: "balance",
            method: "cash",
            gcash_reference: null,
            official_receipt_no: "OR-9001",
          }),
        ]}
        documents={[]}
        rateTier="commercial"
      />,
    );
    expect(screen.getByText("OR-9001")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
  });

  it("distinguishes awaiting review, verified and rejected", () => {
    const { rerender } = render(
      <PaymentsCard payments={[payment()]} documents={[]} rateTier="commercial" />,
    );
    expect(screen.getByText("Awaiting review")).toBeInTheDocument();

    rerender(
      <PaymentsCard
        payments={[
          payment({
            verified_at: "2026-08-11T10:00:00+08:00",
            verified_by_name: "Maria Santos",
          }),
        ]}
        documents={[]}
        rateTier="commercial"
      />,
    );
    expect(screen.getByText(/Verified by Maria Santos/)).toBeInTheDocument();

    rerender(
      <PaymentsCard
        payments={[payment({ rejected_reason: "Screenshot is unreadable" })]}
        documents={[]}
        rateTier="commercial"
      />,
    );
    expect(
      screen.getByText(/Rejected — Screenshot is unreadable/),
    ).toBeInTheDocument();
  });

  it("renders the receipt button only when proof was attached", () => {
    const { rerender } = render(
      <PaymentsCard payments={[payment()]} documents={[]} rateTier="commercial" />,
    );
    expect(
      screen.queryByRole("button", { name: "View Receipt" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No image attached")).toBeInTheDocument();

    rerender(
      <PaymentsCard
        payments={[payment({ receipt_document_id: "doc-9" })]}
        documents={[]}
        rateTier="commercial"
      />,
    );
    expect(
      screen.getByRole("button", { name: "View Receipt" }),
    ).toBeInTheDocument();
  });
});

describe("PaymentsCard — documents", () => {
  it("says nothing has been uploaded rather than looking broken", () => {
    render(<PaymentsCard payments={[]} documents={[]} rateTier="commercial" />);
    expect(
      screen.getByText("No documents have been uploaded for this booking."),
    ).toBeInTheDocument();
  });

  it("links each document through the proxy route", () => {
    render(
      <PaymentsCard payments={[]} documents={[document()]} rateTier="commercial" />,
    );
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/staff/api/booking/documents/doc-1",
    );
    expect(screen.getByText("Organisation document")).toBeInTheDocument();
  });

  /** The row carries a raw byte count; the typography is the shared formatter's. */
  it("sizes an upload, and says nothing when the size is unknown", () => {
    const { rerender } = render(
      <PaymentsCard payments={[]} documents={[document()]} rateTier="commercial" />,
    );
    expect(screen.getByText(/200 KB/)).toBeInTheDocument();

    // An upload reservation that was abandoned before the file landed.
    rerender(
      <PaymentsCard
        payments={[]}
        documents={[document({ size_bytes: null })]}
        rateTier="commercial"
      />,
    );
    expect(screen.getByText("Organisation document")).toBeInTheDocument();
    expect(screen.queryByText(/KB/)).not.toBeInTheDocument();
  });

  it("strikes through a superseded document rather than hiding it", () => {
    // review_booking deliberately leaves a rejected document in place so the
    // citizen can supersede it, and the history is what the reviewer wants.
    render(
      <PaymentsCard
        payments={[]}
        documents={[document({ superseded_by: "doc-2" })]}
        rateTier="commercial"
      />,
    );
    const entry = screen.getByText(/Organisation document/).closest("div")!;
    expect(entry.className).toContain("line-through");
  });

  it("lists both a superseded document and its replacement", () => {
    // The count would say 1 here and the list says 2. That asymmetry is the
    // point — the card is labelled from the list.
    render(
      <PaymentsCard
        payments={[]}
        documents={[
          document({ id: "doc-2" }),
          document({ id: "doc-1", superseded_by: "doc-2" }),
        ]}
        rateTier="commercial"
      />,
    );
    expect(screen.getByText("Documents (2)")).toBeInTheDocument();
  });

  it("reads a GCash receipt's review state from the payment it proves", () => {
    // SCRUM-188: verify_payment stamps the payment, never the receipt row, so
    // the document's own verified_by is null even once the payment is verified.
    const receipt = document({
      id: "doc-9",
      kind: "gcash_receipt",
      payment_id: "pay-1",
    });
    const { rerender } = render(
      <PaymentsCard
        payments={[
          payment({
            receipt_document_id: "doc-9",
            verified_at: "2026-08-11T10:00:00+08:00",
            verified_by_name: "Juan Dela Cruz",
          }),
        ]}
        documents={[receipt]}
        rateTier="commercial"
      />,
    );
    const entry = () => screen.getByText("GCash receipt").closest("div")!;
    expect(entry()).toHaveTextContent("Payment verified by Juan Dela Cruz");
    expect(entry()).not.toHaveTextContent("Not yet reviewed");

    rerender(
      <PaymentsCard
        payments={[
          payment({
            receipt_document_id: "doc-9",
            rejected_reason: "Screenshot is unreadable",
          }),
        ]}
        documents={[receipt]}
        rateTier="commercial"
      />,
    );
    expect(entry()).toHaveTextContent("Payment rejected");

    rerender(
      <PaymentsCard
        payments={[payment({ receipt_document_id: "doc-9" })]}
        documents={[receipt]}
        rateTier="commercial"
      />,
    );
    expect(entry()).toHaveTextContent("Not yet reviewed");
  });

  it("finds a receipt's payment from either side of the link", () => {
    // The view gives both directions; trust whichever one is populated.
    render(
      <PaymentsCard
        payments={[
          payment({
            receipt_document_id: "doc-9",
            verified_at: "2026-08-11T10:00:00+08:00",
            verified_by_name: "Juan Dela Cruz",
          }),
        ]}
        documents={[document({ id: "doc-9", kind: "gcash_receipt" })]}
        rateTier="commercial"
      />,
    );
    expect(
      screen.getByText("GCash receipt").closest("div")!,
    ).toHaveTextContent("Payment verified by Juan Dela Cruz");
  });

  it("leaves an organisation document's review state to its own row", () => {
    render(
      <PaymentsCard
        payments={[
          payment({
            verified_at: "2026-08-11T10:00:00+08:00",
            verified_by_name: "Juan Dela Cruz",
          }),
        ]}
        documents={[document()]}
        rateTier="commercial"
      />,
    );
    expect(
      screen.getByText("Organisation document").closest("div")!,
    ).toHaveTextContent("Not yet reviewed");
  });

  it("says why a discount claim cannot be verified when there is no document", () => {
    // This is the state of every discounted booking in the sandbox, and it is
    // exactly why the review control in Task 10 will refuse.
    render(<PaymentsCard payments={[]} documents={[]} rateTier="discounted" />);
    expect(
      screen.getByText(/no organisation document has been uploaded/i),
    ).toBeInTheDocument();
  });

  it("does not warn about an organisation document on a commercial booking", () => {
    render(<PaymentsCard payments={[]} documents={[]} rateTier="commercial" />);
    expect(
      screen.queryByText(/no organisation document has been uploaded/i),
    ).not.toBeInTheDocument();
  });

  it("does not warn once the document is there", () => {
    render(
      <PaymentsCard payments={[]} documents={[document()]} rateTier="discounted" />,
    );
    expect(
      screen.queryByText(/no organisation document has been uploaded/i),
    ).not.toBeInTheDocument();
  });
});
