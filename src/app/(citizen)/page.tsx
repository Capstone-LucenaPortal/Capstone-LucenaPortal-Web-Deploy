'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/portals/citizen/features/auth/hooks/use-auth';
import { catalogService, type SiteInfo, type SiteInfoEntry } from '@/portals/citizen/lib/supabase/catalogs';

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/lucenalguofficial';

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

  const [heroSlide, setHeroSlide] = useState(0);
  const [lccSlide, setLccSlide] = useState(0);
  const [lccHovered, setLccHovered] = useState<number | null>(null);
  const [emergencyHotlines, setEmergencyHotlines] = useState<SiteInfoEntry[]>([]);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);

  const heroSlides = [
    { title: 'Welcome to Lucena City Portal', desc: 'Your gateway to city services and community information', image: '/lucena-city-hall.jpg', buttonText: 'Learn More', link: '/announcements', color: '#003DA5' },
    { title: 'City Programs', desc: 'Ongoing initiatives in health, livelihood, and infrastructure for Lucenahins', image: '/lucena-city-hall.jpg', buttonText: 'Learn More', link: '#city-programs', color: '#7C3F00' },
    { title: 'Lucena News', desc: 'Stay updated with the latest city news and developments', buttonText: 'Learn More', link: '/news', color: '#0E7490' },
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

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlide(prev => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLccSlide(prev => (prev + 1) % lccSlides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [lccSlides.length]);

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
        <div style={{ position: 'relative', height: '100%' }}>
          {/* Background image — no color overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: heroSlides[heroSlide].image
              ? `url('${heroSlides[heroSlide].image}') center/cover no-repeat`
              : `linear-gradient(135deg, ${heroSlides[heroSlide].color}E6, ${heroSlides[heroSlide].color}CC)`,
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
            <h1 style={{ fontSize: 'clamp(28px, 6vw, 44px)', fontWeight: 700, marginBottom: 14, lineHeight: 1.15, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>{heroSlides[heroSlide].title}</h1>
            <p style={{ fontSize: 17, marginBottom: 28, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>{heroSlides[heroSlide].desc}</p>
            <button
              onClick={() => {
                if (heroSlides[heroSlide].link !== '#') {
                  router.push(heroSlides[heroSlide].link);
                }
              }}
              style={{ padding: '12px 32px', fontSize: 15, fontWeight: 700, background: 'white', color: '#003DA5', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              {heroSlides[heroSlide].buttonText}
            </button>
          </div>

          {/* Navigation Arrows */}
          <button onClick={() => setHeroSlide((heroSlide - 1 + heroSlides.length) % heroSlides.length)}
            style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.25)', border: 'none', color: 'white', width: 48, height: 48, borderRadius: 4, cursor: 'pointer', fontSize: 20, zIndex: 3 }}>
            ←
          </button>
          <button onClick={() => setHeroSlide((heroSlide + 1) % heroSlides.length)}
            style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.25)', border: 'none', color: 'white', width: 48, height: 48, borderRadius: 4, cursor: 'pointer', fontSize: 20, zIndex: 3 }}>
            →
          </button>

          {/* Slide Indicators */}
          <div style={{ position: 'absolute', bottom: 76, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 3 }}>
            {heroSlides.map((_, i) => (
              <button key={i} onClick={() => setHeroSlide(i)}
                style={{ width: i === heroSlide ? 32 : 8, height: 8, background: i === heroSlide ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 999, cursor: 'pointer', transition: 'all 0.3s' }} />
            ))}
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
        </div>
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
            <div style={{ width: '100%' }}>
              {/* Page-plugin iframe, not the JS SDK: the live timeline renders
                  sandboxed on facebook.com's origin, so no third-party script
                  runs on the portal and CSP only needs frame-src. */}
              <iframe
                src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(FACEBOOK_PAGE_URL)}&tabs=timeline&width=500&height=640&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`}
                width={500}
                height={640}
                style={{ border: 'none', overflow: 'hidden', width: '100%', maxWidth: 500, display: 'block' }}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="encrypted-media"
                title="City of Lucena official Facebook feed"
              />
              <a
                href={FACEBOOK_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: '#003DA5', textDecoration: 'none' }}
              >
                Open the page on facebook.com →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* City Programs */}
      <section id="city-programs" style={{ padding: '40px clamp(16px, 5vw, 48px)', maxWidth: 1800, margin: '0 auto', marginBottom: 40, background: '#F5F9FC' }}>
        <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 700, color: '#003DA5', marginBottom: 32, textAlign: 'center' }}>City Programs</h2>
        <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { title: 'Health & Wellness Outreach', desc: 'Free community check-ups and vaccination drives across all barangays.' },
              { title: 'Livelihood & Skills Training', desc: 'Vocational training and micro-financing support for local entrepreneurs.' },
              { title: 'Infrastructure Modernization', desc: 'Road widening, flood control, and public facility upgrades citywide.' },
              { title: 'Youth & Education Support', desc: 'Scholarships and supplemental learning programs for Lucena students.' },
            ].map((program) => (
              <div key={program.title} style={{ display: 'flex', gap: 16 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#003DA5', marginTop: 8, flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#003DA5', marginBottom: 4 }}>{program.title}</h3>
                  <p style={{ fontSize: 14, color: '#333333', lineHeight: 1.7 }}>{program.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white border border-[#DDDDDD] rounded p-8 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ background: 'white', padding: 40 }}>
            <div style={{ background: '#003DA5', color: 'white', padding: 32, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Featured Program</div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>PROGRAM NAME PLACEHOLDER</p>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Short placeholder description of the city&apos;s current flagship program — replace with real content.</p>
            </div>
            <div style={{ marginTop: 24, padding: 20, background: '#F0F8FF', borderRadius: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#003DA5', textTransform: 'uppercase', marginBottom: 8 }}>How to Apply</p>
              <p style={{ fontSize: 13, color: '#333333', lineHeight: 1.6 }}>Placeholder — link or instructions on how residents can enroll or apply for this program.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Lucena Convention Center Carousel */}
      <section style={{ padding: '40px 0', maxWidth: '100%', overflow: 'hidden', margin: '0 auto', marginBottom: 40, background: '#FAFAFA' }}>
        <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 700, color: '#003DA5', marginBottom: 32, textAlign: 'center' }}>Lucena Convention Center</h2>

        <div style={{ position: 'relative', width: '100%', height: 'clamp(280px, 60vw, 500px)' }}>
          <div style={{
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
            transform: `translateX(calc(10% - ${lccSlide * 80}%))`
          }}>
            {lccSlides.map((slide, i) => {
              const isActive = i === lccSlide;
              const isHovered = lccHovered === i;
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
                    onClick={() => !isActive && setLccSlide(i)}
                    onMouseEnter={() => setLccHovered(i)}
                    onMouseLeave={() => setLccHovered(null)}
                  >
                    {/* Hover overlay */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,30,80,0.85) 0%, rgba(0,30,80,0.2) 60%, transparent 100%)',
                      opacity: isHovered ? 1 : 0,
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

          <button onClick={() => setLccSlide((lccSlide - 1 + lccSlides.length) % lccSlides.length)}
            style={{ position: 'absolute', left: '12%', top: '50%', transform: 'translateY(-50%)', background: 'white', border: 'none', color: '#333333', width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', fontSize: 20, zIndex: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
            ←
          </button>
          <button onClick={() => setLccSlide((lccSlide + 1) % lccSlides.length)}
            style={{ position: 'absolute', right: '12%', top: '50%', transform: 'translateY(-50%)', background: 'white', border: 'none', color: '#333333', width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', fontSize: 20, zIndex: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
            →
          </button>

          <div style={{ position: 'absolute', bottom: -30, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10 }}>
            {lccSlides.map((_, i) => (
              <button key={i} onClick={() => setLccSlide(i)}
                style={{ width: i === lccSlide ? 32 : 8, height: 8, background: i === lccSlide ? '#003DA5' : '#DDDDDD', border: 'none', borderRadius: 999, cursor: 'pointer', transition: 'all 0.3s' }} />
            ))}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            {emergencyHotlines.map((hotline) => (
              <div key={`${hotline.kind}-${hotline.sort_order}`} style={{ background: '#E8E8E8', padding: 32, borderRadius: 4, textAlign: 'center' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#003DA5', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{hotline.label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#333333' }}>{hotline.value}</p>
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
