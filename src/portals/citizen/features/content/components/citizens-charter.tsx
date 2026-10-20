'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CONTACT_EMAIL, HELPDESK_EMAIL, telHref } from '@/portals/citizen/lib/contact-info';
import { catalogService } from '@/portals/citizen/lib/supabase/catalogs';
import {
  buildCharter,
  type Charter,
  type CharterService,
  type CharterSources,
} from '@/portals/citizen/features/content/lib/citizens-charter';

const EMPTY_SOURCES: CharterSources = {
  yellowCard: null,
  yellowCardDocuments: [],
  incident: null,
  booking: null,
  siteInfo: null,
};

/**
 * `Promise.allSettled` rather than `all`: a charter that 404s because one
 * catalog read timed out is a worse failure than a charter that falls back to
 * prose for one field. Each source degrades on its own.
 */
async function loadSources(): Promise<CharterSources> {
  const [yellowCard, yellowCardDocuments, incident, booking, siteInfo] =
    await Promise.allSettled([
      catalogService.getYellowCardConfig(),
      catalogService.getYellowCardDocumentTypes(),
      catalogService.getIncidentConfig(),
      catalogService.getBookingConfig(),
      catalogService.getSiteInfo(),
    ]);

  return {
    yellowCard: yellowCard.status === 'fulfilled' ? yellowCard.value : null,
    yellowCardDocuments:
      yellowCardDocuments.status === 'fulfilled' ? yellowCardDocuments.value : [],
    incident: incident.status === 'fulfilled' ? incident.value : null,
    booking: booking.status === 'fulfilled' ? booking.value : null,
    siteInfo: siteInfo.status === 'fulfilled' ? siteInfo.value : null,
  };
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#003DA5',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: 0,
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#555555',
  lineHeight: 1.8,
  margin: '4px 0 0',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt style={labelStyle}>{label}</dt>
      <dd style={valueStyle}>{children}</dd>
    </div>
  );
}

function ServiceEntry({ service }: { service: CharterService }) {
  return (
    <article
      style={{
        border: '1px solid #DDDDDD',
        borderRadius: 10,
        padding: 'clamp(20px, 4vw, 28px)',
        background: '#FFFFFF',
      }}
    >
      <h2 style={{ fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>
        {service.name}
      </h2>
      <p style={{ fontSize: 14, color: '#555555', lineHeight: 1.8, marginBottom: 20 }}>
        {service.summary}
      </p>

      <dl className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, margin: 0 }}>
        <Field label="Who may avail">{service.whoMayAvail}</Field>
        <Field label="Fee">{service.fee}</Field>
        <Field label="Processing time">{service.processingTime}</Field>
        {/* Deliberately claims only the channel this repo can verify. Whether
            the city also accepts this service over the counter is not something
            the portal knows, and a charter that promises a counter that does not
            exist is worse than one that is narrow. */}
        <Field label="Where to apply">Online through this portal.</Field>

        <div style={{ gridColumn: '1 / -1' }}>
          <dt style={labelStyle}>Requirements</dt>
          <dd style={{ ...valueStyle, paddingLeft: 20 }}>
            <ul style={{ listStyle: 'disc', margin: 0 }}>
              {service.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </dd>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <dt style={labelStyle}>How to apply</dt>
          <dd style={{ ...valueStyle, paddingLeft: 20 }}>
            <ol style={{ listStyle: 'decimal', margin: 0 }}>
              {service.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </dd>
        </div>
      </dl>

      <Link
        href={service.href}
        style={{
          display: 'inline-block',
          marginTop: 20,
          fontSize: 14,
          fontWeight: 700,
          color: '#003DA5',
          textDecoration: 'none',
        }}
      >
        Start this service →
      </Link>
    </article>
  );
}

export default function CitizensCharter() {
  const [charter, setCharter] = useState<Charter>(() => buildCharter(EMPTY_SOURCES));

  useEffect(() => {
    let active = true;
    loadSources().then((sources) => {
      if (active) setCharter(buildCharter(sources));
    });
    return () => {
      active = false;
    };
  }, []);

  const { office } = charter;

  return (
    <section style={{ padding: '48px clamp(20px, 5vw, 48px) 80px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>
        Citizen&apos;s Charter
      </h1>
      <p style={{ fontSize: 14, color: '#555555', lineHeight: 1.8, marginBottom: 24 }}>
        The services the City Government of Lucena delivers through this portal, the requirements for
        each, what they cost, and how long they take — published under the Ease of Doing Business and
        Efficient Government Service Delivery Act of 2018 (RA 11032).
      </p>

      <div
        style={{
          background: '#FEF3C7',
          border: '1px solid #FCD34D',
          borderRadius: 6,
          padding: '12px 16px',
          fontSize: 13,
          color: '#92400E',
          marginBottom: 32,
        }}
      >
        Note: This charter is pending official approval by the City Government and is published here
        for development purposes. The processing times and fees shown are read from the portal&apos;s
        own service configuration.
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        {charter.services.map((service) => (
          <ServiceEntry key={service.code} service={service} />
        ))}
      </div>

      <div style={{ marginTop: 40, paddingTop: 28, borderTop: '1px solid #DDDDDD' }}>
        <h2 style={{ fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 700, color: '#003DA5', marginBottom: 16 }}>
          Where to reach us
        </h2>
        <dl style={{ display: 'grid', gap: 20, margin: 0 }}>
          <Field label="Office">
            {office.addressLines.map((line) => (
              <span key={line} style={{ display: 'block' }}>
                {line}
              </span>
            ))}
          </Field>
          {office.hours && <Field label="Office hours">{office.hours}</Field>}
          <Field label="Trunkline">
            <a href={telHref(office.trunkline)} style={{ color: '#003DA5', textDecoration: 'none' }}>
              {office.trunkline}
            </a>
          </Field>
          <Field label="Feedback and complaints">
            Email{' '}
            <a href={`mailto:${HELPDESK_EMAIL}`} style={{ color: '#003DA5', textDecoration: 'none' }}>
              {HELPDESK_EMAIL}
            </a>{' '}
            for anything about this portal, or{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#003DA5', textDecoration: 'none' }}>
              {CONTACT_EMAIL}
            </a>{' '}
            for general enquiries. Complaints are acknowledged within the office hours shown above.
          </Field>
        </dl>
      </div>
    </section>
  );
}
