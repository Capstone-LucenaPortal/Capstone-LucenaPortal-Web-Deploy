'use client';

import { ReceiptLink } from '@/portals/citizen/features/receipts/components/receipt-link';
import { formatPHP } from '@/portals/citizen/features/booking/lib/schedule';

interface Props {
  referenceNumber: string;
  /** The discounted downpayment `bk_on_submit()` computed, payable only once the
   * Tier Claim is accepted. Null for a venue that needs a quote. */
  provisionalDownpayment: number | null;
  onGoToDashboard: () => void;
  onBookAnother: () => void;
}

/**
 * Shown once the organisation document is uploaded and the booking is in
 * `awaiting_tier_review` (DB l77b, SCRUM-198). There is deliberately no way to
 * pay from here: `submit_downpayment` accepts only `awaiting_payment`, which a
 * discounted booking reaches only once City Hall has decided its Tier Claim.
 * There is no Hold either — staff time never costs the citizen their date.
 */
export default function LCCStepTierReview({
  referenceNumber,
  provisionalDownpayment,
  onGoToDashboard,
  onBookAnother,
}: Props) {
  return (
    <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ textAlign: 'center', padding: '48px 32px' }}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: '#EFF6FF',
          color: '#003DA5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 40,
          margin: '0 auto 24px',
        }}
      >
        🔍
      </div>
      <h2 style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 800, color: '#003DA5', marginBottom: 16 }}>
        Discount Claim Under Review
      </h2>
      <p style={{ fontSize: 16, color: '#666666', lineHeight: 1.6, maxWidth: 500, margin: '0 auto 24px' }}>
        City Hall is checking your organisation document. No payment is due yet — you will only be
        asked to pay once your rate has been confirmed.
      </p>
      <div
        style={{
          background: '#F8FAFC',
          borderRadius: 12,
          padding: '20px 24px',
          maxWidth: 500,
          margin: '0 auto 24px',
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ fontSize: 12, color: '#666666', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>
          Your Booking Reference
        </div>
        <div style={{ fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 800, fontFamily: 'monospace', color: '#003DA5' }}>
          {referenceNumber}
        </div>
      </div>
      <div
        style={{
          background: '#F8FAFC',
          borderRadius: 12,
          padding: '24px',
          maxWidth: 500,
          margin: '0 auto 40px',
          textAlign: 'left',
          border: '1px solid #E2E8F0',
        }}
      >
        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#333333', marginBottom: 12 }}>What&#39;s Next?</h4>
        <ul style={{ fontSize: 13, color: '#666666', paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Your date stays held while City Hall reviews your claim, however long it takes.</li>
          {provisionalDownpayment != null ? (
            <li>
              Downpayment: <strong>{formatPHP(provisionalDownpayment)} if your discount claim is accepted</strong>.
              A notice in your portal inbox tells you when you can pay.
            </li>
          ) : (
            <li>If your discount claim is accepted, City Hall will send you a quote before you pay.</li>
          )}
          <li>If something is wrong with the document, you will be asked to upload a corrected one.</li>
        </ul>
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          className="inline-flex items-center justify-center bg-[#003DA5] text-white border-none rounded font-semibold cursor-pointer transition-all"
          onClick={onGoToDashboard}
          style={{ padding: '14px 32px' }}
        >
          Go to Dashboard
        </button>
        <ReceiptLink reference={referenceNumber} variant="button" />
        <button
          className="inline-flex items-center justify-center bg-transparent border border-[#003DA5] text-[#003DA5] rounded font-semibold cursor-pointer transition-all"
          onClick={onBookAnother}
          style={{ padding: '14px 32px' }}
        >
          Book Another Event
        </button>
      </div>
    </div>
  );
}
