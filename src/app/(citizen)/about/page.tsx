'use client';

import { useState, useEffect } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { catalogService, type SiteInfo, type SiteInfoEntry } from '@/portals/citizen/lib/supabase/catalogs';

type SectionKey = 'city-government' | 'directory' | 'awards' | 'invest';
type GovTabKey = 'city-hall' | 'mayor' | 'vice-mayor' | 'council' | 'barangays';

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const HomeIcon = () => (
  <svg {...iconProps}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>
);
const PersonIcon = () => (
  <svg {...iconProps}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
);
const StarIcon = () => (
  <svg {...iconProps}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);
const TrendUpIcon = () => (
  <svg {...iconProps}><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></svg>
);
const TargetIcon = () => (
  <svg {...iconProps}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
);
const MapPinIcon = () => (
  <svg {...iconProps}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></svg>
);
const BriefcaseIcon = () => (
  <svg {...iconProps}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);

const SIDEBAR_ITEMS: { key: SectionKey; label: string; icon: () => React.ReactElement }[] = [
  { key: 'city-government', label: 'City Government', icon: HomeIcon },
  { key: 'directory', label: 'Directory', icon: PersonIcon },
  { key: 'awards', label: 'Awards & Recognition', icon: StarIcon },
  { key: 'invest', label: 'Why Invest in Lucena', icon: TrendUpIcon },
];

const GOV_TABS: { key: GovTabKey; label: string }[] = [
  { key: 'city-hall', label: 'City Hall' },
  { key: 'mayor', label: 'The Mayor' },
  { key: 'vice-mayor', label: 'Vice Mayor' },
  { key: 'council', label: 'City Council' },
  { key: 'barangays', label: 'Barangays' },
];

const SECTION_PLACEHOLDERS: Record<Exclude<SectionKey, 'city-government' | 'awards' | 'invest'>, { title: string; subtitle: string; body: string }> = {
  directory: {
    title: 'Directory',
    subtitle: 'City offices and personnel',
    body: 'Content pending. Add a searchable directory of city offices, department heads, and contact details.',
  },
};

type AwardCategory = 'Governance' | 'Anti-Drug' | 'Environment' | 'Health' | 'Leadership' | 'Education';

const AWARD_CATEGORIES: AwardCategory[] = ['Governance', 'Anti-Drug', 'Environment', 'Health', 'Leadership', 'Education'];

const CATEGORY_COLORS: Record<AwardCategory, string> = {
  'Governance': '#003DA5',
  'Anti-Drug': '#DC2626',
  'Environment': '#22C55E',
  'Health': '#F97316',
  'Leadership': '#8B5CF6',
  'Education': '#F59E0B',
};

interface AwardEntry {
  agency: string;
  year: string;
  title: string;
  desc: string;
  category: AwardCategory;
  photoNote: string;
  isStub?: boolean;
  image?: string;
  verified?: boolean;
}

const AWARD_ENTRIES: AwardEntry[] = [
  {
    agency: 'DILG', year: '2024', category: 'Governance',
    title: 'Seal of Good Local Governance',
    desc: 'Conferred to LGUs passing all core assessment areas, including financial administration, disaster preparedness, and social protection.',
    photoNote: 'Placeholder — awaiting photo release from Lucena PIO.',
  },
  {
    agency: 'DILG', year: '2023', category: 'Governance',
    title: 'Seal of Good Financial Housekeeping',
    desc: 'Recognises compliance with full-disclosure requirements and an unqualified audit standing.',
    photoNote: 'Placeholder — awaiting photo release from Lucena PIO.',
  },
  {
    agency: 'DILG', year: '2018', category: 'Anti-Drug',
    title: 'City Anti-Drug Abuse Council (CADAC) Award',
    desc: 'Recognises the functionality of the city’s anti-drug council and its coordination with barangay-level BADACs.',
    photoNote: 'Placeholder — awaiting photo release from Lucena PIO.',
  },
  {
    agency: 'PDEA / DILG', year: '2026', category: 'Anti-Drug',
    title: 'Barangay Market View declared drug-cleared',
    desc: 'Barangay-level clearance achieved with the Lucena CADAC and the Quezon Police Provincial Office.',
    photoNote: 'Placeholder — awaiting photo release from Lucena PIO.',
  },
  {
    agency: '–', year: '2017', category: 'Environment',
    title: 'Sanitary Landfill conversion (RA 9003 compliance)',
    desc: 'The city open dumpsite was converted to a sanitary landfill. Other LGUs have since conducted benchmarking visits.',
    photoNote: 'Placeholder — awaiting photo release from Lucena PIO.',
  },
  {
    agency: '–', year: '–', category: 'Governance', isStub: true,
    title: 'Highly Urbanized City — recognition pending confirmation',
    desc: 'A photo on file references a “Highly Urbanized City” recognition, but the awarding body, year, and specific achievement have not yet been confirmed. Add verified details from the City PIO.',
    photoNote: 'Photo on file — awaiting written confirmation from Lucena PIO.',
    image: '/Highly Urbanized City.jpg',
  },
  {
    agency: '–', year: '–', category: 'Governance', isStub: true,
    title: 'Top 10 Performing Cities — recognition pending confirmation',
    desc: 'A photo on file suggests Lucena was ranked among the “Top 10 Performing Cities” in some index or survey, but the awarding body, year, and ranking source have not yet been confirmed. Add verified details from the City PIO.',
    photoNote: 'Photo on file — awaiting written confirmation from Lucena PIO.',
    image: '/Top 10 performing cities.jpg',
  },
  {
    agency: '–', year: '–', category: 'Health', isStub: true,
    title: 'City Public Market — recognition pending confirmation',
    desc: 'A photo on file indicates the Lucena Public Market received some form of recognition, but the awarding body, year, and specific citation have not yet been confirmed. Add verified details from the City PIO.',
    photoNote: 'Photo on file — awaiting written confirmation from Lucena PIO.',
    image: '/City public market recognized.jpg',
  },
  {
    agency: 'Philippine Councilors League', year: '2026', category: 'Leadership', verified: true,
    title: 'National Finalist — 2025 Local Legislative Awards (Highly Urbanized City Category)',
    desc: 'The Sangguniang Panlungsod was named a National Finalist in the Highly Urbanized City category at the Philippine Councilors League Congress — commended by the Quezon Provincial Board through Provincial Resolution 2026-173, received on the council’s behalf by Councilors Brizuela and Ona.',
    photoNote: 'Photo: council recognition at the Philippine Councilors League Congress.',
    image: '/2025 Local legislative award.jpg',
  },
  {
    agency: '–', year: '–', category: 'Education', isStub: true,
    title: 'Awaiting verified entry',
    desc: 'No education recognition confirmed yet. Add from PIO records.',
    photoNote: 'No image on file.',
  },
];

const AWARD_STATS = [
  { value: String(AWARD_ENTRIES.length), label: 'Recognitions' },
  { value: '4', label: 'Awarding Bodies' },
  { value: '2017–2026', label: 'Years Covered' },
  { value: '1', label: 'Independently Verifiable' },
];

function AwardCard({ entry }: { entry: AwardEntry }) {
  const accent = CATEGORY_COLORS[entry.category];
  return (
    <div className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ borderLeft: `4px solid ${accent}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{entry.agency}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#666666' }}>{entry.year}</span>
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#003DA5', marginBottom: 8, lineHeight: 1.35 }}>{entry.title}</h3>
        <p style={{ fontSize: 13, color: '#666666', lineHeight: 1.6 }}>{entry.desc}</p>
      </div>

      {entry.image ? (
        <div style={{ height: 140, margin: '0 20px', borderRadius: 6, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={encodeURI(entry.image)} alt={entry.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      ) : (
        <div style={{
          height: 140,
          margin: '0 20px',
          borderRadius: 6,
          background: 'repeating-linear-gradient(45deg, #F0F0F0, #F0F0F0 10px, #FAFAFA 10px, #FAFAFA 20px)',
          border: '1px solid #EEEEEE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Photo Slot · 16:9</span>
        </div>
      )}

      <div style={{ padding: '14px 20px', marginTop: 14 }}>
        {/* "Placeholder — awaiting photo release from Lucena PIO" is an
            internal workflow note; only a real caption is shown. */}
        {entry.photoNote && !entry.photoNote.startsWith('Placeholder') && (
          <p style={{ fontSize: 12, color: '#003DA5', marginBottom: 8 }}>{entry.photoNote}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, borderTop: '1px solid #EEEEEE' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: entry.verified ? '#22C55E' : '#F59E0B' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{entry.verified ? 'Source verified' : 'Source pending confirmation'}</span>
        </div>
      </div>
    </div>
  );
}

function AwardsTab() {
  const [filter, setFilter] = useState<AwardCategory | 'All'>('All');
  // `isStub` entries are internal editorial notes, not content. They rendered
  // to the public as cards titled "— recognition pending confirmation" whose
  // body read "Add verified details from the City PIO" — an instruction to a
  // colleague, published on a government site. The rows stay in the file so the
  // PIO can complete and un-stub them; they simply do not render until then.
  const publishable = AWARD_ENTRIES.filter((e) => !e.isStub);
  const filtered = filter === 'All' ? publishable : publishable.filter((e) => e.category === filter);

  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#003DA5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Governance / Awards &amp; Recognition
      </p>
      <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 700, color: '#003DA5', marginBottom: 16, lineHeight: 1.25 }}>
        What Lucena has been held to account for.
      </h2>
      <p style={{ fontSize: 15, color: '#666666', lineHeight: 1.8, maxWidth: 720, marginBottom: 28 }}>
        Every recognition below names the body that conferred it and the year it was earned. Where an award can be checked against a public register, we link to it. Ceremony photographs are evidence, not the claim.
      </p>

      <div className="bg-white border border-[#DDDDDD] rounded" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 28 }}>
        {AWARD_STATS.map((stat, i) => (
          <div key={stat.label} style={{ padding: '16px 20px', borderLeft: i > 0 ? '1px solid #EEEEEE' : 'none' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#003DA5', marginBottom: 4 }}>{stat.value}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 24, marginBottom: 24, borderBottom: '1px solid #DDDDDD' }}>
        <button
          onClick={() => setFilter('All')}
          style={{
            background: filter === 'All' ? '#003DA5' : '#FFFFFF',
            color: filter === 'All' ? '#FFFFFF' : '#333333',
            border: '1px solid ' + (filter === 'All' ? '#003DA5' : '#DDDDDD'),
            borderRadius: 999, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          All
        </button>
        {AWARD_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              background: filter === cat ? '#003DA5' : '#FFFFFF',
              color: filter === cat ? '#FFFFFF' : '#333333',
              border: '1px solid ' + (filter === cat ? '#003DA5' : '#DDDDDD'),
              borderRadius: 999, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {filtered.map((entry, i) => (
          <AwardCard key={`${entry.title}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}

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
  return (
    <div style={{ overflow: 'hidden', borderRadius: 8, marginBottom: 32, width: '100%', maxWidth: '100%' }}>
      <div className="invest-marquee-track" style={{ display: 'flex', gap: 16, width: 'max-content' }}>
        {images.map((src, i) => (
          <div key={i} style={{ width: 220, height: 150, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={encodeURI(src)} alt="Lucena investment landscape" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ))}
      </div>
      <style>{`
        .invest-marquee-track {
          animation: invest-marquee-scroll 45s linear infinite;
        }
        .invest-marquee-track:hover {
          animation-play-state: paused;
        }
        @keyframes invest-marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function InvestTab() {
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

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: active ? '1px solid #003DA5' : '1px solid transparent',
        color: active ? '#003DA5' : '#666666',
        fontWeight: active ? 700 : 500,
        fontSize: 14,
        padding: '8px 16px',
        borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function CityHallTab() {
  // Trunkline, office hours and the floor directory are LGU-editable config in
  // `public_site_info` / `public_site_info_entries`. Loaded here rather than
  // drilled through GovernmentTabContent; catalogService memoises the reads.
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [floorDirectory, setFloorDirectory] = useState<SiteInfoEntry[]>([]);

  useEffect(() => {
    (async () => {
      const [info, floors] = await Promise.all([
        catalogService.getSiteInfo().catch(() => null),
        catalogService.getFloorDirectory().catch(() => []),
      ]);
      setSiteInfo(info);
      setFloorDirectory(floors);
    })();
  }, []);

  const quickFacts: { label: string; value: string }[] = [
    ...(siteInfo?.office_hours ? [{ label: 'Open', value: siteInfo.office_hours }] : []),
    ...(siteInfo?.trunkline ? [{ label: 'Trunkline', value: siteInfo.trunkline }] : []),
    // TODO(config): these two restate floor_directory rows but can't be derived
    // from them without matching on free text the LGU can edit. See handoff §3.
    { label: 'Business Permits', value: '2nd Floor' },
    { label: 'Civil Registry', value: '3rd Floor' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#003DA5', marginBottom: 4 }}>Lucena City Government Complex</h2>
      <p style={{ fontSize: 14, color: '#666666', marginBottom: 24 }}>Diversion Road, Brgy. Mayao Kanluran, Lucena City 4301</p>

      <div className="bg-white border border-[#DDDDDD] rounded" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 28 }}>
        {quickFacts.map((item, i) => (
          <div key={item.label} style={{ padding: '16px 20px', borderLeft: i > 0 ? '1px solid #EEEEEE' : 'none' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{item.label}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#333333' }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="fluid-media"
          src="/lucena-city-hall.jpg"
          alt="Lucena City Government Complex"
          style={{ width: '100%', height: 340, objectFit: 'cover', display: 'block' }}
        />
      </div>
      <p style={{ fontSize: 12, color: '#666666', background: '#F5F5F5', padding: '10px 14px', borderRadius: '0 0 8px 8px', marginBottom: 28 }}>
        The Lucena City Government Complex along Diversion Road, Brgy. Mayao Kanluran.
      </p>

      <p style={{ fontSize: 15, color: '#333333', lineHeight: 1.8, marginBottom: 16 }}>
        The City Government Complex houses the offices of the Mayor, the Sangguniang Panlungsod, and the frontline departments that handle most citizen transactions &mdash; business permits, civil registry, assessment, and treasury.
      </p>
      <p style={{ fontSize: 15, color: '#333333', lineHeight: 1.8, marginBottom: 28 }}>
        Most walk-in services are completed on the <strong>second and third floors</strong>. If you are unsure which office handles your request, the information desk on the ground floor can direct you.
      </p>

      {floorDirectory.length > 0 && (
        <div style={{ paddingTop: 24, borderTop: '1px solid #DDDDDD' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#333333', marginBottom: 16 }}>Find an office by floor</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {floorDirectory.map((row) => (
              <div key={`${row.kind}-${row.sort_order}`} className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, padding: '12px 16px', background: '#F5F9FC', borderRadius: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#003DA5' }}>{row.label}</span>
                <span style={{ fontSize: 13, color: '#333333' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface QuickFact {
  label: string;
  value: string;
}

function OfficialProfileTab({
  title, floor, image, name, position, bioParagraphs, quickFacts,
}: {
  title: string; floor: string; image: string; name: string; position: string;
  bioParagraphs: string[]; quickFacts: QuickFact[];
}) {
  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#003DA5', marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 14, color: '#666666', marginBottom: 24 }}>{floor}, City Government Complex</p>

      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32, marginBottom: 28 }}>
        <div style={{ borderRadius: 8, overflow: 'hidden', aspectRatio: '4 / 5' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={encodeURI(image)} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#222222', marginBottom: 4 }}>{name}</h3>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#003DA5', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>{position}</p>
          {bioParagraphs.map((para, i) => (
            <p key={i} style={{ fontSize: 14, color: '#333333', lineHeight: 1.8, marginBottom: i < bioParagraphs.length - 1 ? 14 : 0 }}>{para}</p>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 24, borderTop: '1px solid #DDDDDD' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#333333', marginBottom: 16 }}>Quick Facts</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {quickFacts.map((fact) => (
            <div key={fact.label} style={{ padding: '12px 16px', background: '#F5F9FC', borderRadius: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{fact.label}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#333333' }}>{fact.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface CouncilMember {
  name: string;
  party: string;
  votes: string;
  image: string;
  bio: string;
}

const COUNCIL_MEMBERS: CouncilMember[] = [
  {
    name: 'Danny Faller', party: 'Stand Up Quezon', votes: '91,550', image: '/dannyfaller.jpg',
    bio: 'Topped the 2025 city council race, centering his public service career on community-level infrastructure development and localized social service programs.',
  },
  {
    name: 'Amer Lacerna', party: 'Stand Up Quezon', votes: '85,201', image: '/amerlacerna.jpg',
    bio: 'Re-elected in 2025 and continues to lead local urban development and housing initiatives as Chairperson of the Committee on Subdivision, Housing, and Real Estate.',
  },
  {
    name: 'Wilbert Mckinly Noche', party: 'Stand Up Quezon', votes: '83,493', image: '/Wilbert Mckinly Noche.jpg',
    bio: 'Leveraged his professional background as a real estate broker to secure a seat, focusing his legislative advocacy on local commerce, business regulation, and youth sports development.',
  },
  {
    name: 'Patrick Nadera', party: 'Stand Up Quezon', votes: '83,386', image: '/Patrick nadera.jpg',
    bio: 'Earned a council seat in 2025, dedicating his public office to barangay empowerment, grassroots athletic programs, and accessible community health services.',
  },
  {
    name: 'Benito "Baste" Brizuela Jr.', party: 'Stand Up Quezon', votes: '79,248', image: '/Baste brizuela.jpg',
    bio: 'Secured his seat while expanding his legislative influence beyond local borders, serving as chapter president for the Philippine Councilors League.',
  },
  {
    name: 'Jose Christian Ona', party: 'Stand Up Quezon', votes: '78,875', image: '/Jose Christian Ona.jpg',
    bio: 'Successfully maintained his council seat in 2025, driving municipal agendas centered on public health safety nets and environmental sustainability programs.',
  },
  {
    name: 'Beth Sio', party: 'Stand Up Quezon', votes: '75,284', image: '/Beth Sio.jpg',
    bio: 'Won re-election in 2025, anchoring her legislative platform on women’s welfare, maternal healthcare, and grassroots livelihood programs for vulnerable sectors.',
  },
  {
    name: 'Ryan Caezar "Ayan" Alcala', party: 'Independent', votes: '75,145', image: '/Ayan alcala.jpg',
    bio: 'Sustained his strong independent support in 2025, continuing his advocacy for youth leadership, educational scholarships, and digital transparency in local governance.',
  },
  {
    name: 'Sunshine Abcede', party: 'KNP', votes: '72,511', image: '/Sunshine abcedae.jpg',
    bio: 'Returned to the local legislature in 2025, bringing her extensive prior governance experience to the council with a core focus on consumer protection and public administration oversight.',
  },
  {
    name: '"Dok Love" Pureza', party: 'Lakas', votes: '72,060', image: '/Dok Love Pureza.jpg',
    bio: 'Entered the city council after the 2025 elections, prioritizing public healthcare access, preventative medical services, and general community welfare initiatives.',
  },
];

function CouncilorCard({ member }: { member: CouncilMember }) {
  return (
    <div style={{ display: 'flex', gap: 16, padding: '16px 18px', background: '#F5F9FC', borderRadius: 8 }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#DDE7F5' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={encodeURI(member.image)} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#222222' }}>{member.name}</p>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#003DA5', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{member.party}</span>
          <span style={{ fontSize: 12, color: '#666666' }}>{member.votes} votes</span>
        </div>
        <p style={{ fontSize: 13, color: '#333333', lineHeight: 1.7 }}>{member.bio}</p>
      </div>
    </div>
  );
}

function CouncilTab() {
  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#003DA5', marginBottom: 4 }}>Sangguniang Panlungsod</h2>
      <p style={{ fontSize: 14, color: '#666666', marginBottom: 24 }}>The city&apos;s legislative body</p>

      <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={encodeURI('/City council.jpg')} alt="Lucena City Council" style={{ width: '100%', display: 'block' }} />
      </div>
      <p style={{ fontSize: 12, color: '#666666', background: '#F5F5F5', padding: '10px 14px', borderRadius: '0 0 8px 8px', marginBottom: 28 }}>
        The Sangguniang Panlungsod ng Lucena.
      </p>

      <p style={{ fontSize: 14, color: '#333333', lineHeight: 1.8, marginBottom: 14 }}>
        The Sangguniang Panlungsod is composed of twelve members: ten elected councilors plus two ex-officio seats held by the ABC (Liga ng mga Barangay) President and the SK Federation President, with the Vice Mayor presiding. The ten elected for the 2025&ndash;2028 term, listed in order of votes received, are shown below. Stand Up Quezon holds seven of the ten elected seats, a working majority.
      </p>
      <p style={{ fontSize: 14, color: '#333333', lineHeight: 1.8, marginBottom: 28 }}>
        Known committee chairs include Nicanor Pedro Jr. (Social Welfare, PWDs, Senior Citizens, Women &amp; Family) and Americo &ldquo;Amer&rdquo; Lacerna (Subdivision, Housing &amp; Real Estate). The council&apos;s secretary is Leonard Pensader.
      </p>

      <div style={{ paddingTop: 8, marginBottom: 28 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#333333', marginBottom: 16 }}>Council Members</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          {COUNCIL_MEMBERS.map((member) => (
            <CouncilorCard key={member.name} member={member} />
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 18px', background: '#F5F9FC', borderRadius: 8, borderLeft: '4px solid #003DA5' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#003DA5', marginBottom: 6 }}>2026 Recognition</p>
        <p style={{ fontSize: 13, color: '#333333', lineHeight: 1.7 }}>
          In 2026 the body was named a National Finalist in the 2025 Local Legislative Awards, Highly Urbanized City category, at the Philippine Councilors League Congress &mdash; an achievement formally commended by the Quezon Provincial Board through Provincial Resolution 2026-173, received on the council&apos;s behalf by Councilors Brizuela and Ona.
        </p>
      </div>
    </div>
  );
}

const POBLACION_BARANGAYS = [
  'Barangay 1 (Poblacion)', 'Barangay 2 (Poblacion)', 'Barangay 3 (Poblacion)', 'Barangay 4 (Poblacion)',
  'Barangay 5 (Poblacion)', 'Barangay 6 (Poblacion)', 'Barangay 7 (Poblacion)', 'Barangay 8 (Poblacion)',
  'Barangay 9 (Poblacion)', 'Barangay 10 (Poblacion)', 'Barangay 11 (Poblacion)',
];

const OUTLYING_BARANGAYS = [
  'Abellanosa', 'Barra', 'Bocohan', 'Cotta', 'Dalahican', 'Domoit', 'Gulang-Gulang',
  'Ibabang Dupay', 'Ibabang Iyam', 'Ibabang Talim', 'Ilayang Dupay', 'Ilayang Iyam', 'Ilayang Talim',
  'Isabang', 'Kanlurang Mayao', 'Market View', 'Mayao Castillo', 'Mayao Crossing', 'Mayao Kanluran',
  'Mayao Parada', 'Mayao Silangan', 'Salinas',
];

function BarangayGroup({ title, barangays }: { title: string; barangays: string[] }) {
  return (
    <div style={{ marginBottom: 24, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: '#003DA5', padding: '10px 18px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1, background: '#DDDDDD' }}>
        {barangays.map((name) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#F5F9FC' }}>
            <span style={{ color: '#003DA5', flexShrink: 0 }}><MapPinIcon /></span>
            <span style={{ fontSize: 14, color: '#333333' }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarangayTab() {
  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#003DA5', marginBottom: 4 }}>Barangays of Lucena</h2>
      <p style={{ fontSize: 14, color: '#666666', marginBottom: 24 }}>
        {POBLACION_BARANGAYS.length + OUTLYING_BARANGAYS.length} barangays &mdash; {POBLACION_BARANGAYS.length} Poblacion and {OUTLYING_BARANGAYS.length} outlying
      </p>
      <BarangayGroup title="Poblacion Barangays" barangays={POBLACION_BARANGAYS} />
      <BarangayGroup title="Outlying Barangays" barangays={OUTLYING_BARANGAYS} />
    </div>
  );
}

function GovernmentTabContent({ tab }: { tab: GovTabKey }) {
  switch (tab) {
    case 'city-hall':
      return <CityHallTab />;
    case 'mayor':
      return (
        <OfficialProfileTab
          title="Office of the Mayor"
          floor="7th Floor"
          image="/Mayor.jpg"
          name="Mark Don Victor B. Alcala"
          position="City Mayor"
          bioParagraphs={[
            'Mark Don Victor B. Alcala is the 11th and current Mayor of Lucena City, now serving his second term (2025–2028) after winning re-election with 136,006 votes, or 68.20% of the vote, under Stand Up Quezon — a landslide over Efren Cruzat (10,320) and Benjamin Padiernos Jr. (4,336). First elected in 2022 and sworn in on June 30 of that year, he became the youngest mayor in the city’s history.',
            'He was educated entirely in the La Salle system — La Salle Greenhills, then College of St. Benilde, then De La Salle University, where he earned a BS in Business Management and played varsity basketball for the Green Archers. Before taking office he served as Youth Ambassador for the Local Youth Development Council and as an Executive Assistant for Support Services in the City Mayor’s Office, earning commendations from DepEd Lucena and the Lucena GPTA Federation for his work on education.',
            'He maintains an unusually large public presence for an LGU executive, with more than 650,000 Facebook followers and 150,000 on Instagram (@markalcala10), and delivered his second State of the City Address on July 31.',
          ]}
          quickFacts={[
            { label: 'Term', value: '2nd Term (2025–2028)' },
            { label: 'Party', value: 'Stand Up Quezon' },
            { label: '2025 Vote Share', value: '136,006 votes (68.20%)' },
            { label: 'First Elected', value: '2022 — youngest mayor in city history' },
          ]}
        />
      );
    case 'vice-mayor':
      return (
        <OfficialProfileTab
          title="Office of the Vice Mayor"
          floor="7th Floor"
          image="/Vice mayor.jpg"
          name='Roderick "Dondon" A. Alcala'
          position="City Vice Mayor"
          bioParagraphs={[
            'Roderick "Dondon" A. Alcala serves as Vice Mayor and Presiding Officer of the Sangguniang Panlungsod, re-elected in 2025 with 129,578 votes (64.98%) under Stand Up Quezon, ahead of Boyet Alejandrino (15,510) and Marbien De Juan Sr. (3,687).',
            'He is the father of Mayor Mark Don Victor B. Alcala, and was himself Mayor of Lucena from 2012 to 2022. Barred by term limits from seeking a fourth term, he ran instead for vice mayor alongside his son in 2022, forming the first father-and-son mayor–vice mayor tandem in the city’s electoral history.',
            'As Presiding Officer he chairs meetings of the city council but votes only to break a deadlock.',
          ]}
          quickFacts={[
            { label: 'Role', value: 'Vice Mayor & Presiding Officer' },
            { label: 'Party', value: 'Stand Up Quezon' },
            { label: '2025 Vote Share', value: '129,578 votes (64.98%)' },
            { label: 'Prior Office', value: 'Mayor of Lucena, 2012–2022' },
          ]}
        />
      );
    case 'council':
      return <CouncilTab />;
    case 'barangays':
      return <BarangayTab />;
  }
}

export default function AboutPage() {
  const router = useRouter();
  const [section, setSection] = useState<SectionKey>('city-government');
  const [govTab, setGovTab] = useState<GovTabKey>('city-hall');

  return (
    <section style={{ padding: '48px clamp(16px, 5vw, 48px) 80px', maxWidth: 1600, margin: '0 auto' }}>
      <button
        onClick={() => router.push('/')}
        style={{ background: 'none', border: 'none', color: '#003DA5', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Home
      </button>

      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 32, alignItems: 'start' }}>
        {/* Sidebar */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#003DA5', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #DDDDDD' }}>
            About Lucena City
          </h1>
          <div style={{ display: 'grid', gap: 4 }}>
            {SIDEBAR_ITEMS.map((item) => {
              const active = section === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setSection(item.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: active ? '#003DA5' : 'none',
                    color: active ? '#FFFFFF' : '#333333',
                    border: 'none', borderRadius: 6,
                    padding: '10px 14px', fontSize: 14, fontWeight: active ? 700 : 500,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <Icon />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{ minWidth: 0 }}>
          {section === 'city-government' ? (
            <div className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              <div style={{ display: 'flex', gap: 4, padding: '12px 20px', borderBottom: '1px solid #DDDDDD', background: '#F9FAFB', borderRadius: '6px 6px 0 0' }}>
                {GOV_TABS.map((tab) => (
                  <TabButton key={tab.key} active={govTab === tab.key} onClick={() => setGovTab(tab.key)}>
                    {tab.label}
                  </TabButton>
                ))}
              </div>
              <div style={{ padding: '32px 36px' }}>
                <GovernmentTabContent tab={govTab} />
              </div>
            </div>
          ) : section === 'awards' ? (
            <AwardsTab />
          ) : section === 'invest' ? (
            <div className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ padding: '32px 36px' }}>
              <InvestTab />
            </div>
          ) : (
            <div className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ padding: '32px 36px' }}>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: '#003DA5', marginBottom: 4 }}>{SECTION_PLACEHOLDERS[section].title}</h2>
              <p style={{ fontSize: 14, color: '#666666', marginBottom: 20 }}>{SECTION_PLACEHOLDERS[section].subtitle}</p>
              <p style={{ fontSize: 14, color: '#333333' }}>{SECTION_PLACEHOLDERS[section].body}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
