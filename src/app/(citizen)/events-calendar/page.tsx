'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicEvent } from '@/portals/citizen/features/content/types';
import { contentService, formatEventWhen, groupEventsByMonth, isUpcomingEvent, siteContentUrl } from '@/portals/citizen/features/content/lib/content';
import { AGENCY_NAME } from '@/portals/citizen/lib/contact-info';

/** Fallback chip colour for an event whose category was cleared in Super Staff.
 * The LGU-set `color_hex` wins whenever the row carries one. */
const NEUTRAL_CHIP = '#6B7280';

export default function EventsCalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const rows = await contentService.getEvents();
        // `now` is read once here rather than inside the filter so every row is
        // judged against the same instant.
        const now = new Date();
        setEvents(rows.filter((event) => isUpcomingEvent(event, now)));
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const months = groupEventsByMonth(events);

  return (
    <section style={{ padding: '48px clamp(16px, 5vw, 48px) 80px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ marginBottom: 40 }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', color: '#003DA5', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Home
        </button>
        <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>Events Calendar</h1>
        <p style={{ fontSize: 16, color: '#666666' }}>Upcoming events and community activities published by the {AGENCY_NAME}.</p>
      </div>

      {loading && (
        <p style={{ fontSize: 15, color: '#666666' }}>Loading events…</p>
      )}

      {!loading && failed && (
        <div className="bg-white border border-[#DDDDDD] rounded p-8 shadow-sm" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: '#333333' }}>Could not load the events calendar right now. Please try again later.</p>
        </div>
      )}

      {!loading && !failed && months.length === 0 && (
        <div className="bg-white border border-[#DDDDDD] rounded p-8 shadow-sm" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: '#333333', marginBottom: 6 }}>No upcoming events are published right now.</p>
          <p style={{ fontSize: 13, color: '#666666' }}>Check back soon — this page updates as the city publishes new activities.</p>
        </div>
      )}

      {months.map((month) => (
        <div key={month.key} style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 700, color: '#003DA5', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {month.label}
          </h2>
          <div style={{ display: 'grid', gap: 24 }}>
            {month.events.map((event) => {
              const image = siteContentUrl(event.image_path);
              return (
                <article
                  key={event.id}
                  className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  style={{ overflow: 'hidden', display: 'grid', gridTemplateColumns: image ? '260px 1fr' : '1fr' }}
                >
                  {image && (
                    <div style={{ position: 'relative', minHeight: 180 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image}
                        alt={event.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                  )}
                  <div style={{ padding: 24 }}>
                    {event.category_label && (
                      <span style={{ display: 'inline-block', background: event.color_hex ?? NEUTRAL_CHIP, color: 'white', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: 999, padding: '4px 10px', marginBottom: 12 }}>
                        {event.category_label}
                      </span>
                    )}
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#222222', marginBottom: 8 }}>{event.title}</h3>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#003DA5', marginBottom: 4 }}>{formatEventWhen(event)}</p>
                    {event.location_text && (
                      <p style={{ fontSize: 13, color: '#666666', marginBottom: 12 }}>📍 {event.location_text}</p>
                    )}
                    {event.description && (
                      <p style={{ fontSize: 14, color: '#555555', lineHeight: 1.7 }}>{event.description}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
