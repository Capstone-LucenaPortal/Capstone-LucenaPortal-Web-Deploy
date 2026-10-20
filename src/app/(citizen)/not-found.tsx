import Link from 'next/link';

export const metadata = { title: 'Page not found' };

/**
 * 404. Without this the App Router serves its unstyled default — a bare
 * "This page could not be found" on a white page, with no way back into the
 * portal and nothing identifying it as a Lucena City site.
 */
export default function NotFound() {
  return (
    <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
      <p style={{ fontSize: 64, fontWeight: 800, color: '#003DA5', lineHeight: 1, marginBottom: 16 }}>404</p>
      <h1 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>
        We couldn&apos;t find that page
      </h1>
      <p style={{ fontSize: 15, color: '#666666', lineHeight: 1.7, marginBottom: 32 }}>
        The page may have been moved or removed. If you followed a link from somewhere else in the
        portal, please let us know.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href="/"
          style={{ background: '#003DA5', color: 'white', padding: '12px 28px', borderRadius: 6, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}
        >
          Back to Home
        </Link>
        <Link
          href="/dashboard"
          style={{ background: 'white', color: '#003DA5', border: '1px solid #003DA5', padding: '12px 28px', borderRadius: 6, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}
        >
          My Dashboard
        </Link>
      </div>
    </section>
  );
}
