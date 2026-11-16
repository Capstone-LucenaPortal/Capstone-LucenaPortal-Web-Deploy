import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PROGRAM_CATEGORIES, PROGRAMS_OVERVIEW, getProgramCategory } from './programs';

const allImages = () => [
  ...PROGRAM_CATEGORIES.flatMap(({ programs }) => programs.flatMap(({ images }) => images)),
  PROGRAMS_OVERVIEW.homeImage,
  PROGRAMS_OVERVIEW.bannerImage,
];

describe('program categories', () => {
  it('are the eight the city publishes, in display order, at stable addresses', () => {
    expect(PROGRAM_CATEGORIES.map(({ name, slug }) => [name, slug])).toEqual([
      ['Agricultural', 'agricultural'],
      ['Baptism', 'baptism'],
      ['Business', 'business'],
      ['Education', 'education'],
      ['Housing', 'housing'],
      ['Senior Citizen', 'senior-citizen'],
      ['Wedding', 'wedding'],
      ['Wellness', 'wellness'],
    ]);
  });

  it('point every photo at a file that is in public/', () => {
    const missing = allImages()
      .map(({ src }) => src)
      .filter((src) => src === null || !existsSync(join(process.cwd(), 'public', src)));
    expect(missing).toEqual([]);
  });

  it('describe every photo for screen readers', () => {
    expect(allImages().filter(({ alt }) => alt.trim() === '')).toEqual([]);
  });

  it('give every program at least one photo, and none twice', () => {
    for (const program of PROGRAM_CATEGORIES.flatMap(({ programs }) => programs)) {
      const sources = program.images.map(({ src }) => src);
      expect(sources.length, program.name).toBeGreaterThan(0);
      expect(new Set(sources).size, program.name).toBe(sources.length);
    }
  });

  it('are found by the slug in their address', () => {
    expect(getProgramCategory('senior-citizen')?.name).toBe('Senior Citizen');
  });

  it('find nothing for an address that is not a category', () => {
    expect(getProgramCategory('health')).toBeUndefined();
  });
});
