import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicPost } from '@/portals/citizen/features/content/types';

const getPosts = vi.fn<() => Promise<PublicPost[]>>();

vi.mock('@/portals/citizen/features/content/lib/content', () => ({
  contentService: { getPosts: () => getPosts() },
  siteContentUrl: () => null,
}));
vi.mock('@/portals/citizen/components/ui/weather-widget', () => ({
  default: () => <div>Weather</div>,
}));

import AnnouncementsPage from './page';

const post: PublicPost = {
  id: 'post-1',
  content_type: 'announcement',
  title: 'Water interruption in Barangay Gulang-Gulang',
  body: 'Service resumes at 5 PM.',
  image_path: null,
  category_code: 'advisory',
  category_label: 'Advisory',
  color_hex: '#C0272D',
  published_at: '2026-11-18T08:00:00+08:00',
};

afterEach(() => {
  getPosts.mockReset();
});

describe('AnnouncementsPage', () => {
  it("shows the Public Information Office's Facebook feed", async () => {
    getPosts.mockResolvedValue([]);
    render(<AnnouncementsPage />);
    const feed = screen.getByTitle('Lucena City Public Information Office Facebook feed');
    const src = new URL(feed.getAttribute('src')!);
    expect(src.origin + src.pathname).toBe('https://www.facebook.com/plugins/page.php');
    expect(src.searchParams.get('href')).toBe('https://www.facebook.com/LucenaPIO');
    expect(screen.getByRole('link', { name: /open the page on facebook\.com/i })).toHaveAttribute(
      'href',
      'https://www.facebook.com/LucenaPIO',
    );
  });

  it("lists City Hall's own announcements beside the feed", async () => {
    getPosts.mockResolvedValue([post]);
    render(<AnnouncementsPage />);
    expect(await screen.findByRole('heading', { level: 2, name: 'From City Hall' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: post.title })).toBeInTheDocument();
  });

  it('leaves out the City Hall list when there are no announcements', async () => {
    getPosts.mockResolvedValue([]);
    render(<AnnouncementsPage />);
    await vi.waitFor(() => expect(getPosts).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole('heading', { name: 'From City Hall' })).not.toBeInTheDocument();
  });

  it('says so when the announcements cannot be loaded', async () => {
    getPosts.mockRejectedValue(new Error('Could not load announcements right now.'));
    render(<AnnouncementsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load announcements right now.');
  });
});
