import { afterEach, describe, it, expect, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import AboutPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/portals/citizen/lib/supabase/catalogs', () => ({
  catalogService: {
    getSiteInfo: () => Promise.resolve(null),
    getFloorDirectory: () => Promise.resolve([]),
  },
}));

function openAwards() {
  render(<AboutPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Awards & Recognition' }));
}

const stat = (label: string) => screen.getByText(label).previousElementSibling?.textContent;

describe('About > Awards & Recognition', () => {
  it.each([
    ['2025 Local Legislative Award', '2025 Local legislative award.jpg'],
    ['City Public Market Recognized', 'City public market recognized.jpg'],
    ['GCash Award', 'gcash award.jpg'],
    ['Highly Urbanized City', 'Highly Urbanized City.jpg'],
    ['Top 10 Performing Cities', 'Top 10 performing cities.jpg'],
  ])('gives %s its own card with its photo, served from public', (title, file) => {
    openAwards();
    const heading = screen.getByRole('heading', { level: 3, name: title });
    const card = within(heading.parentElement!.parentElement!);
    expect(card.getAllByRole('img').map((img) => img.getAttribute('src'))).toEqual([`/${encodeURI(file)}`]);
    expect(existsSync(join(process.cwd(), 'public', file))).toBe(true);
  });

  it('still says which award the GCash card records', () => {
    openAwards();
    expect(screen.getByText(/Palengke Digital Breakthrough Growth Award/)).toBeInTheDocument();
  });

  it('no longer publishes a recognition as a note to a colleague', () => {
    openAwards();
    expect(screen.queryByText(/recognition pending confirmation/)).toBeNull();
    expect(screen.queryByText(/Add verified details/)).toBeNull();
  });

  it('lists only the awards that have a photo', () => {
    openAwards();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5);
    expect(screen.queryByText(/Photo Slot/)).toBeNull();
  });

  it('offers a filter only for categories that have an award', () => {
    openAwards();
    for (const empty of ['Anti-Drug', 'Environment', 'Health', 'Education']) {
      expect(screen.queryByRole('button', { name: empty })).toBeNull();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Leadership' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
  });

  it('states figures that match the awards listed', () => {
    openAwards();
    expect(stat('Recognitions')).toBe('5');
    expect(stat('Awarding Bodies')).toBe('3');
    expect(stat('Years Covered')).toBe('2025–2026');
    expect(stat('Independently Verifiable')).toBe('3');
  });
});

function openInvest() {
  const { container } = render(<AboutPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Why Invest in Lucena' }));
  return container;
}

describe('About > Why Invest in Lucena image strip', () => {
  it('is decoration: all 30 photos (15, looped twice) have an empty alt', () => {
    const container = openInvest();
    expect(screen.queryAllByAltText('Lucena investment landscape')).toEqual([]);
    const photos = Array.from(container.querySelectorAll('img'));
    expect(photos).toHaveLength(30);
    for (const photo of photos) expect(photo.getAttribute('alt')).toBe('');
  });

  it('hides the track of photos, and only the photos, from assistive technology', () => {
    const container = openInvest();
    const photos = Array.from(container.querySelectorAll('img'));
    const track = photos[0].closest('[aria-hidden="true"]');
    expect(track).not.toBeNull();
    expect(photos.every((photo) => track!.contains(photo))).toBe(true);
    // It holds photo frames and nothing else: aria-hidden on the outer wrapper
    // would also hide a control placed beside the track (#148's pause button).
    expect(Array.from(track!.children).every((frame) => frame.querySelectorAll('img').length === 1)).toBe(true);
    expect(track!.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')).toHaveLength(0);
  });
});

/** The strip's track: the element holding the photos, which is what scrolls. */
const scrollingTrack = (container: HTMLElement) => container.querySelector('img')!.closest('[aria-hidden="true"]') as HTMLElement;
const isMoving = (container: HTMLElement) => scrollingTrack(container).style.animationPlayState === 'running';
const toggle = () => screen.getByRole('button', { name: /^(Pause|Play) image strip$/ });
const tabTo = (el: HTMLElement) => {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => el.focus());
};

describe('About > Why Invest in Lucena image strip: pause and play', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has a button that pauses the strip, and plays it again', () => {
    const container = openInvest();
    expect(isMoving(container)).toBe(true);
    expect(toggle()).toHaveAccessibleName('Pause image strip');

    fireEvent.click(toggle());
    expect(isMoving(container)).toBe(false);
    expect(toggle()).toHaveAccessibleName('Play image strip');

    fireEvent.click(toggle());
    expect(isMoving(container)).toBe(true);
    expect(toggle()).toHaveAccessibleName('Pause image strip');
  });

  it('holds still while the pointer is over it, and moves on once it leaves', () => {
    const container = openInvest();
    fireEvent.pointerEnter(scrollingTrack(container));
    expect(isMoving(container)).toBe(false);
    fireEvent.pointerLeave(scrollingTrack(container));
    expect(isMoving(container)).toBe(true);
  });

  it('holds still while keyboard focus is on its button, and moves on once focus leaves', () => {
    const container = openInvest();
    tabTo(toggle());
    expect(isMoving(container)).toBe(false);
    act(() => toggle().blur());
    expect(isMoving(container)).toBe(true);
  });

  it('stays paused by its button after the pointer and focus leave', () => {
    const container = openInvest();
    fireEvent.pointerEnter(toggle());
    tabTo(toggle());
    fireEvent.click(toggle());

    fireEvent.pointerLeave(toggle());
    fireEvent.mouseLeave(toggle());
    act(() => toggle().blur());
    expect(isMoving(container)).toBe(false);
    expect(toggle()).toHaveAccessibleName('Play image strip');
  });

  it('shows no pause/play button when the device asks for reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    openInvest();
    expect(screen.queryByRole('button', { name: /image strip/ })).toBeNull();
  });
});
