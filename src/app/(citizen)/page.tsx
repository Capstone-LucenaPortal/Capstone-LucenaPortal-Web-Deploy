'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import { catalogService, type SiteInfo, type SiteInfoEntry } from '@/portals/citizen/lib/supabase/catalogs';
import ProgramsSummary from '@/portals/citizen/features/content/components/programs-summary';
import SlideshowToggle from '@/portals/citizen/features/content/components/slideshow-toggle';
import { useCarousel } from '@/portals/citizen/features/content/hooks/use-carousel';
import FacebookPageFeed from '@/portals/citizen/components/ui/facebook-page-feed';
import { FACEBOOK_PAGE_URL } from '@/portals/citizen/lib/contact-info';

/** `(0XX) YYY-ZZZZ` → `tel:+63XXYYYZZZZ`. Local numbers are stored with a
 * leading 0; short codes (911) are dialled as-is. */
function telHref(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `tel:+63${digits.slice(1)}`;
  return `tel:${digits}`;
}

export default function HomePage() {
  const router = useRouter();
  const { user, openAuthModal } = useAuth();

  const [lccHovered, setLccHovered] = useState<number | null>(null);
  const [emergencyHotlines, setEmergencyHotlines] = useState<SiteInfoEntry[]>([]);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);

  const heroSlides = [
    { title: 'Welcome to Lucena City Portal', desc: 'Your gateway to city services and community information', image: '/lucena-city-hall.jpg', buttonText: 'Learn More', link: '/announcements', color: '#003DA5' },
    // The photo is square, so a wide screen shows only a band of it; 55% keeps
    // the "City of Lucena, Quezon" title and the people in that band.
    { title: 'City Programs', desc: 'Ongoing initiatives in health, livelihood, and infrastructure for Lucenahins', image: '/hero-programs.jpg', imagePosition: 'center 55%', buttonText: 'Learn More', link: '#city-programs', color: '#7C3F00' },
    { title: 'Lucena Events', desc: 'Discover upcoming events and community activities', image: '/lcc-1.jpg', buttonText: 'Book Venue', link: '/lcc', color: '#166534' },
  ];

  const lccSlides = [
    { image: '/lcc-1.jpg', label: 'The Atrium', caption: 'Capacity: 1,000 pax • Weddings & Conventions' },
    { image: '/lcc-2.jpg', label: 'Sports Arena', caption: 'Capacity: 3,500 pax • Sports & Concerts' },
    { image: '/lcc-3.jpg', label: 'Full Facility', caption: 'Capacity: 5,000 pax • Large-Scale Events' },
    { image: '/lcc-4.jpg', label: 'Conference Rooms', caption: 'Flexible meeting and seminar spaces' },
    { image: '/lcc-5.jpg', label: 'Event Spaces', caption: 'Versatile venues for any occasion' },
  ];

  const announcements = [
    { date: 'Apr 20', text: 'Yellow Card renewal period is now open. Visit Municipal Hall or apply online.' },
    { date: 'Apr 17', text: 'Lucena Convention Center bookings available for May 1–30.' },
    { date: 'Apr 15', text: 'Business permit renewal deadline extended to April 30.' },
  ];

  const hero = useCarousel(heroSlides.length, 5000);
  const lcc = useCarousel(lccSlides.length, 4000);

  // Hotlines, trunkline and office hours are LGU-editable config. They live in
  // `public_site_info*` and are rendered straight from there — deliberately with
  // no hardcoded fallback copy, so an edit in Super Staff can never be shadowed
  // by a stale literal here.
  useEffect(() => {
    (async () => {
      const [hotlines, info] = await Promise.all([
        catalogService.getEmergencyHotlines().catch(() => []),
        catalogService.getSiteInfo().catch(() => null),
      ]);
      setEmergencyHotlines(hotlines);
      setSiteInfo(info);
    })();
  }, []);


  return (
    <>
      {/* Hero Carousel */}
      <section style={{ position: 'relative', height: 'calc(100vh - 88px)', overflow: 'hidden', marginBottom: 40 }}>
        {/* The carousel itself: hovering or focusing anything in here holds it
            still. The Live ticker sits outside it, in the same spot. */}
        <div {...hero.regionProps} style={{ position: 'relative', height: '100%' }}>
          {/* Background image — no color overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: heroSlides[hero.slide].image
              ? `url('${heroSlides[hero.slide].image}') ${heroSlides[hero.slide].imagePosition ?? 'center'}/cover no-repeat ${heroSlides[hero.slide].color}`
              : `linear-gradient(135deg, ${heroSlides[hero.slide].color}E6, ${heroSlides[hero.slide].color}CC)`,
            transition: 'background 0.5s ease'
          }} />

          {/* Bottom gradient for text legibility */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 45%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Slide Content — bottom left like Valenzuela */}
          <div style={{ position: 'absolute', bottom: 80, left: 'clamp(16px, 4vw, 48px)', zIndex: 2, color: 'white', maxWidth: 680 }}>
            <h1 style={{ fontSize: 'clamp(28px, 6vw, 44px)', fontWeight: 700, marginBottom: 14, lineHeight: 1.15, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>{heroSlides[hero.slide].title}</h1>
            <p style={{ fontSize: 17, marginBottom: 28, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>{heroSlides[hero.slide].desc}</p>
            <button
              onClick={() => {
                if (heroSlides[hero.slide].link !== '#') {
                  router.push(heroSlides[hero.slide].link);
                }
              }}
              style={{ padding: '12px 32px', fontSize: 15, fontWeight: 700, background: 'white', color: '#003DA5', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              {heroSlides[hero.slide].buttonText}
            </button>
          </div>

          {/* Navigation Arrows */}
          <button aria-label="Previous slide" onClick={() => hero.prev()}
            style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.25)', border: 'none', color: 'white', width: 48, height: 48, borderRadius: 4, cursor: 'pointer', fontSize: 20, zIndex: 3 }}>
            ←
          </button>
          <button aria-label="Next slide" onClick={() => hero.next()}
            style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.25)', border: 'none', color: 'white', width: 48, height: 48, borderRadius: 4, cursor: 'pointer', fontSize: 20, zIndex: 3 }}>
            →
          </button>

          {/* Slide Indicators, with pause/play hung off their right end so the
              dots stay centred where they were. */}
          <div style={{ position: 'absolute', bottom: 76, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 3 }}>
            {heroSlides.map((_, i) => (
              <button key={i} aria-label={`Go to slide ${i + 1} of ${heroSlides.length}`} aria-current={i === hero.slide ? 'true' : undefined} onClick={() => hero.goTo(i)}
                style={{ width: i === hero.slide ? 32 : 8, height: 8, background: i === hero.slide ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 999, cursor: 'pointer', transition: 'all 0.3s' }} />
            ))}
            <SlideshowToggle playing={hero.playing} onToggle={hero.toggle}
              style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 12, width: 28, height: 28, borderRadius: 4, background: 'rgba(255,255,255,0.25)', color: 'white' }} />
          </div>

        </div>

        {/* Live Announcement Ticker */}
        <button
          type="button"
          onClick={() => router.push('/announcements')}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 4, background: '#003DA5', color: 'white', padding: '10px clamp(16px, 5vw, 48px)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 13, width: '100%', border: 'none', textAlign: 'left', font: 'inherit' }}
        >
          <span style={{ background: '#F5A623', color: '#000000', fontWeight: 700, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: 999, padding: '3px 10px', flexShrink: 0 }}>Live</span>
          <span style={{ fontWeight: 600, flexShrink: 0 }}>{announcements[0].date}</span>
          <span style={{ opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{announcements[0].text}</span>
          <span style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.85 }}>View All →</span>
        </button>
      </section>

      {/* Mission & Vision */}
      <section style={{ padding: '40px clamp(16px, 5vw, 48px)', maxWidth: 1800, margin: '0 auto', marginBottom: 40, borderTop: '1px solid #DDDDDD', borderBottom: '1px solid #DDDDDD' }}>
        <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 48 }}>
          <div className="stack-mobile" style={{ gridColumn: '1 / span 2', display: 'flex', flexDirection: 'column', gap: 32, background: '#003DA5', borderRadius: 12, padding: 32 }}>
            <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
              <div>
                <h3 style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 700, color: '#FFFFFF', marginBottom: 20 }}>Our Mission</h3>
                <p style={{ fontSize: 18, color: '#E6EDF9', lineHeight: 1.9 }}>
                  The City Government of Lucena shall uphold honest and transparent governance, boost investment opportunities, improve the quality of health and education, create employment through establishment of technological and agro-industries, ensure protection and sustainability of the environment, and promote peace and order that will uplift the Lucenahins&apos; quality of life.
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 700, color: '#FFFFFF', marginBottom: 20 }}>Our Vision</h3>
                <p style={{ fontSize: 18, color: '#E6EDF9', lineHeight: 1.9 }}>
                  The City of Lucena, imbued with strong and moral leadership, God-loving and empowered citizenry envisions to be the premier city in Southern Tagalog providing sustainable development, creating opportunities for socio-economic, agro-industrial and technological growth, ensuring a peaceful and safe environment and improving the quality of life of its people.
                </p>
              </div>
            </div>
            <div style={{ paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <h3 style={{ fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 700, color: '#FFFFFF', marginBottom: 20 }}>Our History</h3>
              <p style={{ fontSize: 18, color: '#E6EDF9', lineHeight: 1.9 }}>
                Franciscan missionaries Juan de Plasencia and Diego de Oropesa organized the settlement between 1580 and 1583, first named Buenavista and later renamed Cotta after a fortress was built to defend against pirate raids. It was renamed Lucena by royal decree in November 1879, became an independent municipality on June 1, 1882, was chartered as a city on June 17, 1961, and attained Highly Urbanized City status on July 1, 1991 &mdash; cementing its role as the leading economic center of the CALABARZON region.
              </p>
            </div>
          </div>
          <div style={{ gridColumn: '3' }}>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#003DA5', marginBottom: 16 }}>Follow Us on Facebook</h3>
            <FacebookPageFeed pageUrl={FACEBOOK_PAGE_URL} height={640} title="City of Lucena official Facebook feed" />
          </div>
        </div>
      </section>

      <ProgramsSummary />
      {/* Lucena Convention Center Carousel */}
      <section style={{ padding: '40px 0', maxWidth: '100%', overflow: 'hidden', margin: '0 auto', marginBottom: 40, background: '#FAFAFA' }}>
        <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 700, color: '#003DA5', marginBottom: 32, textAlign: 'center' }}>Lucena Convention Center</h2>

        <div {...lcc.regionProps} style={{ position: 'relative', width: '100%', height: 'clamp(280px, 60vw, 500px)' }}>
          <div style={{
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
            transform: `translateX(calc(10% - ${lcc.slide * 80}%))`
          }}>
            {lccSlides.map((slide, i) => {
              const isActive = i === lcc.slide;
              // Hover shows any slide's name; keyboard focus anywhere in the
              // carousel shows the centre slide's, since the slides take no focus.
              const showText = lccHovered === i || (isActive && lcc.focusInside);
              return (
                <div key={i} style={{ flexShrink: 0, width: '80%', height: '100%', padding: '0 11px', boxSizing: 'border-box' }}>
                  <div
                    style={{
                      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
                      borderRadius: 16,
                      background: `url('${slide.image}') center/cover no-repeat`,
                      transition: 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
                      transform: isActive ? 'scale(1)' : 'scale(0.92)',
                      opacity: isActive ? 1 : 0.4,
                      boxShadow: isActive ? '0 20px 40px rgba(0,0,0,0.15)' : 'none',
                      cursor: isActive ? 'default' : 'pointer',
                    }}
                    onClick={() => !isActive && lcc.goTo(i)}
                    onMouseEnter={() => setLccHovered(i)}
                    onMouseLeave={() => setLccHovered(null)}
                  >
                    {/* Name and caption overlay */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,30,80,0.85) 0%, rgba(0,30,80,0.2) 60%, transparent 100%)',
                      opacity: showText ? 1 : 0,
                      transition: 'opacity 0.3s ease',
                      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                      padding: '28px 24px',
                      borderRadius: 16,
                    }}>
                      <div style={{ color: 'white', fontWeight: 700, fontSize: 22, marginBottom: 6, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{slide.label}</div>
                      <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{slide.caption}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button aria-label="Previous slide" onClick={() => lcc.prev()}
            style={{ position: 'absolute', left: '12%', top: '50%', transform: 'translateY(-50%)', background: 'white', border: 'none', color: '#333333', width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', fontSize: 20, zIndex: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
            ←
          </button>
          <button aria-label="Next slide" onClick={() => lcc.next()}
            style={{ position: 'absolute', right: '12%', top: '50%', transform: 'translateY(-50%)', background: 'white', border: 'none', color: '#333333', width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', fontSize: 20, zIndex: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
            →
          </button>

          {/* Dots, with pause/play hung off their right end. */}
          <div style={{ position: 'absolute', bottom: -30, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10 }}>
            {lccSlides.map((_, i) => (
              <button key={i} aria-label={`Go to slide ${i + 1} of ${lccSlides.length}`} aria-current={i === lcc.slide ? 'true' : undefined} onClick={() => lcc.goTo(i)}
                style={{ width: i === lcc.slide ? 32 : 8, height: 8, background: i === lcc.slide ? '#003DA5' : '#DDDDDD', border: 'none', borderRadius: 999, cursor: 'pointer', transition: 'all 0.3s' }} />
            ))}
            <SlideshowToggle playing={lcc.playing} onToggle={lcc.toggle}
              style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 12, width: 24, height: 24, borderRadius: '50%', background: 'white', color: '#333333', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
          </div>
        </div>
      </section>

      {/* Emergency Hotlines — every row from `public_site_info_entries`. Keyed on
          sort_order, not label: two rows are deliberately both "Secondary
          Emergency" and both must render. The whole section is hidden when the
          list is empty rather than showing an empty grid under a heading. */}
      {emergencyHotlines.length > 0 && (
        <section style={{ padding: '40px clamp(16px, 5vw, 48px)', maxWidth: 1800, margin: '0 auto', marginBottom: 40 }}>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 700, color: '#003DA5', marginBottom: 32, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emergency Hotlines</h2>
          {/* Equal-size cards in balanced rows: the row is capped at half the
              list (rounded up), so 9 cards sit 5 + 4 rather than 7 + 2, and the
              short row is centred. Numbers never break mid-number. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20, margin: '0 auto', maxWidth: Math.ceil(emergencyHotlines.length / 2) * 260 - 20 }}>
            {emergencyHotlines.map((hotline) => (
              <div key={`${hotline.kind}-${hotline.sort_order}`} style={{ flex: '0 1 240px', minHeight: 150, background: '#E8E8E8', padding: '24px 16px', borderRadius: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#003DA5', textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.4 }}>{hotline.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#333333', whiteSpace: 'nowrap' }}>{hotline.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact Us & Office Address Section */}
      <section style={{ padding: '40px clamp(16px, 5vw, 48px)', maxWidth: 1800, margin: '0 auto', marginBottom: 60 }}>
        <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}>
          <div>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 700, color: '#003DA5', marginBottom: 32, textAlign: 'center' }}>Contact Us</h2>
            <div className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ padding: '24px 32px' }}>
              <p style={{ fontSize: 12, color: '#666666', marginBottom: 24, lineHeight: 1.8, textAlign: 'center' }}>
                For information, complaints, or suggestions:
              </p>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#333333', marginBottom: 6, textTransform: 'uppercase' }}>Email</p>
                <a href="mailto:info@lucena-city.gov.ph" style={{ fontSize: 13, color: '#003DA5', textDecoration: 'none' }}>info@lucena-city.gov.ph</a>
              </div>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#333333', marginBottom: 6, textTransform: 'uppercase' }}>Call</p>
                <p style={{ fontSize: 13, color: '#333333', lineHeight: 1.8 }}>
                  {siteInfo?.trunkline && (
                    <>
                      <a href={telHref(siteInfo.trunkline)} style={{ color: '#003DA5', textDecoration: 'none' }}>{siteInfo.trunkline}</a> (Central Hotline)<br />
                    </>
                  )}
                  <a href="tel:+63428643000" style={{ color: '#003DA5', textDecoration: 'none' }}>8643-0000</a> local 101, 102, or 103
                </p>
              </div>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#333333', marginBottom: 6, textTransform: 'uppercase' }}>Office Address</p>
                <p style={{ fontSize: 13, color: '#333333', lineHeight: 1.8 }}>
                  Lucena City Government Complex<br />
                  Diversion Road, Brgy. Kanlurang Mayao<br />
                  Lucena City, Quezon, Philippines
                </p>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#333333', marginBottom: 6, textTransform: 'uppercase' }}>Social Media</p>
                <a href={FACEBOOK_PAGE_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#003DA5', textDecoration: 'none' }}>facebook.com/lucenalguofficial</a>
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 700, color: '#003DA5', marginBottom: 32, textAlign: 'center' }}>Our Office</h2>
            <div className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ marginBottom: 32, padding: '24px 32px' }}>
              <div style={{ marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid #DDDDDD' }}>
                <iframe
                  title="Lucena City Government Complex Map"
                  src="https://www.google.com/maps?q=Lucena%20City%20Government%20Complex%2C%20Diversion%20Road%2C%20Brgy.%20Kanlurang%20Mayao%2C%20Lucena%20City%2C%20Quezon&output=embed"
                  width="100%"
                  height="220"
                  style={{ border: 0, display: 'block' }}
                  loading="lazy"
                />
              </div>
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 12 }}>Lucena City Government Complex</h3>
                <p style={{ fontSize: 14, color: '#333333', lineHeight: 1.8 }}>
                  Diversion Road, Brgy. Kanlurang Mayao<br />
                  Lucena City, Quezon<br />
                  Philippines
                </p>
              </div>
              <div style={{ paddingTop: 24, borderTop: '1px solid #DDDDDD' }}>
                {siteInfo?.trunkline && (
                  <p style={{ fontSize: 13, color: '#666666', marginBottom: 12 }}>
                    <strong>Central Hotline:</strong> {siteInfo.trunkline}
                  </p>
                )}
                {siteInfo?.office_hours && (
                  <p style={{ fontSize: 13, color: '#666666' }}>
                    <strong>Office Hours:</strong> {siteInfo.office_hours}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ padding: '24px 32px' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#003DA5', marginBottom: 16 }}>Services Available</h3>
              <ul style={{ fontSize: 13, color: '#333333', lineHeight: 2, listStyle: 'none', paddingLeft: 0 }}>
                <li>✓ Yellow Card Registration</li>
                <li>✓ Incident Reporting</li>
                <li>✓ Venue Booking Inquiries</li>
                <li>✓ General Information</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* The site footer moved to `app/layout.tsx` (components/SiteFooter) so
          it renders on every route. It used to live only here, which meant the
          Terms and Privacy links — the documents sign-up requires a citizen to
          consent to — were reachable from the home page and nowhere else. */}
    </>
  );
}
