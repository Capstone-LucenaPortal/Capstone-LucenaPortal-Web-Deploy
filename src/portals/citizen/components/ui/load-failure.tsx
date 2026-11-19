'use client';

import { Button } from '@/portals/citizen/components/ui/button';

interface Props {
  /** "We couldn't load your …", naming what is missing. */
  heading: string;
  /** The service's message, shown as is. */
  message: string;
  onRetry: () => void;
  /** True while the retry is under way. */
  retrying?: boolean;
}

/**
 * A summary tile's body when a read it counts failed: a low number or "Not
 * Applied" would misstate what the citizen has. The tab for the failed read
 * carries the message and the retry, so this stays short.
 */
export function TileLoadFailure() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 190 }}>
      <div aria-hidden="true" style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#666666' }}>Couldn&apos;t load</div>
    </div>
  );
}

/**
 * Stands in for a section's list, and for its empty state, when the read
 * behind it failed: "couldn't load" must not look like "nothing yet" (#110).
 * The section-sized counterpart of `/yellow-card`'s "We couldn't check your
 * application" screen (#91).
 */
export default function LoadFailure({ heading, message, onRetry, retrying = false }: Props) {
  return (
    <div style={{ background: 'white', border: '1px solid #DDDDDD', borderRadius: 8, padding: '48px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textAlign: 'center' }}>
      <div aria-hidden="true" style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
      <p style={{ fontSize: 17, fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>{heading}</p>
      <p role="alert" style={{ fontSize: 15, color: '#666666', marginBottom: 24 }}>{message}</p>
      {/* Not `loading`: its spinner replaces the label, leaving the button unnamed. */}
      <Button variant="primary" onClick={onRetry} disabled={retrying}>{retrying ? 'Trying again…' : 'Try again'}</Button>
    </div>
  );
}
