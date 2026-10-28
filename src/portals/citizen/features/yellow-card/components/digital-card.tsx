'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ModalShell, { ModalCloseButton } from '@/portals/citizen/components/ui/modal-shell';
import { yellowCardOfficeName } from '@/portals/citizen/lib/contact-info';
import { digitalCardFace } from '@/portals/citizen/features/yellow-card/lib/digital-card';
import { CARD_ASPECT_RATIO, renderDigitalCard } from '@/portals/citizen/features/yellow-card/lib/render-digital-card';
import type { MyYellowCard, MyYellowCardApplication } from '@/portals/citizen/features/yellow-card/types';

interface Props {
  activeCard: MyYellowCard | null;
  /** The most recent revoked or superseded card, used only when there is no
   * active one. */
  nonActiveCard: MyYellowCard | null;
  /** The application `activeCard` was issued from — the source of the name
   * parts and address printed on the card. */
  application: MyYellowCardApplication | null | undefined;
}

type Drawing = { status: 'drawing' } | { status: 'ready'; url: string } | { status: 'failed' };

const FULL_SCREEN_HEADING_ID = 'digital-card-full-screen-heading';

/**
 * The Citizen's Digital Card on their profile: an image of their Yellow Card
 * they can show at a counter (Show card, full screen) or keep offline
 * (Download card, PNG).
 *
 * The QR encodes an absolute `/verify?token=…` link built from the current
 * origin, so a Verifier's phone camera opens Verification directly. `origin` is
 * read at render time rather than from an env var because the portal runs from
 * several hostnames, and the link must point back at the one the Citizen uses.
 *
 * Only an active card is drawn. A revoked or superseded card must never render
 * a scannable code: it would resolve to a "Revoked" verdict and read to the
 * holder as though the card still works.
 */
export default function DigitalCard({ activeCard, nonActiveCard, application }: Props) {
  if (activeCard) return <ActiveDigitalCard card={activeCard} application={application} />;

  if (nonActiveCard) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#FEF2F2', border: '2px solid #FCA5A5', borderRadius: 8, padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#B91C1C' }}>
          {nonActiveCard.status === 'revoked' ? 'This card has been revoked' : 'This card has been superseded'}
        </p>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#666666', fontFamily: 'monospace' }}>{nonActiveCard.card_number}</p>
        {nonActiveCard.revoked_reason && (
          <p style={{ fontSize: 13, color: '#7F1D1D', maxWidth: 420 }}>{nonActiveCard.revoked_reason}</p>
        )}
        <p style={{ fontSize: 13, color: '#666666', maxWidth: 420 }}>
          {nonActiveCard.status === 'revoked'
            ? `It can no longer be presented for city services. If you believe this is an error, contact the ${yellowCardOfficeName()} on the city trunkline published at the foot of every page.`
            : 'A newer card has replaced this one. Present your current card instead.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#F5F5F5', border: '2px dashed #CCCCCC', borderRadius: 8, padding: '40px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#666666' }}>Your digital Yellow Card will appear here</p>
      <p style={{ fontSize: 13, color: '#666666', maxWidth: 420 }}>Once your application is approved, a digital copy of your Yellow Card will be generated automatically and made available for viewing and download on this page.</p>
    </div>
  );
}

function ActiveDigitalCard({
  card,
  application,
}: {
  card: MyYellowCard;
  application: MyYellowCardApplication | null | undefined;
}) {
  // Which drawing is open full screen. Tied to the drawing, not a bare flag, so
  // a redraw closes the view instead of silently reopening it afterwards.
  const [shownKey, setShownKey] = useState<string | null>(null);
  // ModalShell re-runs its focus effect whenever onClose changes identity, which
  // would make it remember the dialog itself as the place to return focus to.
  const closeFullScreen = useCallback(() => setShownKey(null), []);

  // Keyed by value, not identity: the profile hands down fresh objects on every
  // reload, and the card should be redrawn only when what is printed changes.
  const faceKey = useMemo(() => JSON.stringify(digitalCardFace(card, application)), [card, application]);
  const drawKey = `${faceKey}|${card.verification_token}`;

  // The last drawing, tagged with what it was drawn from. One drawn for other
  // inputs counts as still drawing, so nothing stale is shown or downloaded.
  const [drawn, setDrawn] = useState<{ key: string; url: string | null } | null>(null);
  const drawing: Drawing =
    !drawn || drawn.key !== drawKey
      ? { status: 'drawing' }
      : drawn.url
        ? { status: 'ready', url: drawn.url }
        : { status: 'failed' };

  useEffect(() => {
    let cancelled = false;
    const link = `${window.location.origin}/verify?token=${encodeURIComponent(card.verification_token)}`;
    renderDigitalCard(JSON.parse(faceKey), link)
      .then((url) => {
        if (!cancelled) setDrawn({ key: drawKey, url });
      })
      .catch(() => {
        if (!cancelled) setDrawn({ key: drawKey, url: null });
      });
    return () => {
      cancelled = true;
    };
  }, [faceKey, drawKey, card.verification_token]);

  return (
    <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 360px) 1fr', gap: 24, alignItems: 'center' }}>
      <div>
        {drawing.status === 'ready' && (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL drawn in the browser
          <img
            src={drawing.url}
            alt={`Your Digital Yellow Card, card number ${card.card_number}. Its QR code opens this card's verification page.`}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          />
        )}
        {drawing.status === 'drawing' && (
          <div aria-hidden="true" style={{ width: '100%', aspectRatio: CARD_ASPECT_RATIO, background: '#F5F5F5', borderRadius: 10 }} />
        )}
        {drawing.status === 'failed' && (
          <p style={{ fontSize: 13, color: '#B45309', lineHeight: 1.6 }}>
            Your Digital Card could not be drawn on this device. Present the card number to city staff
            instead.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#047857' }}>Your card is active</p>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>Card Number</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#003DA5', fontFamily: 'monospace' }}>{card.card_number}</p>
        </div>
        <p style={{ fontSize: 13, color: '#666666', lineHeight: 1.6, maxWidth: 420 }}>
          Show this card when asked. The person checking it scans the QR code with their phone and
          compares your name with your ID. Keep it to yourself otherwise — anyone with the code can
          see your name and whether the card is valid.
        </p>
        {drawing.status === 'ready' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button
              type="button"
              onClick={() => setShownKey(drawKey)}
              style={{ background: '#003DA5', color: 'white', border: 'none', padding: '10px 22px', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Show card
            </button>
            <a
              href={drawing.url}
              download={`yellow-card-${card.card_number}.png`}
              style={{ display: 'inline-flex', alignItems: 'center', background: 'white', color: '#003DA5', border: '1px solid #003DA5', padding: '10px 22px', borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
            >
              Download card (PNG)
            </a>
          </div>
        )}
      </div>

      {shownKey === drawKey && drawing.status === 'ready' && (
        <ModalShell
          labelledBy={FULL_SCREEN_HEADING_ID}
          onClose={closeFullScreen}
          panelStyle={{ position: 'relative', width: '100vw', height: '100dvh', background: 'rgba(0, 0, 0, 0.92)', color: 'white', outline: 'none' }}
        >
          {/* Tap anywhere to close: the card fills the screen, so there is no
              backdrop left to tap. Escape and the close button are the
              keyboard paths. */}
          <div
            onClick={closeFullScreen}
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16, cursor: 'pointer' }}
          >
            <h2 id={FULL_SCREEN_HEADING_ID} className="sr-only">Your Digital Yellow Card</h2>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL drawn in the browser */}
            <img
              src={drawing.url}
              alt={`Your Digital Yellow Card, full screen, card number ${card.card_number}`}
              style={{ display: 'block', maxWidth: '96vw', maxHeight: '82dvh', width: 'auto', height: 'auto', borderRadius: 14 }}
            />
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>Tap anywhere to close</p>
          </div>
          <ModalCloseButton onClose={closeFullScreen} />
        </ModalShell>
      )}
    </div>
  );
}
