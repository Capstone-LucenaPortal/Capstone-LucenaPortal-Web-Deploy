'use client';

import { useState, useRef } from 'react';
import { formatPHP } from '@/portals/citizen/features/booking/lib/schedule';
import { Button } from '@/portals/citizen/components/ui/button';
import { bookingService, BookingSubmitError } from '@/portals/citizen/features/booking/lib/booking';
import { validateUploadFile, type DocumentUploadProgress } from '@/portals/citizen/lib/storage/file-validation';
import { LIMITS } from '@/portals/citizen/lib/validation';

/** Session-scoped so a payment row minted just before a reload/offline blip is not
 * re-minted by resubmitting the form — the id survives until its receipt is confirmed. */
const PAYMENT_KEY = (bookingId: string) => `lcc-payment-${bookingId}`;

interface Props {
  bookingId: string;
  totalFee: number | null;
  downpaymentAmount: number | null;
  onSuccess: () => void;
}

type Phase = 'form' | 'submitting' | 'uploading' | 'upload-failed';

export default function LCCStep6Payment({ bookingId, totalFee, downpaymentAmount, onSuccess }: Props) {
  const [gcashReference, setGcashReference] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState('');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  // Held across retries so a failed/interrupted attempt resumes instead of re-reserving a
  // storage row or re-uploading bytes that already landed. Reset only when a different file
  // is picked — a retry on the SAME file must keep whatever progress was already made.
  const uploadProgress = useRef<DocumentUploadProgress>({});

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = await validateUploadFile(file, 'imageOrPdf');
    if (problem) {
      setFileError(problem);
      return;
    }
    setFileError('');
    uploadProgress.current = {};
    setReceiptFile(file);
  }

  const attemptUpload = async (pmtId: string, file: File) => {
    setPhase('uploading');
    try {
      await bookingService.uploadBookingDocument(bookingId, 'gcash_receipt', file, pmtId, uploadProgress.current);
      // The receipt is confirmed as attached — the payment id no longer needs to survive
      // a reload, so a later visit to this step (a fresh gcashReference) mints a new one.
      sessionStorage.removeItem(PAYMENT_KEY(bookingId));
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload your receipt. Please try again.');
      setPhase('upload-failed');
    }
  };

  const canSubmit = gcashReference.trim().length > 0 && !!receiptFile;

  const handleSubmit = async () => {
    if (!canSubmit || !receiptFile) return;
    setError('');
    setPhase('submitting');
    try {
      // A payment id minted just before an interruption (reload, offline blip during the
      // receipt upload) survives in sessionStorage, so resubmitting the form here reuses
      // it instead of calling submit_downpayment again and creating a second payment row.
      let pmtId = sessionStorage.getItem(PAYMENT_KEY(bookingId)) ?? undefined;
      if (!pmtId) {
        const payment = await bookingService.submitDownpayment(bookingId, gcashReference.trim());
        pmtId = payment.id;
        sessionStorage.setItem(PAYMENT_KEY(bookingId), pmtId);
      }
      setPaymentId(pmtId);
      await attemptUpload(pmtId, receiptFile);
    } catch (err) {
      setError(
        err instanceof BookingSubmitError
          ? err.message
          : 'We could not submit your payment right now. Please try again later.',
      );
      setPhase('form');
    }
  };

  const handleRetryUpload = () => {
    if (paymentId && receiptFile) void attemptUpload(paymentId, receiptFile);
  };

  return (
    <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>Payment Submission</h2>
      <p style={{ color: '#666666', marginBottom: 24, fontSize: 14 }}>
        Please pay the downpayment below to secure your slot.
      </p>

      {error && phase === 'form' && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: 16, borderRadius: 4, marginBottom: 24, fontSize: 13 }}>
          {error}
        </div>
      )}

      {phase === 'upload-failed' && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', padding: 16, borderRadius: 4, marginBottom: 24 }}>
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            Your payment was recorded, but we could not upload your receipt: {error}
          </p>
          <Button variant="primary" onClick={handleRetryUpload}>Retry Upload</Button>
        </div>
      )}

      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32 }}>
        {/* Payment instructions.
            What stood here was a mock QR — a grey box with a phone emoji —
            under the heading "SCAN TO PAY VIA GCASH", captioned "Merchant ID:
            LCC-2026-QR". None of it corresponded to a real payment target. On a
            live government site that is not a placeholder, it is an instruction
            to send money into the void, and a citizen who "scanned" it and paid
            someone else would have had the portal's word for it.

            It is replaced with the truthful process rather than a nicer-looking
            fake. Restore a QR here only when the LGU supplies a real merchant
            code — ideally from public_site_info so it needs no code deploy. */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 24, background: '#fff' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#003DA5', marginBottom: 12, letterSpacing: '0.05em' }}>HOW TO PAY</p>
          <ol style={{ fontSize: 13, color: '#333333', lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
            <li>Pay the downpayment at the Lucena City Hall cashier, or through the payment channel City Hall gives you when they confirm your booking.</li>
            <li>Keep the official receipt or the GCash reference number.</li>
            <li>Enter that reference number below and upload a photo of the receipt.</li>
          </ol>
          <p style={{ fontSize: 12, color: '#666666', marginTop: 16, lineHeight: 1.6 }}>
            Staff verify every payment against the city&apos;s own records before your booking is
            confirmed. Never send money to an account that was not given to you by City Hall.
          </p>
        </div>
        {/* Payment Info */}
        <div>
          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: '#166534', marginBottom: 4, fontWeight: 600 }}>REQUIRED DOWNPAYMENT</div>
            <div style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 800, color: '#166534' }}>
              {downpaymentAmount != null ? formatPHP(downpaymentAmount) : '—'}
            </div>
            <div style={{ fontSize: 11, color: '#166534', marginTop: 8 }}>
              Total Venue Fee: {totalFee != null ? formatPHP(totalFee) : '—'}
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="booking-gcash-reference" className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8 }}>Reference Number</label>
            <input
              id="booking-gcash-reference"
              className="w-full bg-white border border-[#CCCCCC] rounded text-[15px] text-[#333333] font-sans transition-all focus:outline-none focus:border-[#003DA5]"
              style={{ padding: '12px 16px' }}
              placeholder="Enter GCash Ref #"
              value={gcashReference}
              onChange={(e) => setGcashReference(e.target.value)}
              disabled={phase !== 'form'}
              maxLength={LIMITS.reference}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="booking-payment-receipt" className="block text-sm font-semibold text-[#333333]" style={{ display: 'block', marginBottom: 8 }}>Upload Proof of Payment</label>
            <div
              style={{
                border: '2px dashed #E2E8F0',
                borderRadius: 8,
                padding: '24px',
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
                background: receiptFile ? '#F0FDF4' : 'white',
                borderColor: receiptFile ? '#86EFAC' : '#E2E8F0',
              }}
            >
              <input
                id="booking-payment-receipt"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFile}
                disabled={phase !== 'form'}
                style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
              />
              <div style={{ fontSize: 24, marginBottom: 8 }}>{receiptFile ? '✅' : '📸'}</div>
              <span style={{ fontSize: 13, color: receiptFile ? '#166534' : '#666666', fontWeight: receiptFile ? 600 : 400 }}>
                {receiptFile ? `Selected: ${receiptFile.name}` : 'Click to upload or drag screenshot'}
              </span>
            </div>
            {fileError && <p style={{ color: '#C62828', fontSize: 11, marginTop: 4 }}>{fileError}</p>}
          </div>
        </div>
      </div>
      <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 16, marginBottom: 24, borderLeft: '4px solid #007DFE' }}>
        <p style={{ fontSize: 13, color: '#333333', lineHeight: 1.5, margin: 0 }}>
          <strong>Notice:</strong> Your booking status will remain &quot;Payment Verification&quot; until our staff
          verifies the transaction.
        </p>
      </div>
      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={!canSubmit || phase !== 'form'}
        loading={phase === 'submitting' || phase === 'uploading'}
        className="w-full text-base font-bold rounded-lg"
        style={{ paddingTop: 16, paddingBottom: 16 }}
      >
        {phase === 'submitting' ? 'Submitting payment…' : phase === 'uploading' ? 'Uploading receipt…' : 'Submit Downpayment Proof'}
      </Button>
    </div>
  );
}
