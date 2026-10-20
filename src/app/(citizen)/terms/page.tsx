'use client';

import { useRouter } from 'next/navigation';
import { AGENCY_NAME } from '@/portals/citizen/lib/contact-info';

/**
 * Section 9 names `AGENCY_NAME`; it used to carry the reversed word order. That
 * is an editorial correction, so `terms_version` (DB `l40`) is deliberately
 * NOT bumped — the reasoning is recorded once in
 * `docs/citizen-surface-follow-ups.md` C3. Read it before changing any wording
 * here, because most other edits to this document WOULD need a bump.
 */
const sections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By creating an account or using any service on the Lucena City E-Services Portal ("the Portal"), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use the Portal.',
  },
  {
    title: '2. Eligibility',
    body: 'The Portal is intended for residents, businesses, and other stakeholders of Lucena City who need to access city government services online. You must provide accurate and complete information when registering for an account.',
  },
  {
    title: '3. Account Responsibility',
    body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify the City Government immediately of any unauthorized use of your account.',
  },
  {
    title: '4. Use of Services',
    body: 'Services offered through the Portal, including but not limited to Yellow Card applications, incident reporting, and venue booking, must be used only for their intended lawful purposes. Submitting false or misleading information may result in the rejection of your request and/or suspension of your account.',
  },
  {
    title: '5. Processing Times',
    body: 'Application and request processing times displayed on the Portal are estimates and may vary depending on office workload, document completeness, and verification requirements.',
  },
  {
    title: '6. Intellectual Property',
    body: 'All content, trademarks, logos, and materials on the Portal are the property of the City Government of Lucena or its licensors and may not be reproduced without prior written consent.',
  },
  {
    title: '7. Limitation of Liability',
    body: 'The City Government of Lucena shall not be held liable for any indirect, incidental, or consequential damages arising from the use of, or inability to use, the Portal.',
  },
  {
    title: '8. Changes to These Terms',
    body: 'These Terms and Conditions may be updated from time to time. Continued use of the Portal after changes are posted constitutes acceptance of the revised terms.',
  },
  {
    title: '9. Contact Us',
    body: `For questions regarding these Terms and Conditions, please contact the ${AGENCY_NAME} at support@lucena-city.gov.ph.`,
  },
];

export default function TermsPage() {
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

      <h1 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>Terms and Conditions</h1>
      <p style={{ fontSize: 13, color: '#666666', marginBottom: 24 }}>Last updated: April 2026</p>

      <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: '12px 16px', fontSize: 13, color: '#92400E', marginBottom: 32 }}>
        Note: This is placeholder content for development purposes and does not represent the final, legally reviewed Terms and Conditions of the Lucena City E-Services Portal.
      </div>

      <div style={{ display: 'grid', gap: 28 }}>
        {sections.map((s) => (
          <div key={s.title}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#333333', marginBottom: 8 }}>{s.title}</h2>
            <p style={{ fontSize: 14, color: '#555555', lineHeight: 1.8 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
