import { formatDateTime, formatFileSize } from "@/portals/staff/lib/utils";
import { formatCurrency } from "../lib/money";
import {
  DOC_KIND_LABELS,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
} from "../lib/status";
import { ViewReceiptButton } from "./view-receipt-button";
import type { BookingDocument, BookingPayment, RateTier } from "../types";

/**
 * The payment ledger, chronological, with the document list beneath it.
 *
 * ⚠️ The document list and `staff_bookings.document_count` are deliberately
 * asymmetric, and this card is labelled from the LIST:
 *
 *   document_count          superseded_by IS NULL AND uploaded_at IS NOT NULL
 *   staff_booking_documents uploaded_at IS NOT NULL
 *
 * So a booking whose citizen replaced a rejected organisation document shows
 * `document_count = 1` and lists two rows. That is correct, and l52 set the
 * precedent. Neither side counts an abandoned upload reservation.
 */
export function PaymentsCard({
  payments,
  documents,
  rateTier,
}: {
  payments: BookingPayment[];
  documents: BookingDocument[];
  rateTier: RateTier;
}) {
  const hasOrgDocument = documents.some((d) => d.kind === "org_document");

  return (
    <div className="space-y-8">
      <section>
        <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Payments ({payments.length})
        </h4>
        {payments.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No payment has been submitted for this booking yet.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-500">Kind</th>
                  <th className="px-3 py-2 font-medium text-gray-500">Method</th>
                  <th className="px-3 py-2 font-medium text-gray-500">Amount</th>
                  <th className="px-3 py-2 font-medium text-gray-500">Reference</th>
                  <th className="px-3 py-2 font-medium text-gray-500">Status</th>
                  <th className="px-3 py-2 font-medium text-gray-500">Proof</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-3 py-2 text-gray-900">
                      {PAYMENT_KIND_LABELS[payment.kind]}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {PAYMENT_METHOD_LABELS[payment.method]}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {payment.gcash_reference ??
                        payment.official_receipt_no ??
                        "—"}
                    </td>
                    <td className="px-3 py-2">
                      <PaymentState payment={payment} />
                    </td>
                    <td className="px-3 py-2">
                      {/* Absent for a balance recorded at the cashier's window:
                          it has an OR number and no uploaded image. */}
                      {payment.receipt_document_id ? (
                        <ViewReceiptButton
                          documentId={payment.receipt_document_id}
                        />
                      ) : (
                        <span className="text-xs text-gray-500">
                          No image attached
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Documents ({documents.length})
        </h4>
        {documents.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No documents have been uploaded for this booking.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2"
              >
                <div className={document.superseded_by ? "line-through opacity-60" : ""}>
                  <p className="text-sm font-medium text-gray-900">
                    {DOC_KIND_LABELS[document.kind]}
                    {document.superseded_by && " · replaced"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Uploaded {formatDateTime(document.uploaded_at)}
                    {document.size_bytes !== null &&
                      ` · ${formatFileSize(document.size_bytes)}`}
                    {` · ${reviewState(document, payments)}`}
                  </p>
                </div>
                <a
                  href={`/staff/api/booking/documents/${document.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-lucena-blue hover:underline"
                >
                  Open
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* This is why the review control will refuse. review_booking's lookup
            requires an un-superseded, uploaded org_document and raises P0002
            without one — which is every discounted booking in the sandbox. */}
        {rateTier === "discounted" && !hasOrgDocument && (
          <p className="mt-3 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            This booking claims the discounted rate but no organisation document
            has been uploaded, so the claim cannot be verified yet.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * A GCash receipt is reviewed by reviewing its payment: verify_payment stamps
 * `booking_payments`, never the receipt's own row, so a receipt whose payment
 * was verified still has a null `verified_by`. Its state is the payment's.
 * The link is held on both sides; either one is enough.
 */
function reviewState(
  document: BookingDocument,
  payments: BookingPayment[],
): string {
  if (document.verified_by_name) {
    return `Accepted by ${document.verified_by_name}`;
  }
  const payment =
    document.kind === "gcash_receipt"
      ? payments.find(
          (p) =>
            p.id === document.payment_id || p.receipt_document_id === document.id,
        )
      : undefined;
  if (payment?.rejected_reason) return "Payment rejected";
  if (payment?.verified_at) {
    return payment.verified_by_name
      ? `Payment verified by ${payment.verified_by_name}`
      : "Payment verified";
  }
  return "Not yet reviewed";
}

function PaymentState({ payment }: { payment: BookingPayment }) {
  if (payment.rejected_reason) {
    return (
      <span className="text-xs text-red-700">
        Rejected — {payment.rejected_reason}
      </span>
    );
  }
  if (payment.verified_at) {
    return (
      <span className="text-xs text-green-700">
        Verified
        {payment.verified_by_name && ` by ${payment.verified_by_name}`}
        {` · ${formatDateTime(payment.verified_at)}`}
      </span>
    );
  }
  return <span className="text-xs text-yellow-700">Awaiting review</span>;
}
