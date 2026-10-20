import type { Metadata } from 'next';

/**
 * The only route with its own metadata. Every other page inherits the root
 * layout's default title, which is the right call for a portal whose pages are
 * mostly forms — but the charter is a named public document that residents and
 * oversight bodies look up by name, so it gets a real title and description.
 */
export const metadata: Metadata = {
  title: "Citizen's Charter",
  description:
    'The services the City Government of Lucena delivers online — Yellow Card, incident reports, and Lucena Convention Center bookings — with the requirements, fees, and processing times for each, published under RA 11032.',
  openGraph: {
    title: "Citizen's Charter | Lucena City Portal",
    description:
      'Requirements, fees, and processing times for every service the Lucena City Portal delivers, published under RA 11032.',
  },
};

export default function CitizensCharterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
