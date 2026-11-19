'use client';

import type React from 'react';
import SlideshowToggle from '@/portals/citizen/features/content/components/slideshow-toggle';
import { usePausable } from '@/portals/citizen/features/content/hooks/use-pausable';
import { BriefcaseIcon, MapPinIcon, TargetIcon, TrendUpIcon } from '@/portals/citizen/features/content/components/about-icons';

interface InvestPoint {
  lead: string;
  desc: string;
}

const INVEST_STATS = [
  { value: '5.9%', label: 'GDP Growth (2024)' },
  { value: '6,000+', label: 'Registered Businesses' },
  { value: '23.8', label: 'Median Age' },
  { value: '0.56%', label: 'City Land Zoned Industrial' },
];

const INVEST_OVERVIEW_CARDS: { icon: () => React.ReactElement; title: string; teaser: string }[] = [
  {
    icon: TrendUpIcon, title: 'Why Invest in Lucena',
    teaser: 'Quezon’s capital and a highly urbanized city — one LGU, a measurably growing economy, and a young, locally-trained workforce with livability that retains staff.',
  },
  {
    icon: TargetIcon, title: 'Competitive Advantage',
    teaser: 'The SLEX TR4 terminus, two transport gateways, an established coconut cluster, validated anchor tenants, and industrial land that isn’t built out yet.',
  },
  {
    icon: MapPinIcon, title: 'Where the Activity Is',
    teaser: 'Growth is concentrated in Mayao Crossing, the Ibabang Dupay commercial core, and the Isabang and Dalahican industrial approaches — while the Poblacion’s residents move to the suburbs.',
  },
  {
    icon: BriefcaseIcon, title: 'Which Sectors the Data Supports',
    teaser: 'Coconut and oleochemicals, logistics and warehousing, food processing and cold chain, education-adjacent services, and healthcare.',
  },
];

const WHY_INVEST_POINTS: InvestPoint[] = [
  {
    lead: 'The capital, administratively independent.',
    desc: 'Lucena is Quezon’s capital and a highly urbanized city — you deal with one LGU, not a provincial layer above it. It’s the hub for commerce, healthcare, education, and governance for all of southern Luzon, so the addressable market is far larger than the city’s 280,331 residents.',
  },
  {
    lead: 'The economy is growing, measurably.',
    desc: 'GDP up 5.9% (2024), with an earlier year at 8.9%. Over 6,000 registered businesses (DTI) generating ₱1B+ in LGU revenue. Annual regular income climbed from ₱555.6M (2009) to ₱906.5M (2016).',
  },
  {
    lead: 'A young, locally-trained workforce.',
    desc: 'Median age 23.8. MSEUF is the only Autonomous University in Quezon, with the second-most accredited programs in Southern Tagalog behind only UP Los Baños. SLSU adds a state-university pipeline; DLL graduates students tuition-free.',
  },
  {
    lead: 'Livability that retains staff.',
    desc: 'Five 24-hour hospitals, four malls, crime down 13.2% in 2024. Type III climate — no pronounced dry season.',
  },
];

const COMPETITIVE_ADVANTAGE_POINTS: InvestPoint[] = [
  {
    lead: '① The SLEX TR4 terminus.',
    desc: 'This is the real one. The extension runs from Santo Tomas, Batangas and ends at Maharlika Highway in Brgy. Mayao — roughly halving travel time to Batangas and Metro Manila. Tayabas, Sariaya, and Lucban get nothing comparable. It is a structural, permanent, non-replicable advantage.',
  },
  {
    lead: '② Two gateways, one city.',
    desc: 'The Port of Lucena/Dalahican (RoRo to Marinduque, Masbate, Batangas, with vehicle loading) and the Lucena Grand Central Terminal (the province’s principal land hub, with LTO, OWWA, MARINA, and NBI on site). Everything entering or leaving Quezon moves through Lucena.',
  },
  {
    lead: '③ An established coconut cluster.',
    desc: 'Not a plan — an operating supply chain. JNJ Oil, JNJ Oleochemicals, Monaco Oil Mill, Empire Oil, all buying copra daily from farmers across the province. A new entrant inherits the inputs, the logistics, and the labor.',
  },
  {
    lead: '④ Anchor tenants already validated it.',
    desc: 'San Miguel Brewery and Coca-Cola both operate here. That’s a due-diligence shortcut: two of the country’s most demanding site-selection teams already said yes.',
  },
  {
    lead: '⑤ Industrial headroom.',
    desc: 'Only 0.56% of city land — 46.62 hectares — is currently zoned industrial. Lucena is a designated emerging Economic Zone. Unlike Metro Manila or Batangas industrial corridors, it isn’t built out.',
  },
];

const ACTIVITY_AREA_POINTS: InvestPoint[] = [
  {
    lead: 'Brgy. Mayao (Crossing, Kanluran, Silangan, Parada, Castillo)',
    desc: 'The SLEX TR4 terminus lands here, and Mayao Crossing grew 38.5% between censuses, the fastest in the city. This is where the infrastructure and the population are both moving.',
  },
  {
    lead: 'Brgy. Ibabang Dupay',
    desc: 'SM City Lucena, MSEUF, SLSU. The city’s commercial-institutional core, and one of the three largest barangays (28,119).',
  },
  {
    lead: 'Brgy. Isabang',
    desc: 'On the Maharlika Highway/Diversion Road corridor, at the Bagong Lucena Welcome Rotonda. Grew 24.9%. The natural western industrial approach.',
  },
  {
    lead: 'Brgy. Dalahican / Cotta',
    desc: 'The port, the Fish Port Complex, JNJ Oleochemicals. Anything logistics, marine, or export-oriented sits here.',
  },
  {
    lead: 'The Poblacion (Brgys. 1–11)',
    desc: 'The dense CBD. But note the data: it’s shrinking. Brgy. 6 fell 28.9%, Brgy. 2 fell 27.1%. Foot traffic and retail are still here; residents are leaving for the suburbs.',
  },
];

const SECTOR_POINTS: InvestPoint[] = [
  { lead: 'Coconut / oleochemicals', desc: 'The city’s signature industry, with an existing cluster and farmer supply base.' },
  { lead: 'Logistics & warehousing', desc: 'The SLEX terminus plus two gateways is the whole thesis in one line.' },
  { lead: 'Food processing & cold chain', desc: 'A 24-hour fish port with no visible cold-chain infrastructure around it is a conspicuous gap.' },
  { lead: 'Education-adjacent services', desc: 'A young median age plus multiple universities plus a tuition-free city college.' },
  { lead: 'Healthcare', desc: 'Five hospitals, all rated between 2.8 and 3.8. Demand clearly exceeds current quality of supply.' },
];

const INVEST_CAROUSEL_IMAGES = [
  '/s.jpg',
  '/grand-central-terminal.jpg',
  '/539240405_764567489752411_1709203008154177906_n.jpg',
  '/images (10).jpg',
  '/images (11).jpg',
  '/images (12).jpg',
  '/images (13).jpg',
  '/images (14).jpg',
  '/images (15).jpg',
  '/images (16).jpg',
  '/images (17).jpg',
  '/images (18).jpg',
  '/images (19).jpg',
  '/images (20).jpg',
  '/images (21).jpg',
];

function InfoRow({ point }: { point: InvestPoint }) {
  return (
    <div style={{ padding: '14px 16px', background: '#F5F9FC', borderRadius: 6 }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#003DA5', marginBottom: 6 }}>{point.lead}</p>
      <p style={{ fontSize: 13, color: '#333333', lineHeight: 1.7 }}>{point.desc}</p>
    </div>
  );
}

function InvestSection({ title, points }: { title: string; points: InvestPoint[] }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#003DA5', marginBottom: 14 }}>{title}</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        {points.map((point) => (
          <InfoRow key={point.lead} point={point} />
        ))}
      </div>
    </div>
  );
}

function InvestImageMarquee() {
  const images = [...INVEST_CAROUSEL_IMAGES, ...INVEST_CAROUSEL_IMAGES];
  // Holds still under its button, a pointer or keyboard focus (WCAG 2.2.2).
  // Under reduced motion the global stylesheet's rule already stops the
  // animation (and the hook starts paused); with nothing to pause, the button
  // is not shown.
  const strip = usePausable();
  return (
    <div {...strip.regionProps} style={{ position: 'relative', overflow: 'hidden', borderRadius: 8, marginBottom: 32, width: '100%', maxWidth: '100%' }}>
      {/* Decoration: the tab's text makes the case, so the photos are hidden from
          assistive technology. aria-hidden stays on the track, not the wrapper, so a
          control added beside the track stays reachable. */}
      <div className="invest-marquee-track" aria-hidden="true" style={{ display: 'flex', gap: 16, width: 'max-content', animationPlayState: strip.moving ? 'running' : 'paused' }}>
        {images.map((src, i) => (
          <div key={i} style={{ width: 220, height: 150, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={encodeURI(src)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ))}
      </div>
      {!strip.reducedMotion && (
        // Kept outside the aria-hidden track, so screen readers reach it too.
        <SlideshowToggle playing={strip.playing} onToggle={strip.toggle} subject="image strip"
          style={{ position: 'absolute', right: 12, bottom: 12, width: 24, height: 24, borderRadius: '50%', background: 'white', color: '#333333', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
      )}
      <style>{`
        .invest-marquee-track {
          animation: invest-marquee-scroll 45s linear infinite;
        }
        @keyframes invest-marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

export function InvestTab() {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#003DA5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Economic Development / Why Invest in Lucena
      </p>
      <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 700, color: '#003DA5', marginBottom: 16, lineHeight: 1.25 }}>
        A strategic location. Endless opportunities.
      </h2>
      <p style={{ fontSize: 15, color: '#666666', lineHeight: 1.8, maxWidth: 720, marginBottom: 28 }}>
        Quezon&apos;s capital, a growing economy, and industrial land that isn&apos;t built out yet — here&apos;s what the data says about investing in Lucena.
      </p>

      <div className="bg-white border border-[#DDDDDD] rounded" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 28 }}>
        {INVEST_STATS.map((stat, i) => (
          <div key={stat.label} style={{ padding: '16px 20px', borderLeft: i > 0 ? '1px solid #EEEEEE' : 'none' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#003DA5', marginBottom: 4 }}>{stat.value}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 32 }}>
        {INVEST_OVERVIEW_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ padding: '20px 18px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', color: '#003DA5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Icon />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#222222', marginBottom: 8 }}>{card.title}</h3>
              <p style={{ fontSize: 13, color: '#666666', lineHeight: 1.6 }}>{card.teaser}</p>
            </div>
          );
        })}
      </div>

      <InvestImageMarquee />

      <InvestSection title="1. Why Invest in Lucena" points={WHY_INVEST_POINTS} />
      <InvestSection title="2. Competitive Advantage — what Lucena has that its neighbors don’t" points={COMPETITIVE_ADVANTAGE_POINTS} />
      <InvestSection title="3. Where the Activity Is — by area" points={ACTIVITY_AREA_POINTS} />
      <InvestSection title="4. Which Sectors the Data Supports" points={SECTOR_POINTS} />
    </div>
  );
}
