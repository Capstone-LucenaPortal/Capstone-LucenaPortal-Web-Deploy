import Link from 'next/link';
import ProgramImage from '@/portals/citizen/features/content/components/program-image';
import { PROGRAM_CATEGORIES, PROGRAMS_OVERVIEW } from '@/portals/citizen/features/content/lib/programs';

/** The home page's City Programs section. */
export default function ProgramsSummary() {
  return (
    <section id="city-programs" style={{ padding: '40px clamp(16px, 5vw, 48px)', maxWidth: 1800, margin: '0 auto', marginBottom: 40, background: '#F5F9FC' }}>
      <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 700, color: '#003DA5', marginBottom: 32, textAlign: 'center' }}>City Programs</h2>
      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 32 }}>
        <div>
          <ProgramImage image={PROGRAMS_OVERVIEW.homeImage} height={200} />
          <p style={{ fontSize: 15, color: '#333333', lineHeight: 1.7, marginTop: 16 }}>{PROGRAMS_OVERVIEW.homeSummary}</p>
        </div>
        <ul
          aria-label="Program categories"
          className="stack-mobile"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, listStyle: 'none', alignContent: 'start' }}
        >
          {PROGRAM_CATEGORIES.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/programs/${category.slug}`}
                className="block h-full bg-white border border-[#DDDDDD] rounded-lg no-underline transition-colors hover:border-lucena-blue"
                style={{ padding: '16px 18px' }}
              >
                <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: '#003DA5', marginBottom: 4 }}>{category.name}</span>
                <span style={{ display: 'block', fontSize: 13, color: '#666666', lineHeight: 1.5 }}>{category.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <Link
          href="/programs"
          style={{ padding: '12px 24px', fontSize: 15, fontWeight: 700, background: '#003DA5', color: 'white', borderRadius: 4, textDecoration: 'none' }}
        >
          View all programs <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
