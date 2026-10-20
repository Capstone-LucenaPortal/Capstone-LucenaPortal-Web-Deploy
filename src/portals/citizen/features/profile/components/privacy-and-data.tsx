'use client';

import Link from 'next/link';
import type { MyProfile } from '@/portals/citizen/features/profile/types';
import { CONTACT_EMAIL } from '@/portals/citizen/lib/contact-info';
import { formatManilaDate } from '@/shared/dates/manila';

interface Props {
  profile: MyProfile | null;
}

/**
 * The citizen's own view of what the city holds and what they agreed to.
 *
 * RA 10173 gives a data subject rights to be informed, to access, to correct,
 * and to erasure. The portal already satisfied access and correction through
 * the profile form, but silently: nothing told a citizen which version of the
 * Terms they had consented to or when, even though `my_profile` has carried
 * `terms_accepted_at` and `terms_version` since DB layer l40.
 *
 * Erasure has no self-service RPC yet, so this offers the honest thing — a
 * pre-addressed request to a real mailbox — rather than a button that would
 * quietly do nothing. Filed as a DB ask in citizen-surface-follow-ups.md.
 */
export default function PrivacyAndData({ profile }: Props) {
  const cardStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #DDDDDD',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '24px 32px',
    marginBottom: 24,
  };

  const rowLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: 4,
  };

  const erasureSubject = encodeURIComponent('Data request — Lucena City Portal');
  const erasureBody = encodeURIComponent(
    [
      'Hello,',
      '',
      'I would like to make a request about the personal data held about me in the Lucena City Portal.',
      '',
      'Please tick one:',
      '[ ] I would like a copy of my data (right to access)',
      '[ ] I would like my account and data erased (right to erasure)',
      '',
      'My registered email address is: ',
      profile?.email ?? '',
      '',
      'Thank you.',
    ].join('\n'),
  );

  return (
    <div>
      <div style={cardStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>
          Your consent
        </h2>

        {profile?.terms_accepted_at ? (
          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <p style={rowLabel}>Agreed on</p>
              <p style={{ fontSize: 15, color: '#333333' }}>{formatManilaDate(profile.terms_accepted_at)}</p>
            </div>
            <div>
              <p style={rowLabel}>Terms version</p>
              <p style={{ fontSize: 15, color: '#333333' }}>{profile.terms_version ?? '—'}</p>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 14, color: '#666666', lineHeight: 1.7 }}>
            We have no record of when you accepted the Terms and Conditions.
          </p>
        )}

        <p style={{ fontSize: 13, color: '#666666', marginTop: 16, lineHeight: 1.7 }}>
          You can re-read the{' '}
          <Link href="/terms" style={{ color: '#003DA5' }}>Terms and Conditions</Link> and the{' '}
          <Link href="/privacy" style={{ color: '#003DA5' }}>Privacy Policy</Link> at any time.
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 16 }}>
          Your rights over your data
        </h2>
        <p style={{ fontSize: 14, color: '#333333', lineHeight: 1.8, marginBottom: 16 }}>
          Under the Data Privacy Act of 2012 (RA 10173) you have the right to know what personal
          data the City Government of Lucena holds about you, to correct it, and to ask for it to be
          erased.
        </p>

        <ul style={{ fontSize: 14, color: '#333333', lineHeight: 1.9, paddingLeft: 20, margin: 0 }}>
          <li>
            <strong>See and correct your details</strong> — use the Personal Information form on
            this page. Changes take effect immediately.
          </li>
          <li>
            <strong>Get a copy of your data, or ask for erasure</strong> — email the City
            Government using the link below. There is no self-service button for this yet, so a
            person will handle your request.
          </li>
        </ul>

        <div style={{ marginTop: 20 }}>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${erasureSubject}&body=${erasureBody}`}
            style={{ display: 'inline-block', background: 'white', color: '#003DA5', border: '1px solid #003DA5', padding: '12px 24px', borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
          >
            Request a copy or erasure of my data
          </a>
        </div>

        <p style={{ fontSize: 12, color: '#666666', marginTop: 16, lineHeight: 1.6 }}>
          Erasing your account does not remove records the city is required by law to keep, such as
          an issued Yellow Card or a filed incident report. Those are anonymised rather than
          deleted.
        </p>
      </div>

      {profile?.created_at && (
        <p style={{ fontSize: 12, color: '#666666' }}>
          Account created {formatManilaDate(profile.created_at)}
          {profile.updated_at ? ` · last updated ${formatManilaDate(profile.updated_at)}` : ''}
        </p>
      )}
    </div>
  );
}

/**
 * Shown in place of the editable form once a profile has been anonymised.
 * Without it the form rendered normally and only failed on save — which reads
 * as a broken portal rather than a completed erasure.
 */
export function AnonymisedNotice({ anonymisedAt }: { anonymisedAt: string }) {
  return (
    <div
      role="status"
      style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 8, padding: '24px 32px', marginBottom: 24 }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
        This account has been anonymised
      </h2>
      <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
        Your personal details were removed from the Lucena City Portal on{' '}
        <strong>{formatManilaDate(anonymisedAt)}</strong> at your request. They can no longer be viewed or
        edited here.
      </p>
      <p style={{ fontSize: 13, color: '#666666', marginTop: 12, lineHeight: 1.7 }}>
        If you need city services again, please register a new account, or contact the Lucena City
        Hall trunkline for help.
      </p>
    </div>
  );
}
