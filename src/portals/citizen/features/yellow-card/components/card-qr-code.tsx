'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  /** `my_yellow_cards.verification_token`. The view exposes this column
   * specifically so the citizen portal can encode it here. */
  verificationToken: string;
  cardNumber: string;
}

/**
 * The scannable half of a Yellow Card.
 *
 * The QR encodes an absolute `/verify?token=…` URL rather than the bare token,
 * so any phone camera opens the verification page directly — a barangay
 * official should not have to know there is a portal, let alone find it.
 *
 * `origin` is read at render time instead of from an env var because the portal
 * runs from several hostnames (local, preview, production) and a QR printed
 * from one must point back at the one the citizen is actually using.
 */
export default function CardQrCode({ verificationToken, cardNumber }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!verificationToken) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const target = `${origin}/verify?token=${encodeURIComponent(verificationToken)}`;

    QRCode.toDataURL(target, {
      // Level M tolerates a scuffed phone screen or a poor print without
      // inflating the module count to the point of being hard to scan.
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
      color: { dark: '#003DA5', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [verificationToken]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: '#FFFBEB',
        border: '2px solid #FDB913',
        borderRadius: 8,
        padding: '28px 24px',
        textAlign: 'center',
      }}
    >
      {dataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt={`QR code for Yellow Card ${cardNumber}. Scanning it opens this card's verification page.`}
          width={220}
          height={220}
          style={{ display: 'block', borderRadius: 4 }}
        />
      )}

      {!dataUrl && !failed && (
        <div style={{ width: 220, height: 220, background: '#FFFFFF', borderRadius: 4 }} aria-hidden="true" />
      )}

      {failed && (
        <p style={{ fontSize: 13, color: '#B45309', maxWidth: 420 }}>
          The QR code could not be generated on this device. Present the Card Number below to city
          staff instead.
        </p>
      )}

      <p style={{ fontSize: 20, fontWeight: 800, color: '#003DA5', fontFamily: 'monospace' }}>
        {cardNumber}
      </p>

      <p style={{ fontSize: 12, color: '#666666', maxWidth: 420, lineHeight: 1.6 }}>
        City staff can scan this code to confirm your card is valid. Keep it private — anyone with
        this code can look up your name, barangay and card status.
      </p>
    </div>
  );
}
