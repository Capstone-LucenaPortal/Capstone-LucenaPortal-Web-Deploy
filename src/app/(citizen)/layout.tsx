import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/portals/citizen/features/auth/hooks/use-auth';
import Nav from '@/portals/citizen/components/layout/navbar';
import AuthModal from '@/portals/citizen/features/auth/components/auth-modal';
import MockModeBanner from '@/portals/citizen/components/layout/mock-mode-banner';
import SiteFooter from '@/portals/citizen/components/layout/footer';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

/**
 * `metadataBase` makes every relative OG/Twitter image URL absolute. Without it
 * Next warns and social cards silently fall back to no image. It is read from
 * the deployment URL so a preview build does not advertise production links.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lucena-city.gov.ph';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    // Per-page metadata can set just its own name; the city keeps the suffix.
    default: 'Lucena City Portal',
    template: '%s | Lucena City Portal',
  },
  description:
    'Official e-services portal of the City Government of Lucena. Apply for a Yellow Card, file an incident report, and book the Lucena Convention Center (LCC).',
  applicationName: 'Lucena City Portal',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website',
    siteName: 'Lucena City Portal',
    locale: 'en_PH',
    title: 'Lucena City Portal',
    description:
      'Official e-services portal of the City Government of Lucena — Yellow Card, incident reports, and Lucena Convention Center (LCC) bookings.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lucena City Portal',
    description: 'Official e-services portal of the City Government of Lucena.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/* First focusable element on the page. Without it, a keyboard or
            screen-reader user tabs through the whole nav on every route. */}
        <a href="#main" className="skip-link">Skip to main content</a>
        <MockModeBanner />
        <AuthProvider>
          <div className="relative min-h-screen">
            <Nav />
            {/* The single `main` landmark. Only /complete-signup had one before,
                so on every other route assistive tech had no way to jump to the
                page's actual content. */}
            <main id="main" style={{ paddingTop: 88 }}>
              {children}
            </main>
            <SiteFooter />
            <AuthModal />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
