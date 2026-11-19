'use client';

import { useState } from 'react';

type AwardCategory = 'Governance' | 'Leadership';

const AWARD_CATEGORIES: AwardCategory[] = ['Governance', 'Leadership'];

const CATEGORY_COLORS: Record<AwardCategory, string> = {
  'Governance': '#003DA5',
  'Leadership': '#8B5CF6',
};

interface AwardEntry {
  agency: string;
  year: string;
  title: string;
  desc: string;
  category: AwardCategory;
  photoNote: string;
  images: { src: string; alt: string }[];
  verified?: boolean;
}

const AWARD_ENTRIES: AwardEntry[] = [
  {
    agency: 'Department of Finance', year: '–', category: 'Governance',
    title: 'Top 10 Performing Cities',
    desc: 'Lucena City was named one of the Top 10 Performing Cities in Local Revenue Generation, awarded by the Department of Finance.',
    photoNote: 'Photo: announcement of the recognition.',
    images: [{ src: '/Top 10 performing cities.jpg', alt: 'Lucena City announced as one of the Top 10 Performing Cities in Local Revenue Generation' }],
  },
  {
    agency: '–', year: '2025', category: 'Governance',
    title: 'City Public Market Recognized',
    desc: 'The City Public Market Office was recognized as one of the best implementers of the Sa Lucena VIP Ka Program.',
    photoNote: 'Photo: City Public Market Office at the recognition.',
    images: [{ src: '/City public market recognized.jpg', alt: 'City Public Market Office staff recognized at the Sa Lucena VIP Ka Program' }],
  },
  {
    agency: 'Philippine Councilors League', year: '2026', category: 'Leadership', verified: true,
    title: '2025 Local Legislative Award',
    desc: 'The Sangguniang Panlungsod was named a National Finalist in the Highly Urbanized City category at the Philippine Councilors League Congress — commended by the Quezon Provincial Board through Provincial Resolution 2026-173, received on the council’s behalf by Councilors Brizuela and Ona.',
    photoNote: 'Photo: council recognition at the Philippine Councilors League Congress.',
    images: [{ src: '/2025 Local legislative award.jpg', alt: 'Lucena City National Finalist plaque with the 20th Sangguniang Panlungsod' }],
  },
  {
    agency: 'Philippine Councilors League', year: '2026', category: 'Leadership', verified: true,
    title: 'Highly Urbanized City',
    desc: 'Lucena City was named a National Finalist in the Highly Urbanized City (HUC) category at the 2025 Local Legislative Award National Recognition Ceremony, held at the World Trade Center, Pasay City on March 5, 2026.',
    photoNote: 'Photo: National Recognition Ceremony announcement.',
    images: [{ src: '/Highly Urbanized City.jpg', alt: 'City of Lucena National Finalist poster for the 2025 Local Legislative Award ceremony' }],
  },
  {
    agency: 'GCash', year: '2026', category: 'Governance', verified: true,
    title: 'GCash Award',
    desc: 'The Lucena City Public Market received the Palengke Digital Breakthrough Growth Award at the 5th GCash Digital Excellence Awards, recognizing its move to digitally enabled operations for vendors and shoppers. The ceremony was held at the Grand Hyatt Manila on February 19, 2026.',
    photoNote: 'Photo: Lucena City Public Market delegation at the awards.',
    images: [{ src: '/gcash award.jpg', alt: 'Lucena City Public Market delegation on stage at the GCash Digital Excellence Awards' }],
  },
];

const AWARD_STATS = [
  { value: String(AWARD_ENTRIES.length), label: 'Recognitions' },
  { value: '3', label: 'Awarding Bodies' },
  { value: '2025–2026', label: 'Years Covered' },
  { value: String(AWARD_ENTRIES.filter((e) => e.verified).length), label: 'Independently Verifiable' },
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

      {/* Natural height, not a cropped slot: these are mostly posters whose
          citation is printed in the image, and cropping cuts it off. */}
      <div style={{ display: 'grid', gap: 10, margin: '0 20px' }}>
        {entry.images.map((image) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={image.src} src={encodeURI(image.src)} alt={image.alt} loading="lazy" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 6 }} />
        ))}
      </div>

      <div style={{ padding: '14px 20px', marginTop: 14 }}>
        <p style={{ fontSize: 12, color: '#003DA5', marginBottom: 8 }}>{entry.photoNote}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, borderTop: '1px solid #EEEEEE' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: entry.verified ? '#22C55E' : '#F59E0B' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{entry.verified ? 'Source verified' : 'Source pending confirmation'}</span>
        </div>
      </div>
    </div>
  );
}

export function AwardsTab() {
  const [filter, setFilter] = useState<AwardCategory | 'All'>('All');
  const filtered = filter === 'All' ? AWARD_ENTRIES : AWARD_ENTRIES.filter((e) => e.category === filter);

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
