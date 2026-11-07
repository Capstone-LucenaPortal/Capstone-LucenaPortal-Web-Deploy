import { describe, it, expect } from 'vitest';
import { PROGRAM_CATEGORIES, getProgramCategory } from './programs';

describe('program categories', () => {
  it('are the nine the city publishes, in display order, at stable addresses', () => {
    expect(PROGRAM_CATEGORIES.map(({ name, slug }) => [name, slug])).toEqual([
      ['Agricultural', 'agricultural'],
      ['Animal', 'animal'],
      ['Baptism', 'baptism'],
      ['Business', 'business'],
      ['Education', 'education'],
      ['Housing', 'housing'],
      ['Senior Citizen', 'senior-citizen'],
      ['Wedding', 'wedding'],
      ['Wellness', 'wellness'],
    ]);
  });

  it('are found by the slug in their address', () => {
    expect(getProgramCategory('senior-citizen')?.name).toBe('Senior Citizen');
  });

  it('find nothing for an address that is not a category', () => {
    expect(getProgramCategory('health')).toBeUndefined();
  });
});
