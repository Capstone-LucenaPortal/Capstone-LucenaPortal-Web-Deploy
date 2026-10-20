'use client';

import { ReceiptLink } from '@/portals/citizen/features/receipts/components/receipt-link';

interface Props {
  referenceNumber: string;
  onGoToDashboard: () => void;
  onBookAnother: () => void;
}

export default function LCCStep5Pending({ referenceNumber, onGoToDashboard, onBookAnother }: Props) {
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
        📋
      </div>
      <h2 style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 800, color: '#003DA5', marginBottom: 16 }}>
        Awaiting Staff Quote
      </h2>
      <p style={{ fontSize: 16, color: '#666666', lineHeight: 1.6, maxWidth: 500, margin: '0 auto 24px' }}>
        This venue and classification combination requires a custom quote from our staff before payment can
        proceed. This can take anywhere from a few hours to a few business days.
      </p>
      <div
        style={{
          background: '#F8FAFC',
          borderRadius: 12,
          padding: '20px 24px',
          maxWidth: 500,
          margin: '0 auto 32px',
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
          <li>Staff will review your request and prepare a custom quote.</li>
          <li>Track your booking status any time from your dashboard.</li>
          <li>Once quoted, you&#39;ll be able to proceed with the downpayment.</li>
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
