'use client';

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, which
 * `app/error.tsx` cannot — it renders *inside* that layout.
 *
 * Because it replaces the layout, it must supply its own <html>/<body>, and it
 * cannot rely on globals.css having loaded. Everything here is inline on
 * purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#FFFFFF', color: '#333333' }}>
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>
            Lucena City Portal is temporarily unavailable
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#666666', marginBottom: 8 }}>
            Please try again in a moment. If it keeps happening, contact the Lucena City Hall
            trunkline.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: '#666666', marginBottom: 24 }}>
              Reference code: <code>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{ background: '#003DA5', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 16 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
