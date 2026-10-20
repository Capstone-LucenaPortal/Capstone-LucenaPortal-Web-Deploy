'use client';

/** Link to a submission's Acknowledgement Receipt.
 *
 * Used from the three submission success screens and from the citizen's
 * dashboard history. The receipt is issued by a trigger on insert, so it
 * already exists by the time a success screen renders and the link can be
 * unconditional there. The dashboard shows older submissions too, which may
 * predate the receipt layer, so it decides separately whether to render this.
 */

import Link from 'next/link';

interface ReceiptLinkProps {
  reference: string;
  /** `inline` suits a list row; `button` suits a success screen. */
  variant?: 'inline' | 'button';
}

export function ReceiptLink({ reference, variant = 'inline' }: ReceiptLinkProps) {
  const href = `/receipt/${encodeURIComponent(reference)}`;

  if (variant === 'button') {
    return (
      <Link
        href={href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px 24px',
          fontSize: 15,
          fontWeight: 700,
          color: '#003DA5',
          border: '2px solid #003DA5',
          borderRadius: 4,
          textDecoration: 'none',
        }}
      >
        View Acknowledgement Receipt
      </Link>
    );
  }

  return (
    <Link
      href={href}
      style={{ fontSize: 13, fontWeight: 600, color: '#003DA5', textDecoration: 'underline' }}
    >
      Acknowledgement Receipt
    </Link>
  );
}
