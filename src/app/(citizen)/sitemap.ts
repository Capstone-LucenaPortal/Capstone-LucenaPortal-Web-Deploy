import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lucena-city.gov.ph';

/**
 * Public routes only.
 *
 * Deliberately excluded: /dashboard, /profile, /complete-signup,
 * /reset-password (authenticated, and already Disallowed in robots.txt), and
 * /verify — that one is a legitimate public utility, but its useful form
 * carries a ?token= that resolves to a named citizen's card status, and a
 * tokenised URL in a search index would publish that permanently.
 *
 * The service routes below are listed because their landing pages are genuinely
 * public information — a resident should be able to find "how do I apply for a
 * Yellow Card in Lucena" from a search engine, even though completing one
 * requires signing in.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
    // High priority on purpose: RA 11032 requires the charter to be findable,
    // and "Lucena citizen's charter" is a question a resident should be able to
    // answer from a search engine without ever signing in.
    { path: '/citizens-charter', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/announcements', priority: 0.9, changeFrequency: 'daily' },
    { path: '/events-calendar', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/explore-lucena', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/news', priority: 0.8, changeFrequency: 'daily' },
    { path: '/yellow-card', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/incident', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/lcc', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${siteUrl}${path}`,
    changeFrequency,
    priority,
  }));
}
