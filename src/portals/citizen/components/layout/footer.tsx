'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { catalogService } from '@/portals/citizen/lib/supabase/catalogs';
import {
  FACEBOOK_PAGE_URL,
  HELPDESK_EMAIL,
  resolveTrunkline,
  telHref,
} from '@/portals/citizen/lib/contact-info';

/**
 * The site footer, rendered by the root layout on every route.
 *
 * It previously lived inside `app/page.tsx`, so it appeared on the home page
 * only — meaning the Terms and Privacy links, which sign-up requires citizens
 * to have read, were unreachable from every other page in the portal.
 *
 * The old copy also told citizens to "call 122", a number sourced from nothing.
 * The trunkline now comes from `public_site_info`, which the LGU can edit.
 */
export default function SiteFooter() {
  const [trunkline, setTrunkline] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    catalogService
      .getSiteInfo()
      .then((info) => {
        if (!cancelled) setTrunkline(info?.trunkline ?? null);
      })
      .catch(() => {
        // A footer must never be the thing that breaks a page. The constant
        // fallback in resolveTrunkline covers this.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const phone = resolveTrunkline(trunkline);

  const linkStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textDecoration: 'none',
    textTransform: 'uppercase',
  };

  return (
    <footer
      data-on-dark
      style={{ background: '#0A3D5C', color: 'white', borderTop: '4px solid #C0272D' }}
    >
      <div style={{ maxWidth: 1800, margin: '0 auto', padding: '32px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Lucena City E-Services</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
            For any inquiries, please call{' '}
            <a href={telHref(phone)} style={{ color: 'white', fontWeight: 700, textDecoration: 'none' }}>
              {phone}
            </a>{' '}
            or email<br />
            <a href={`mailto:${HELPDESK_EMAIL}`} style={{ color: 'rgba(255,255,255,0.9)', textDecoration: 'none' }}>
              {HELPDESK_EMAIL}
            </a>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/citizens-charter" style={linkStyle}>Citizen&apos;s Charter</Link>
          <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>|</span>
          <Link href="/terms" style={linkStyle}>Terms of Service</Link>
          <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>|</span>
          <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>
          <span aria-hidden="true" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>|</span>
          <Link href="/verify" style={linkStyle}>Verify a Yellow Card</Link>
          <div style={{ display: 'flex', gap: 10, marginLeft: 8 }}>
            <a
              href={FACEBOOK_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Lucena City LGU on Facebook (opens in a new tab)"
              style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none', fontSize: 15, fontWeight: 700 }}
            >
              <span aria-hidden="true">f</span>
            </a>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 48px', fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>
        © 2026 Lucena City Portal. All rights reserved.
      </div>
    </footer>
  );
}
