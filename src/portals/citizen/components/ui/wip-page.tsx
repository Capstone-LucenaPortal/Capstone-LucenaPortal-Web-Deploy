'use client';

import { useRouter } from 'next/navigation';

interface WipPageProps {
  title: string;
  description: string;
}

export default function WipPage({ title, description }: WipPageProps) {
  const router = useRouter();

  return (
    <section style={{ padding: '48px 48px 80px', maxWidth: 1000, margin: '0 auto' }}>
      <button
        onClick={() => router.push('/')}
        style={{ background: 'none', border: 'none', color: '#003DA5', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to Home
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: 40, fontWeight: 700, color: '#003DA5', margin: 0 }}>{title}</h1>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 999, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Work in Progress
        </span>
      </div>
      <p style={{ fontSize: 16, color: '#666666', marginBottom: 40 }}>{description}</p>

      <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🚧</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#333333', marginBottom: 8 }}>This page is under construction</h2>
        <p style={{ fontSize: 14, color: '#666666' }}>We&#39;re working on bringing this content to the portal. Check back soon.</p>
      </div>
    </section>
  );
}
