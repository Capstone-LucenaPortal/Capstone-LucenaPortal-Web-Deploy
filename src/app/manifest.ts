import type { MetadataRoute } from 'next';

/**
 * The Citizen Portal's PWA manifest, served at /manifest.webmanifest as
 * before the merge. It sits at the app root rather than in (citizen): Next
 * serves manifest.ts from the root only. Responder's manifest is a static file,
 * public/responder/manifest.webmanifest; this one's shape mirrors it, so the
 * Portals install consistently.
 *
 * `display: 'standalone'` matters more here than it looks: a resident filing an
 * incident report is often outdoors on a phone, and the installed shell drops
 * the browser chrome that otherwise eats a third of a small screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lucena City Portal',
    short_name: 'Lucena City',
    description:
      'Official e-services portal of the City Government of Lucena — Yellow Card, incident reports, and Lucena Convention Center (LCC) bookings.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#003DA5',
    lang: 'en-PH',
    icons: [
      {
        src: '/seal-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/seal-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
