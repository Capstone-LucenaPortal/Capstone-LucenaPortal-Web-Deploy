'use client';

import { useState, useEffect } from 'react';
import type React from 'react';
import { catalogService, type SiteInfo, type SiteInfoEntry } from '@/portals/citizen/lib/supabase/catalogs';
import { MapPinIcon } from '@/portals/citizen/features/content/components/about-icons';

export type GovTabKey = 'city-hall' | 'mayor' | 'vice-mayor' | 'council' | 'barangays';

export const GOV_TABS: { key: GovTabKey; label: string }[] = [
  { key: 'city-hall', label: 'City Hall' },
  { key: 'mayor', label: 'The Mayor' },
  { key: 'vice-mayor', label: 'Vice Mayor' },
  { key: 'council', label: 'City Council' },
  { key: 'barangays', label: 'Barangays' },
];

export function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

export function GovernmentTabContent({ tab }: { tab: GovTabKey }) {
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
