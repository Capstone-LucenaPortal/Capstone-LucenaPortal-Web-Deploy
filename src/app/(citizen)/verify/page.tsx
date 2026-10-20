'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { yellowCardOfficeName } from '@/portals/citizen/lib/contact-info';
import type { VerifiedCard } from '@/portals/citizen/features/yellow-card/types';
import { verifyCard } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import { formatManilaDate } from '@/shared/dates/manila';

/**
 * Public Yellow Card verification.
 *
 * Deliberately NOT wrapped in `ProtectedRoute`. The person scanning the QR is a
 * barangay official or an inspector standing in front of the card holder — they
 * are signed out, and usually not a portal user at all. `verify_yellow_card` is
 * the system's only anon-callable read RPC precisely so this can work without
 * granting any table access.
 *
 * The page shows exactly what the RPC returns and nothing more. It never
 * explains WHY a token failed: the RPC returns zero rows for an unknown token,
 * a malformed token and a deleted card alike, and reproducing that
 * indistinguishability here is the point — anything finer would let someone
 * probing tokens tell "not a card" from "a card, but revoked".
 */

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; card: VerifiedCard }
  | { status: 'not-found' };

const STATUS_DISPLAY: Record<string, { label: string; color: string; note: string }> = {
  active: {
    label: 'Valid',
    color: '#047857',
    note: 'This card is active and may be accepted.',
  },
  revoked: {
    label: 'Revoked',
    color: '#B91C1C',
    note: 'This card has been revoked and must not be accepted.',
  },
  superseded: {
    label: 'Superseded',
    color: '#B45309',
    note: 'A newer card has replaced this one. Ask the holder for their current card.',
  },
};

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    verifyCard(token)
      .then((card) => {
        if (cancelled) return;
        setState(card ? { status: 'found', card } : { status: 'not-found' });
      })
      .catch(() => {
        // verifyCard already collapses every failure to null; this is only
        // reached on an unexpected throw. Same undifferentiated answer.
        if (!cancelled) setState({ status: 'not-found' });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const cardStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #DDDDDD',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '28px 32px',
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: 4,
  };

  const fieldValue: React.CSSProperties = {
    fontSize: 16,
    color: '#111827',
    fontWeight: 600,
  };

  return (
    <section style={{ padding: '48px clamp(16px, 5vw, 48px) 80px', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'clamp(26px, 5vw, 36px)', fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>
        Yellow Card Verification
      </h1>
      <p style={{ fontSize: 15, color: '#666666', marginBottom: 32, lineHeight: 1.6 }}>
        Scan the QR code on a Lucena City Yellow Card to check whether it is currently valid.
      </p>

      {state.status === 'idle' && (
        <div style={cardStyle}>
          <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7 }}>
            No card code was provided. Scan the QR code printed on the card, or open the link it
            contains, to verify it.
          </p>
        </div>
      )}

      {state.status === 'loading' && (
        <p role="status" style={{ fontSize: 15, color: '#666666' }}>
          Checking this card…
        </p>
      )}

      {state.status === 'not-found' && (
        <div
          role="alert"
          style={{ ...cardStyle, borderLeft: '4px solid #B91C1C' }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#B91C1C', marginBottom: 8 }}>
            This code is not recognised
          </h2>
          <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7 }}>
            No Lucena City Yellow Card matches this code. Do not accept the card on the strength of
            this page. If you believe this is an error, contact the {yellowCardOfficeName()} on the
            city trunkline published at the foot of every page.
          </p>
        </div>
      )}

      {state.status === 'found' && (
        <div
          style={{
            ...cardStyle,
            borderLeft: `4px solid ${STATUS_DISPLAY[state.card.status]?.color ?? '#6B7280'}`,
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <span
              style={{
                display: 'inline-block',
                background: `${STATUS_DISPLAY[state.card.status]?.color ?? '#6B7280'}1A`,
                color: STATUS_DISPLAY[state.card.status]?.color ?? '#374151',
                fontSize: 13,
                fontWeight: 800,
                padding: '6px 14px',
                borderRadius: 999,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {STATUS_DISPLAY[state.card.status]?.label ?? state.card.status}
            </span>
            <p style={{ fontSize: 14, color: '#374151', marginTop: 10, lineHeight: 1.6 }}>
              {STATUS_DISPLAY[state.card.status]?.note ??
                `Check with the ${yellowCardOfficeName()} before accepting this card.`}
            </p>
          </div>

          <dl style={{ display: 'grid', gap: 18, margin: 0 }}>
            <div>
              <dt style={fieldLabel}>Card Holder</dt>
              <dd style={{ ...fieldValue, margin: 0 }}>{state.card.holder_name}</dd>
            </div>
            <div>
              <dt style={fieldLabel}>Barangay</dt>
              <dd style={{ ...fieldValue, margin: 0 }}>{state.card.barangay_name}</dd>
            </div>
            <div>
              <dt style={fieldLabel}>Card Number</dt>
              <dd style={{ ...fieldValue, margin: 0, fontFamily: 'monospace' }}>
                {state.card.card_number}
              </dd>
            </div>
            <div>
              <dt style={fieldLabel}>Valid From</dt>
              <dd style={{ ...fieldValue, margin: 0 }}>{formatManilaDate(state.card.valid_from)}</dd>
            </div>
          </dl>

          <p style={{ fontSize: 12, color: '#666666', marginTop: 24, lineHeight: 1.6 }}>
            Check that the name and card number above match the physical card you were handed.
          </p>
        </div>
      )}
    </section>
  );
}

export default function VerifyPage() {
  // `useSearchParams` requires a Suspense boundary in the App Router; without
  // one the whole route opts out of static rendering.
  return (
    <Suspense fallback={<section style={{ padding: 48 }}><p>Loading…</p></section>}>
      <VerifyContent />
    </Suspense>
  );
}
