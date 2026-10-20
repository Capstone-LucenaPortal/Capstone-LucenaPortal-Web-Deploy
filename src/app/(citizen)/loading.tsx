/**
 * Route-transition fallback. On a slow mobile connection — which is the common
 * case here — a navigation previously showed nothing at all until the next page
 * was ready, which reads as a dead tap.
 *
 * Deliberately minimal: a heavy skeleton that guesses at the next page's layout
 * is more jarring than a quiet line of text when the guess is wrong.
 */
export default function Loading() {
  return (
    <section style={{ padding: '80px clamp(16px, 5vw, 48px)', maxWidth: 1400, margin: '0 auto' }}>
      <p role="status" style={{ fontSize: 15, color: '#666666' }}>
        Loading…
      </p>
    </section>
  );
}
