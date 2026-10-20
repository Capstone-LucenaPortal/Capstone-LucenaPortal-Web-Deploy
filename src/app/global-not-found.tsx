import type { Metadata } from 'next';

import CitizenLayout, { metadata as citizenMetadata } from './(citizen)/layout';
import CitizenNotFound from './(citizen)/not-found';

/**
 * The 404 for a URL no route matches. Each Portal has its own root layout, so
 * there is no single layout for Next to render an unmatched URL inside; this
 * file replaces them all (enabled by `experimental.globalNotFound` in
 * next.config.ts). The Citizen Portal owns the root (ADR 0005), and its
 * not-found page answered every unmatched URL before the merge, so it answers
 * here too, inside its own layout, stylesheet and font.
 *
 * A global-not-found bypasses layouts, so the layout's metadata is spread in by
 * hand and its title template applied to the page's own title.
 */
export const metadata: Metadata = {
  ...citizenMetadata,
  title: 'Page not found | Lucena City Portal',
};

export default function GlobalNotFound() {
  return (
    <CitizenLayout>
      <CitizenNotFound />
    </CitizenLayout>
  );
}
