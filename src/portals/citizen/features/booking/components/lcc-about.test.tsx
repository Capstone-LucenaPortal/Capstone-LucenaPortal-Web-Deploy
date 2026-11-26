import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LCCAbout from '@/portals/citizen/features/booking/components/lcc-about';
import { CONTACT_EMAIL } from '@/portals/citizen/lib/contact-info';

const getSiteInfo = vi.fn();

vi.mock('@/portals/citizen/lib/supabase/catalogs', () => ({
  catalogService: { getSiteInfo: () => getSiteInfo() },
}));

vi.mock('@/portals/citizen/features/content/lib/content', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/portals/citizen/features/content/lib/content')>()),
  contentService: { getEvents: async () => [] },
}));

vi.mock('@/portals/citizen/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: null, openAuthModal: vi.fn() }),
}));

function telLinks(container: HTMLElement) {
  return container.querySelectorAll('a[href^="tel:"]');
}

beforeEach(() => {
  getSiteInfo.mockReset();
});

// #47: Contact Information used to show and dial a hard-coded trunkline until
// Site Info answered. The Phone entry now waits for the number the city saved.
describe('LCCAbout contact information', () => {
  it('shows no Phone entry while Site Info loads, but keeps the Email entry', () => {
    getSiteInfo.mockReturnValue(new Promise(() => {}));
    const { container } = render(<LCCAbout onBook={() => {}} />);

    expect(screen.queryByText('Phone')).toBeNull();
    expect(telLinks(container)).toHaveLength(0);
    expect(screen.getByRole('link', { name: CONTACT_EMAIL })).toBeInTheDocument();
  });

  it('shows the saved trunkline as a tel: link once Site Info answers', async () => {
    getSiteInfo.mockResolvedValue({ trunkline: '(042) 788-2298', office_hours: null });
    render(<LCCAbout onBook={() => {}} />);

    expect(await screen.findByRole('link', { name: '(042) 788-2298' })).toHaveAttribute(
      'href',
      'tel:+63427882298',
    );
    expect(screen.getByText('Phone')).toBeInTheDocument();
  });

  it('keeps the Phone entry hidden when Site Info has no trunkline', async () => {
    getSiteInfo.mockResolvedValue({ trunkline: '  ', office_hours: 'Monday to Friday, 8:00 AM – 5:00 PM' });
    const { container } = render(<LCCAbout onBook={() => {}} />);

    // Office hours arriving proves Site Info has answered.
    expect(await screen.findByText('Monday to Friday, 8:00 AM – 5:00 PM')).toBeInTheDocument();
    expect(screen.queryByText('Phone')).toBeNull();
    expect(telLinks(container)).toHaveLength(0);
  });
});
