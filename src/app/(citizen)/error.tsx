'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route-level error boundary.
 *
 * Without it an uncaught render error shows a blank page in production, with no
 * branding, no explanation and no way back — which for a citizen mid-application
 * is indistinguishable from the portal being down.
 *
 * `reset()` re-renders the segment, which is genuinely worth offering: most
 * failures here are a transient read against a view, not a broken component.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Console only. The message is raw and may name views, columns or ids, so
    // it must never be rendered to the citizen.
    console.error('Unhandled error in a portal route:', error);
  }, [error]);

  return (
    <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>
        Something went wrong on our side
      </h1>
      <p style={{ fontSize: 15, color: '#666666', lineHeight: 1.7, marginBottom: 8 }}>
        This page could not be displayed. Your application, report or booking has not been lost —
        anything you already submitted is safe.
      </p>
      {error.digest && (
        <p style={{ fontSize: 12, color: '#666666', marginBottom: 32 }}>
          Reference code: <code>{error.digest}</code>
        </p>
      )}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
        <button
          type="button"
          onClick={reset}
          style={{ background: '#003DA5', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{ background: 'white', color: '#003DA5', border: '1px solid #003DA5', padding: '12px 28px', borderRadius: 6, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}
        >
          Back to Home
        </Link>
      </div>
    </section>
  );
}
