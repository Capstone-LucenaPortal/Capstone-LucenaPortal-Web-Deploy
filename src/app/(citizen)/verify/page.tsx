'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { yellowCardOfficeName } from '@/portals/citizen/lib/contact-info';
import type { VerifiedCard } from '@/portals/citizen/features/yellow-card/types';
import { verifyCard } from '@/portals/citizen/features/yellow-card/lib/yellow-card';
import VerificationVerdict from '@/portals/citizen/features/yellow-card/components/verification-verdict';

/**
 * Public Yellow Card Verification.
 *
 * Deliberately NOT wrapped in `ProtectedRoute`. The Verifier opening the QR is a
 * barangay official, an inspector or a clerk standing in front of the card holder —
 * they are signed out, and usually not a portal user at all. `verify_yellow_card` is
 * the system's only anon-callable read RPC precisely so this can work without
 * granting any table access.
 *
 * A found card shows its verdict and the holder's name and nothing else, because
 * anyone holding the QR's link can open this page.
 *
 * It never explains WHY a token failed: the RPC returns zero rows for an unknown
 * token, a malformed token and a deleted card alike, and reproducing that
 * indistinguishability here is the point — anything finer would let someone
 * probing tokens tell "not a card" from "a card, but revoked".
 *
 * A check that could not be made (no signal, a timeout, a 5xx) is the one other
 * answer, and it gives no verdict on the card: telling a Verifier on a weak
 * signal "do not accept" would turn away a genuine holder (issue #52). It leaks
 * nothing, because a failed request looks the same for every token.
 *
 * There is no manual entry: typing a card number would let anyone look up names
 * by guessing.
 */

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; card: VerifiedCard }
  | { status: 'not-found' }
  | { status: 'unavailable' };

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<State>({ status: 'idle' });
  // Bumped by Retry to re-run the check for the same token without a reload.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    verifyCard(token)
      .then((result) => {
        if (cancelled) return;
        setState(result.kind === 'found' ? { status: 'found', card: result.card } : { status: result.kind });
      })
      .catch(() => {
        // An unexpected throw says nothing about the card either.
        if (!cancelled) setState({ status: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const panelStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #DDDDDD',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '28px 32px',
  };

  return (
    <section style={{ padding: '32px clamp(16px, 5vw, 48px) 80px', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>
        Yellow Card Verification
      </h1>

      {state.status === 'idle' && (
        <div style={panelStyle}>
          <p style={{ fontSize: 16, color: '#374151', lineHeight: 1.7 }}>
            Open your phone&apos;s camera app and point it at the QR code on the holder&apos;s
            Digital Card. The link it opens will show whether the card is valid.
          </p>
        </div>
      )}

      {state.status === 'loading' && (
        <p role="status" style={{ fontSize: 15, color: '#666666' }}>
          Checking this card…
        </p>
      )}

      {state.status === 'not-found' && (
        <div role="alert" style={{ ...panelStyle, borderLeft: '6px solid #B91C1C' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#B91C1C', marginBottom: 8 }}>
            This code is not recognised
          </h2>
          <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7 }}>
            No Lucena City Yellow Card matches this code. Do not accept the card on the strength of
            this page. If you believe this is an error, contact the {yellowCardOfficeName()} on the
            city trunkline published at the foot of every page.
          </p>
        </div>
      )}

      {state.status === 'unavailable' && (
        <div role="alert" style={{ ...panelStyle, borderLeft: '6px solid #6B7280' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#374151', marginBottom: 8 }}>
            Couldn&apos;t check this card right now
          </h2>
          <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, marginBottom: 20 }}>
            This page could not reach the city&apos;s records, so it cannot say anything about this
            card yet. Check your connection and try again.
          </p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="inline-flex items-center justify-center bg-lucena-blue text-white border-none rounded text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#002566]"
            style={{ padding: '12px 28px', background: '#003DA5', width: '100%' }}
          >
            Try Again
          </button>
        </div>
      )}

      {state.status === 'found' && <VerificationVerdict card={state.card} />}
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
