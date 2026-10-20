'use client';

/** Acknowledgement Receipt (SCRUM-119 render half, DB layer `l66`).
 *
 * Renders the five elements IRR Rule VII §2(c) requires: the reference number,
 * the agency seal, the Officer of Record's name/unit/designation, and the date
 * and time of receipt in Asia/Manila time.
 *
 * Deliberately shows **no processing deadline**, for any service. §2(c) does
 * not list one, and RA 11032 §10 does not apply to an incident report at all —
 * a date on this page would read as a promise the receipt does not make.
 *
 * "Download" is the browser's own Save as PDF, driven by the print styles in
 * `globals.css`. No PDF library.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/portals/citizen/features/auth/components/protected-route';
import { Button } from '@/portals/citizen/components/ui/button';
import type { AcknowledgementReceipt } from '@/portals/citizen/features/receipts/types';
import {
  receiptService,
  receiptSealUrl,
  receiptServiceLabel,
} from '@/portals/citizen/features/receipts/lib/receipts';

type PageState = 'loading' | 'missing' | 'error' | 'ready';

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: '#666666',
  marginBottom: 6,
};

const VALUE: React.CSSProperties = {
  fontSize: 15,
  color: '#333333',
  lineHeight: 1.5,
};

function ReceiptContent() {
  const router = useRouter();
  const params = useParams<{ reference: string }>();
  const reference = decodeURIComponent(params.reference ?? '');

  const [state, setState] = useState<PageState>('loading');
  const [receipt, setReceipt] = useState<AcknowledgementReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await receiptService.getByReference(reference);
        if (cancelled) return;
        setReceipt(found);
        setState(found ? 'ready' : 'missing');
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Could not load your receipt right now. Please try again later.',
        );
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  if (state === 'loading') {
    return (
      <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: '#666666' }}>Loading your receipt…</p>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ padding: 16, borderRadius: 4, background: '#FDECEA', color: '#8A1C1C', fontSize: 14, marginBottom: 24 }}>
          {errorMessage}
        </div>
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </section>
    );
  }

  // No receipt for this reference. Submissions made before the receipt layer
  // shipped genuinely have none (DB ADR 0001), and a reference belonging to
  // someone else returns nothing too. Say so rather than render a stand-in.
  if (state === 'missing' || !receipt) {
    return (
      <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#003DA5', marginBottom: 16 }}>
          No Acknowledgement Receipt
        </h1>
        <p style={{ fontSize: 15, color: '#333333', lineHeight: 1.7, marginBottom: 12 }}>
          There is no acknowledgement receipt on file for <strong>{reference}</strong>.
        </p>
        <p style={{ fontSize: 14, color: '#666666', lineHeight: 1.7, marginBottom: 32 }}>
          Receipts are issued automatically for submissions made after this feature came
          into service. Submissions made before then were recorded without one, and the
          city does not issue a receipt after the fact. Your submission itself is
          unaffected — you can still track it from your dashboard.
        </p>
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </section>
    );
  }

  const sealUrl = receiptSealUrl(receipt.seal_path);

  return (
    <section style={{ padding: '48px clamp(16px, 5vw, 48px)', maxWidth: 900, margin: '0 auto' }}>
      <div
        className="receipt-noprint"
        style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}
      >
        <Button variant="primary" onClick={() => window.print()}>Print / Save as PDF</Button>
        <Button variant="ghost" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>

      <article
        className="receipt-sheet"
        style={{
          background: '#FFFFFF',
          border: '1px solid #DDDDDD',
          borderRadius: 4,
          padding: 'clamp(24px, 5vw, 48px)',
        }}
      >
        <header style={{ textAlign: 'center', borderBottom: '2px solid #003DA5', paddingBottom: 24, marginBottom: 32 }}>
          {sealUrl ? (
            <img
              src={sealUrl}
              alt=""
              style={{ width: 88, height: 88, objectFit: 'contain', margin: '0 auto 16px' }}
            />
          ) : null}
          <p style={{ fontSize: 15, fontWeight: 700, color: '#003DA5', marginBottom: 4 }}>
            {receipt.agency_name}
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#333333', letterSpacing: 1 }}>
            ACKNOWLEDGEMENT RECEIPT
          </h1>
        </header>

        <div style={{ display: 'grid', gap: 28, marginBottom: 32 }}>
          <div>
            <p style={LABEL}>Reference Number</p>
            <p style={{ ...VALUE, fontSize: 20, fontWeight: 700, color: '#003DA5', letterSpacing: 1 }}>
              {receipt.reference_number}
            </p>
          </div>

          <div>
            <p style={LABEL}>Submission Received</p>
            <p style={VALUE}>{receiptServiceLabel(receipt.service)}</p>
          </div>

          <div>
            <p style={LABEL}>Date and Time of Receipt</p>
            <p style={VALUE}>{receipt.received_at_manila}</p>
            <p style={{ fontSize: 12, color: '#666666', marginTop: 4 }}>Philippine Standard Time</p>
          </div>

          <div>
            <p style={LABEL}>Officer of Record</p>
            {receipt.officer_is_placeholder ? (
              <div
                style={{
                  border: '1px dashed #B45309',
                  background: '#FFF7E6',
                  borderRadius: 4,
                  padding: 16,
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#B45309', marginBottom: 8 }}>
                  ⚠ PENDING NOMINATION
                </p>
                <p style={{ fontSize: 14, color: '#333333', lineHeight: 1.6 }}>
                  No Officer of Record has been nominated for this service yet. This receipt
                  records the city&#39;s receipt of your submission; it does not name a
                  responsible officer.
                </p>
              </div>
            ) : (
              <>
                <p style={{ ...VALUE, fontWeight: 600 }}>{receipt.officer_full_name}</p>
                <p style={{ fontSize: 14, color: '#666666', marginTop: 2 }}>
                  {receipt.officer_designation}
                </p>
                <p style={{ fontSize: 14, color: '#666666' }}>{receipt.officer_unit}</p>
              </>
            )}
          </div>
        </div>

        <footer style={{ borderTop: '1px solid #DDDDDD', paddingTop: 20 }}>
          <p style={{ fontSize: 12, color: '#666666', lineHeight: 1.7 }}>
            This receipt acknowledges that the {receipt.agency_name} received the submission
            identified above on the date and time stated. It is issued under Rule VII §2(c)
            of the Implementing Rules and Regulations of Republic Act No. 11032.
          </p>
        </footer>
      </article>
    </section>
  );
}

export default function AcknowledgementReceiptPage() {
  return (
    <ProtectedRoute>
      <ReceiptContent />
    </ProtectedRoute>
  );
}
