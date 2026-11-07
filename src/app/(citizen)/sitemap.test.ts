import { describe, it, expect } from 'vitest';
import sitemap from './sitemap';

describe('sitemap', () => {
  it('lists the Programs page and every category page', () => {
    const paths = sitemap().map(({ url }) => new URL(url).pathname);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/programs',
        '/programs/agricultural',
        '/programs/animal',
        '/programs/baptism',
        '/programs/business',
        '/programs/education',
        '/programs/housing',
        '/programs/senior-citizen',
        '/programs/wedding',
        '/programs/wellness',
      ]),
    );
  });
});
