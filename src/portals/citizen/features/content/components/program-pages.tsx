import Link from 'next/link';
import type { ReactNode } from 'react';
import ProgramImage from '@/portals/citizen/features/content/components/program-image';
import {
  PROGRAM_CATEGORIES,
  PROGRAMS_OVERVIEW,
  type Program,
  type ProgramCategory,
} from '@/portals/citizen/features/content/lib/programs';

const crumbLinkStyle = { color: '#777777', textDecoration: 'none' };

function ProgramsLayout({ category, children }: { category?: ProgramCategory; children: ReactNode }) {
  return (
    <div style={{ padding: '24px clamp(16px, 5vw, 48px) 80px', maxWidth: 1400, margin: '0 auto' }}>
      <nav aria-label="Breadcrumb" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, background: '#E9ECEF', borderRadius: 4, padding: '10px 16px', fontSize: 14, marginBottom: 32 }}>
        <Link href="/" style={crumbLinkStyle}>Home</Link>
        <span aria-hidden style={{ color: '#777777' }}>/</span>
        {category ? (
          <>
            <Link href="/programs" style={crumbLinkStyle}>Programs</Link>
            <span aria-hidden style={{ color: '#777777' }}>/</span>
            <span aria-current="page" style={{ color: '#003DA5' }}>{category.name}</span>
          </>
        ) : (
          <span aria-current="page" style={{ color: '#003DA5' }}>Programs</span>
        )}
      </nav>

      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 40, alignItems: 'start' }}>
        <div>
          <p style={{ fontSize: 28, fontWeight: 600, color: '#222222', paddingBottom: 14, marginBottom: 20, borderBottom: '1px solid #8FA5C8' }}>Programs</p>
          {/* Auto-fill keeps one column in the 280px sidebar and fits two or
              more once the sidebar stacks above the content on smaller screens. */}
          <nav aria-label="Program categories" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {PROGRAM_CATEGORIES.map(({ name, slug }) => {
              const isCurrent = slug === category?.slug;
              return (
                <Link
                  key={slug}
                  href={`/programs/${slug}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={isCurrent ? 'bg-lucena-blue no-underline' : 'bg-[#E6E6E6] no-underline transition-colors hover:bg-[#D9D9D9]'}
                  style={{
                    padding: '11px 16px',
                    fontSize: 15,
                    fontWeight: 700,
                    borderLeft: '4px solid #A9A9A9',
                    color: isCurrent ? 'white' : '#003DA5',
                  }}
                >
                  {name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function ProgramDetails({ program }: { program: Program }) {
  const [mainImage, ...moreImages] = program.images;
  return (
    <article style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 700, color: '#003DA5', textAlign: 'center', letterSpacing: '0.02em', marginBottom: 24 }}>{program.name}</h2>
      {mainImage && <ProgramImage image={mainImage} />}
      <p style={{ fontSize: 16, color: '#333333', lineHeight: 1.8, margin: '24px 0', whiteSpace: 'pre-line' }}>{program.description}</p>
      {moreImages.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          {moreImages.map((image) => (
            <ProgramImage key={image.src ?? image.alt} image={image} height={180} />
          ))}
        </div>
      )}
      <div style={{ padding: 20, background: '#F0F8FF', borderRadius: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#003DA5', textTransform: 'uppercase', marginBottom: 8 }}>How to Apply</p>
        <p style={{ fontSize: 14, color: '#333333', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{program.howToApply}</p>
      </div>
    </article>
  );
}

const pageHeadingStyle = { fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 600, color: '#222222', lineHeight: 1.2, marginBottom: 24 };

/** `/programs`: the introduction, with the sidebar leading to each category. */
export function ProgramsOverview() {
  return (
    <ProgramsLayout>
      <h1 style={pageHeadingStyle}>City Programs</h1>
      <ProgramImage image={PROGRAMS_OVERVIEW.bannerImage} />
      <p style={{ fontSize: 16, color: '#333333', lineHeight: 1.8, marginTop: 24 }}>{PROGRAMS_OVERVIEW.introduction}</p>
      <p style={{ fontSize: 16, color: '#333333', lineHeight: 1.8, marginTop: 12 }}>Choose a category from the list to see its programs.</p>
    </ProgramsLayout>
  );
}

/** `/programs/<slug>`: every program in one category. */
export function ProgramCategoryPage({ category }: { category: ProgramCategory }) {
  return (
    <ProgramsLayout category={category}>
      <h1 style={pageHeadingStyle}>{category.name} Programs</h1>
      {category.programs.map((program) => (
        <ProgramDetails key={program.name} program={program} />
      ))}
    </ProgramsLayout>
  );
}
