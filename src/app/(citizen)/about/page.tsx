'use client';

import { useState } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import OfficeDirectory from '@/portals/citizen/features/content/components/office-directory';
import { HomeIcon, PersonIcon, StarIcon, TrendUpIcon } from '@/portals/citizen/features/content/components/about-icons';
import { AwardsTab } from '@/portals/citizen/features/content/components/about-awards';
import { InvestTab } from '@/portals/citizen/features/content/components/about-invest';
import { GOV_TABS, GovernmentTabContent, TabButton, type GovTabKey } from '@/portals/citizen/features/content/components/about-government';

type SectionKey = 'city-government' | 'directory' | 'awards' | 'invest';

const SIDEBAR_ITEMS: { key: SectionKey; label: string; icon: () => React.ReactElement }[] = [
  { key: 'city-government', label: 'City Government', icon: HomeIcon },
  { key: 'directory', label: 'Directory', icon: PersonIcon },
  { key: 'awards', label: 'Awards & Recognition', icon: StarIcon },
  { key: 'invest', label: 'Why Invest in Lucena', icon: TrendUpIcon },
];

export default function AboutPage() {
  const router = useRouter();
  const [section, setSection] = useState<SectionKey>('city-government');
  const [govTab, setGovTab] = useState<GovTabKey>('city-hall');

  return (
    <section className="page-section" style={{ padding: '48px clamp(16px, 5vw, 48px) 80px', maxWidth: 1600, margin: '0 auto' }}>
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
          <div className="chip-row" style={{ display: 'grid', gap: 4 }}>
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
              <div className="tab-scroll" style={{ display: 'flex', gap: 4, padding: '12px 20px', borderBottom: '1px solid #DDDDDD', background: '#F9FAFB', borderRadius: '6px 6px 0 0' }}>
                {GOV_TABS.map((tab) => (
                  <TabButton key={tab.key} active={govTab === tab.key} onClick={() => setGovTab(tab.key)}>
                    {tab.label}
                  </TabButton>
                ))}
              </div>
              <div className="card-pad" style={{ padding: '32px 36px' }}>
                <GovernmentTabContent tab={govTab} />
              </div>
            </div>
          ) : section === 'awards' ? (
            <AwardsTab />
          ) : section === 'invest' ? (
            <div className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)] card-pad" style={{ padding: '32px 36px' }}>
              <InvestTab />
            </div>
          ) : (
            <div className="bg-white border border-[#DDDDDD] rounded shadow-[0_1px_3px_rgba(0,0,0,0.08)] card-pad" style={{ padding: '32px 36px' }}>
              <OfficeDirectory />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
