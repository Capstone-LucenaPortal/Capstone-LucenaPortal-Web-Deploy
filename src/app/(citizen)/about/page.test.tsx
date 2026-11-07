import { describe, it, expect, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
