'use client';

import { useRouter } from 'next/navigation';
import { PRIVACY_SECTIONS } from '@/portals/citizen/features/content/lib/privacy-notice';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <section style={{ padding: '48px clamp(20px, 5vw, 48px) 80px', maxWidth: 900, margin: '0 auto' }}>
      <button
        onClick={() => router.back()}
        style={{ background: 'none', border: 'none', color: '#003DA5', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Back
      </button>

      <h1 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ fontSize: 13, color: '#666666', marginBottom: 24 }}>Last updated: September 2026</p>

      <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: '12px 16px', fontSize: 13, color: '#92400E', marginBottom: 32 }}>
        Note: This is placeholder content for development purposes and does not represent the final, legally reviewed Privacy Policy of the Lucena City E-Services Portal.
      </div>

      <div style={{ display: 'grid', gap: 28 }}>
        {PRIVACY_SECTIONS.map((s) => (
          <div key={s.title}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#333333', marginBottom: 8 }}>{s.title}</h2>
            <p style={{ fontSize: 14, color: '#555555', lineHeight: 1.8 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
