'use client';

import type { ReactNode } from 'react';
import { yellowCardOfficeName } from '@/portals/citizen/lib/contact-info';
import type { VerifiedCard } from '@/portals/citizen/features/yellow-card/types';

/**
 * What a Verifier sees for a card the RPC found: one coloured verdict block and
 * the holder's name, sized to be read across a counter.
 *
 * The name is the second identifier. The Digital Card has no photo, so the
 * Verifier compares this name with the card and with a government ID — that
 * comparison against the city's own record, not the card image, is what stops a
 * copied QR printed beside a different name.
 */

type Verdict = {
  label: string;
  color: string;
  note: string;
  icon: ReactNode;
  /** Only a card that may be accepted is worth checking against an ID — on a
   * revoked or superseded one the answer is already "do not accept". */
  idCheck: boolean;
};

const ICON_PROPS = {
  width: 56,
  height: 56,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const CHECK_ICON = (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="10" />
    <path d="m8 12 3 3 5-6" />
  </svg>
);

const CROSS_ICON = (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6M9 9l6 6" />
  </svg>
);

const WARNING_ICON = (
  <svg {...ICON_PROPS}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const VERDICTS: Record<string, Verdict> = {
  active: {
    label: 'VALID',
    color: '#047857',
    note: 'This card is active and may be accepted.',
    icon: CHECK_ICON,
    idCheck: true,
  },
  revoked: {
    label: 'REVOKED',
    color: '#B91C1C',
    note: 'This card has been revoked. Do not accept it.',
    icon: CROSS_ICON,
    idCheck: false,
  },
  superseded: {
    label: 'SUPERSEDED',
    color: '#B45309',
    note: 'A newer card has replaced this one. Ask the holder for their current card.',
    icon: WARNING_ICON,
    idCheck: false,
  },
};

/** A status this page does not know yet still gets a readable, cautious answer
 * rather than a blank block — and never the "may be accepted" ID-check line. */
function verdictFor(status: string): Verdict {
  return (
    VERDICTS[status] ?? {
      label: status.toUpperCase(),
      color: '#4B5563',
      note: `Check with the ${yellowCardOfficeName()} before accepting this card.`,
      icon: WARNING_ICON,
      idCheck: false,
    }
  );
}

export default function VerificationVerdict({ card }: { card: VerifiedCard }) {
  const verdict = verdictFor(card.status);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          background: verdict.color,
          color: 'white',
          borderRadius: 12,
          padding: '32px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {verdict.icon}
        <h2 style={{ fontSize: 'clamp(36px, 11vw, 56px)', fontWeight: 900, letterSpacing: '0.04em', margin: 0 }}>
          {verdict.label}
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.5, maxWidth: 420, margin: 0 }}>{verdict.note}</p>
      </div>

      <div
        className="bg-white border border-[#DDDDDD] shadow-sm"
        style={{ borderRadius: 12, padding: '28px 32px', textAlign: 'center' }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#666666',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 8,
          }}
        >
          Card Holder
        </p>
        <p
          style={{
            fontSize: 'clamp(26px, 7vw, 38px)',
            fontWeight: 800,
            color: '#111827',
            lineHeight: 1.2,
            overflowWrap: 'anywhere',
          }}
        >
          {card.holder_name}
        </p>
        {verdict.idCheck && (
          <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.6, marginTop: 20 }}>
            This card carries no photo. Check that this name matches the name on the card and on
            the holder&apos;s government ID.
          </p>
        )}
      </div>
    </div>
  );
}
