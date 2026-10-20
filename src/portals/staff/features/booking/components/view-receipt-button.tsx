"use client";

import { Button } from "@/portals/staff/components/ui/button";

/**
 * Opens one payment's proof through the session-gated proxy route.
 *
 * It used to open `/gcash-receipt-preview`, a placeholder page. The caller does
 * not render this at all when `receipt_document_id` is null — a balance
 * recorded at the cashier's window has an OR number and no uploaded image, and
 * a button that 404s would read as a broken route rather than as "there is
 * nothing to show".
 */
export function ViewReceiptButton({ documentId }: { documentId: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() =>
        window.open(
          `/staff/api/booking/documents/${documentId}`,
          "_blank",
          "noopener,noreferrer",
        )
      }
    >
      View Receipt
    </Button>
  );
}
