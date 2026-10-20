'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import WeatherWidget from '@/portals/citizen/components/ui/weather-widget';
import type { PublicPost } from '@/portals/citizen/features/content/types';
import { contentService, siteContentUrl } from '@/portals/citizen/features/content/lib/content';
import { AGENCY_NAME } from '@/portals/citizen/lib/contact-info';
import { NO_DATE, formatManilaDate } from '@/shared/dates/manila';

const TEXT_TRUNCATE_LENGTH = 220;

/** "Apr 20, 2026" from a `published_at` timestamp. Returns '' for a row whose
 * timestamp will not parse rather than rendering "Invalid Date" to a citizen. */
function formatPublishedAt(value: string): string {
  const text = formatManilaDate(value, 'medium');
  return text === NO_DATE ? '' : text;
}

export default function AnnouncementsPage() {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    contentService
      .getPosts()
      .then((rows) => {
        if (cancelled) return;
        setPosts(rows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Could not load announcements right now.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section style={{ padding: '48px clamp(16px, 5vw, 48px) 80px', maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <Link
          href="/"
          style={{ background: 'none', border: 'none', color: '#003DA5', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, textDecoration: 'none' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Home
        </Link>
        <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: '#003DA5', marginBottom: 8 }}>City Announcements</h1>
        <p style={{ fontSize: 16, color: '#666666' }}>Stay informed with the latest news and updates from the {AGENCY_NAME}.</p>
      </div>

      <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 40, alignItems: 'start' }}>
        {/* Announcement list */}
        <div style={{ display: 'grid', gap: 24 }}>
          {loading && (
            <p style={{ fontSize: 14, color: '#666666' }} role="status">Loading announcements…</p>
          )}

          {loadError && (
            <p role="alert" style={{ fontSize: 14, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px' }}>
              {loadError}
            </p>
          )}

          {/* Empty means hidden, no fallback — the same rule the rest of the
              portal follows for LGU-authored content. Inventing announcements
              to fill the space is what this page used to do, and two of those
              entries were commented `// Test data`. */}
          {!loading && !loadError && posts.length === 0 && (
            <p style={{ fontSize: 14, color: '#666666' }}>
              There are no announcements at the moment. Please check back soon.
            </p>
          )}

          {posts.map((post) => {
            const body = post.body ?? '';
            const isLong = body.length > TEXT_TRUNCATE_LENGTH;
            const isExpanded = Boolean(expanded[post.id]);
            const displayText = isLong && !isExpanded
              ? `${body.slice(0, TEXT_TRUNCATE_LENGTH).trimEnd()}…`
              : body;
            // `color_hex` comes denormalised on the view and is the LGU's own
            // choice — never re-map a category code to a colour in here.
            const accent = post.color_hex || '#FFFFFF';
            const imageUrl = siteContentUrl(post.image_path);
            const published = formatPublishedAt(post.published_at);

            return (
              <article
                key={post.id}
                className="rounded shadow-sm"
                style={{ background: '#003DA5', borderLeft: `4px solid ${accent}`, padding: '28px 32px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                  {post.category_label && (
                    <span style={{
                      background: post.color_hex ? `${post.color_hex}1A` : '#FFE1E1',
                      color: post.color_hex || '#DC2626',
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      {post.category_label}
                    </span>
                  )}
                  {published && <span style={{ fontSize: 12, color: '#CBD8F0' }}>{published}</span>}
                </div>

                <h2 style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', marginBottom: 12, lineHeight: 1.3 }}>{post.title}</h2>

                {imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt=""
                    className="fluid-media"
                    style={{ width: '100%', borderRadius: 8, marginBottom: 16, display: 'block' }}
                  />
                )}

                {/* Plain text with the author's line breaks preserved. The
                    SuperStaff editor accepts free-form plain text with no
                    sanitiser, so this must never become dangerouslySetInnerHTML. */}
                {body && (
                  <p style={{ fontSize: 14, color: '#E6EDF9', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{displayText}</p>
                )}

                {isLong && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(post.id)}
                    aria-expanded={isExpanded}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 12,
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 13, fontWeight: 700, color: '#FFFFFF',
                    }}
                  >
                    {isExpanded ? 'Show less' : 'Read more'}
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                )}
              </article>
            );
          })}
        </div>

        {/* Sidebar */}
        <div className="stack-mobile-sidebar" style={{ position: 'sticky', top: 24 }}>
          <WeatherWidget />
        </div>
      </div>
    </section>
  );
}
