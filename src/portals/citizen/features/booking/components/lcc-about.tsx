'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import { catalogService } from '@/portals/citizen/lib/supabase/catalogs';
import type { PublicEvent } from '@/portals/citizen/features/content/types';
import { contentService, formatEventWhen, isUpcomingEvent } from '@/portals/citizen/features/content/lib/content';
import { CONTACT_EMAIL, resolveTrunkline, telHref } from '@/portals/citizen/lib/contact-info';

interface LCCAboutProps {
  onBook: () => void;
}

function ContactLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p style={{ color: '#666666', marginBottom: 6, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon} {label}
    </p>
  );
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const LocationIcon = () => (
  <svg {...iconProps}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const PhoneIcon = () => (
  <svg {...iconProps}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
  </svg>
);

const EmailIcon = () => (
  <svg {...iconProps}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);

const ClockIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

export default function LCCAbout({ onBook }: LCCAboutProps) {
  const [upcomingEvents, setUpcomingEvents] = useState<PublicEvent[]>([]);
  const [trunklineValue, setTrunklineValue] = useState<string | null>(null);
  const [officeHours, setOfficeHours] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    contentService
      .getEvents()
      .then((rows) => {
        if (cancelled) return;
        const now = new Date();
        setUpcomingEvents(rows.filter((e) => isUpcomingEvent(e, now)).slice(0, 5));
      })
      .catch(() => {
        // Content is supplementary here; the booking CTA must still render.
      });
    catalogService
      .getSiteInfo()
      .then((info) => {
        if (cancelled) return;
        setTrunklineValue(info?.trunkline ?? null);
        setOfficeHours(info?.office_hours ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const trunkline = resolveTrunkline(trunklineValue);

  const { user, openAuthModal } = useAuth();
  const handleBook = () => {
    if (!user) {
      openAuthModal('login');
    } else {
      onBook();
    }
  };

  return (
    <section style={{ padding: '48px clamp(16px, 5vw, 48px) 100px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <img src="/seal-128.png" alt="Lucena City Seal" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <span style={{ background: '#10B981', color: 'white', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Open</span>
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>Lucena Convention Center</h1>
        <p style={{ fontSize: 16, color: '#666666' }}>Premier event venue in the heart of Quezon Province. Host your conferences, weddings, and special events with us.</p>
      </div>

      {/* About Section */}
      <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ background: '#003DA5', color: 'white', marginBottom: 48, padding: '24px 32px' }}>
        <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 40 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>About the Venue</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 16 }}>
              The Lucena Convention Center is a world-class facility designed to accommodate various types of events, from intimate gatherings to large-scale conferences. With modern amenities, flexible spaces, and professional support staff, we ensure your event is a memorable success.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 20 }}>
              Our strategic location in Quezon Avenue makes us easily accessible, with ample parking and proximity to hotels, restaurants, and other city attractions.
            </p>
            <button className="inline-flex items-center justify-center rounded text-sm font-bold cursor-pointer" onClick={handleBook} style={{ padding: '12px 28px', fontSize: 14, fontWeight: 700, background: '#FDB913', color: '#000000' }}>
              Book a Venue Now
            </button>
          </div>
          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 700, marginBottom: 4 }}>500+</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>persons</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 700, marginBottom: 4 }}>1,500+</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>sqm</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 700, marginBottom: 4 }}>200+</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>successful events</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 700, marginBottom: 4 }}>7</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>days a week</div>
            </div>
          </div>
        </div>
      </div>

      {/* Court Area */}
      <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ marginBottom: 32, borderLeft: '4px solid #003DA5', padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#003DA5', marginBottom: 6 }}>Court Area</h2>
            <p style={{ fontSize: 13, color: '#666666', marginBottom: 12 }}>Lucena City Convention Center</p>
            <p style={{ fontSize: 14, color: '#333333', lineHeight: 1.8, marginBottom: 16 }}>
              The Court Area is the main bookable space of the Lucena City Convention Center — a spacious, multi-purpose hall suitable for assemblies, sports events, cultural performances, corporate functions, and large gatherings. It can be configured to suit a wide range of event formats.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Air-conditioned', 'Stage platform', 'Sound system', 'LED screens', 'WiFi', 'Parking'].map((a, i) => (
                <span key={i} style={{ background: 'rgba(0,61,165,0.08)', color: '#003DA5', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500 }}>{a}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12, minWidth: 180 }}>
            {[{ label: 'Capacity', value: 'Up to 500 persons' }, { label: 'Floor Area', value: '800 sqm' }, { label: 'Location', value: 'Quezon Ave, Lucena City' }].map((d, i) => (
              <div key={i}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{d.label}</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#333333' }}>{d.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services & Events */}
      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 48 }}>
        <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#003DA5', marginBottom: 24 }}>Services Offered</h2>
          <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {['Event Planning Assistance', 'Catering Services Coordination', 'Audio-Visual Equipment', 'Stage & Lighting Setup', 'Tables & Chairs Rental', 'Parking Facilities', 'Security Services', 'WiFi Connectivity'].map((svc, i) => (
              <div key={i} style={{ background: '#F5F5F5', padding: 16, borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#333333', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✓</span> {svc}
              </div>
            ))}
          </div>
        </div>

        {/* Real events from public_events. The three that stood here were
            invented — "Lucena Business Summit 2026", "Health & Wellness Expo",
            "Regional Teachers Convention" — and a citizen could reasonably have
            planned around them, or assumed the hall was booked on those dates.
            Empty means hidden, which is the rule the rest of the portal follows
            for LGU-authored content. */}
        {upcomingEvents.length > 0 && (
          <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#003DA5', marginBottom: 24 }}>Upcoming Events</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {upcomingEvents.map((evt) => (
                <div key={evt.id} style={{ borderLeft: '3px solid #003DA5', paddingLeft: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#003DA5' }}>{formatEventWhen(evt)}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#333333', marginBottom: 2 }}>{evt.title}</div>
                  {evt.location_text && <div style={{ fontSize: 12, color: '#666666' }}>{evt.location_text}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contact & CTA */}
      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ padding: '24px 32px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#003DA5', marginBottom: 20 }}>Contact Information</h2>
          <div style={{ display: 'grid', gap: 20, fontSize: 14 }}>
            <div>
              <ContactLabel icon={<LocationIcon />} label="Location" />
              <p style={{ color: '#333333', lineHeight: 1.6 }}>Quezon Avenue, Lucena City<br />Quezon Province, Philippines 4301</p>
            </div>
            {/* The two phone numbers and two LCC-specific email addresses that
                stood here were literals sourced from nothing, and did not match
                the ones on the home page. The city trunkline is LGU-editable via
                public_site_info; a dedicated LCC line and mailbox have no home
                in the schema yet (public_site_info_entries supports only
                'emergency_hotline' and 'floor_directory' kinds), so rather than
                keep publishing unverifiable numbers this points at the channels
                that are real. Filed as a SuperStaff ask. */}
            <div>
              <ContactLabel icon={<PhoneIcon />} label="Phone" />
              <p style={{ color: '#333333' }}>
                <a href={telHref(trunkline)} style={{ color: '#003DA5', textDecoration: 'none' }}>{trunkline}</a>
                {' '}(Lucena City Hall trunkline)
              </p>
            </div>
            <div>
              <ContactLabel icon={<EmailIcon />} label="Email" />
              <p style={{ color: '#333333' }}>
                <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#003DA5', textDecoration: 'none' }}>{CONTACT_EMAIL}</a>
              </p>
            </div>
            {officeHours && (
              <div>
                <ContactLabel icon={<ClockIcon />} label="Office Hours" />
                <p style={{ color: '#333333', lineHeight: 1.6 }}>{officeHours}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#DDDDDD] rounded shadow-sm" style={{ background: '#003DA5', color: 'white', padding: '24px 32px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Ready to Book?</h2>
          {/* CONTEXT.md glossary: the citizen "books" the LCC; they do not
              "reserve" it. */}
          <p style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>
            Book your preferred date and venue now. Our team will assist you in planning your event.
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {/* The "Special Offers" block here promised a flat 10% discount for
                non-profits, free setup for government events, and multi-day
                package deals. None of it is expressible in booking_price(): the
                rate tier is commercial or discounted, decided by the city from
                the classification you select, and there is no percentage
                anywhere in the fee formula. Quoting a number the system cannot
                honour is worse than quoting none. */}
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <strong style={{ color: '#FDB913' }}>Discounted rates</strong><br />
              Government, educational and non-profit organisations may qualify for the city&apos;s
              discounted rate tier. The tier is set by City Hall from the classification you choose
              when booking, and the exact fee is confirmed on your quote.
            </div>
          </div>
          <button className="inline-flex items-center justify-center rounded text-sm font-bold cursor-pointer" onClick={handleBook} style={{ width: '100%', marginTop: 24, padding: '12px', background: '#FDB913', color: '#000000', fontWeight: 700 }}>
            Book a Venue
          </button>
        </div>
      </div>
    </section>
  );
}
