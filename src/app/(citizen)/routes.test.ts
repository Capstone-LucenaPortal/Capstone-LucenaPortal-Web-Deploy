import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PORTAL_PREFIX } from '@/shared/guard/portals';

/**
 * The Citizen Portal owns the root and the staff-side Portals own their
 * prefixes (ADR 0005). A citizen route whose first segment is a staff prefix
 * would sit in the same URL space as that Portal: a build error at best, and
 * at worst a citizen page served without the guard the prefix promises.
 */
const CITIZEN = join(process.cwd(), 'src', 'app', '(citizen)');

/** The first URL segment of every citizen route, looking through route groups. */
function firstSegments(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      /^\(.*\)$/.test(entry.name) ? firstSegments(join(dir, entry.name)) : [entry.name],
    );
}

describe('citizen routes', () => {
  it('shadow none of the staff-side prefixes', () => {
    const staffSide = Object.values(PORTAL_PREFIX).map((prefix) => prefix.slice(1));
    expect(firstSegments(CITIZEN).filter((segment) => staffSide.includes(segment))).toEqual([]);
  });

  it('are the addresses the Citizen Portal had before the merge', () => {
    expect(firstSegments(CITIZEN).sort()).toEqual([
      'about',
      'announcements',
      'citizens-charter',
      'complete-signup',
      'dashboard',
      'events-calendar',
      'explore-lucena',
      'incident',
      'lcc',
      'news',
      'privacy',
      'profile',
      'receipt',
      'reset-password',
      'terms',
      'verify',
      'yellow-card',
    ]);
  });
});
