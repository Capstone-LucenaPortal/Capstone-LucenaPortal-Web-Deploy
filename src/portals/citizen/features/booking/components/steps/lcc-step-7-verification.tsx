'use client';

import { ReceiptLink } from '@/portals/citizen/features/receipts/components/receipt-link';

interface Props {
  referenceNumber: string;
  onGoToDashboard: () => void;
  onBookAnother: () => void;
}

function StatusStep({ label, status }: { label: string; status: 'complete' | 'pending' }) {
  const colors = {
    complete: { bg: '#F0FDF4', text: '#166534', icon: '✓' },
    pending: { bg: '#EFF6FF', text: '#003DA5', icon: '●' },
  };
  const config = colors[status];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 8,
        background: config.bg,
        color: config.text,
        fontSize: 14,
        fontWeight: 600,
        border: status === 'pending' ? '1px solid #003DA5' : '1px solid transparent',
      }}
    >
      <span style={{ fontSize: 18 }}>{config.icon}</span>
      <span>{label}</span>
      {status === 'pending' && (
        <span style={{ marginLeft: 'auto', fontSize: 10, textTransform: 'uppercase' }}>Processing</span>
      )}
    </div>
  );
}

export default function LCCStep7Verification({ referenceNumber, onGoToDashboard, onBookAnother }: Props) {
  return (
    <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ textAlign: 'center', padding: '48px 32px' }}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: '#F0FDF4',
          color: '#166534',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 40,
          margin: '0 auto 24px',
        }}
      >
        ⏳
      </div>
      <h2 style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 800, color: '#166534', marginBottom: 16 }}>
        Payment Submitted
      </h2>
      <p style={{ fontSize: 16, color: '#666666', lineHeight: 1.6, maxWidth: 500, margin: '0 auto 24px' }}>
        We&#39;ve received your downpayment proof. Your status is now <strong>Awaiting Staff Verification</strong>.
        Once verified, your booking will be officially confirmed.
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
      <div style={{ maxWidth: 400, margin: '0 auto 40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <StatusStep label="Booking Request" status="complete" />
          <StatusStep label="Downpayment Submitted" status="complete" />
          <StatusStep label="Payment Verification" status="pending" />
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#666666', marginBottom: 24 }}>
        Track this booking any time from your dashboard.
      </p>
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
