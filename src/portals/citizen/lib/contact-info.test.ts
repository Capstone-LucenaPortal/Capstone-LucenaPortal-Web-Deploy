import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGENCY_NAME, resolveTrunkline, telHref, yellowCardOfficeName } from '@/portals/citizen/lib/contact-info';

describe('AGENCY_NAME', () => {
  /**
   * The canonical agency name settled by DB layer `l66` and stored in
   * `site_info.agency_name`. Verified against the Sandbox project
   * (`zqsqenfoszgcunvpqvvg`) on 2026-10-01: the single `public_site_info` row
   * reads 'City Government of Lucena'. Every Acknowledgement Receipt prints
   * the DB value; this constant is what static copy says, so the two must
   * agree word for word.
   */
  it('is the name the database publishes', () => {
    expect(AGENCY_NAME).toBe('City Government of Lucena');
  });
});

/** Every shipping `.ts`/`.tsx` of the Citizen Portal — its Portal folder and
 *  its routes — test files excluded, as they necessarily contain the strings
 *  these scans forbid. The other Portals in this app are not scanned: these
 *  are Citizen's rules. Shared by both scans below rather than written out in
 *  each. */
const PORTAL = join(process.cwd(), 'src', 'portals', 'citizen');
const APP = join(process.cwd(), 'src', 'app', '(citizen)');

function citizenSourceFiles(): string[] {
  return [...sourceFiles(PORTAL), ...sourceFiles(APP)];
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}

/**
 * The reversed form "Lucena City Government" is not the agency's name. The one
 * place it legitimately appears is "Lucena City Government Complex", which is
 * the *building* on Diversion Road — a different thing with a different name.
 *
 * This scan is what stops the reversed form creeping back in. It does not try
 * to tell code from comment — a comment that needs to mention the wrong form
 * should describe it ("the reversed word order") rather than spell it, which
 * keeps the rule absolute and cheap: outside of " Complex", the string simply
 * does not appear. Test files are skipped because this one necessarily
 * contains the string it forbids.
 */
describe('the reversed name "Lucena City Government"', () => {
  const WRONG = 'Lucena City Government';

  it('appears in shipping copy only as the name of the Complex', () => {
    const offenders: string[] = [];

    for (const file of citizenSourceFiles()) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        let at = line.indexOf(WRONG);
        while (at !== -1) {
          if (!line.slice(at + WRONG.length).startsWith(' Complex')) {
            offenders.push(`${file}:${index + 1}: ${line.trim()}`);
          }
          at = line.indexOf(WRONG, at + 1);
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it('reaches nested source files, so the scan cannot pass vacuously', () => {
    const files = citizenSourceFiles();
    expect(files).toContain(join(PORTAL, 'lib', 'contact-info.ts'));
    expect(files).toContain(join(APP, 'yellow-card', 'page.tsx'));
    expect(files).not.toContain(join(PORTAL, 'lib', 'contact-info.test.ts'));
  });
});

/**
 * Which office handles Yellow Cards is unsettled (issue #12), so the portal names
 * none. `YELLOW_CARD_OFFICE` in `./contact-info` carries the full reasoning and
 * the evidence; it is not repeated here. These tests pin the two things that can
 * regress: the name resolves to the agency while unknown, and no page hardcodes an
 * office meanwhile.
 */
describe('yellowCardOfficeName', () => {
  // No argument reads `YELLOW_CARD_OFFICE`, which is null while SCRUM-105 is
  // open, so this is also what every screen says today.
  it('names the agency while no office has been nominated', () => {
    expect(yellowCardOfficeName()).toBe(AGENCY_NAME);
  });

  // The flip SCRUM-105 enables, covered before it happens. A stand-in name
  // rather than either real candidate, so nothing here reads as having settled
  // the question.
  it('names the nominated office once there is one', () => {
    expect(yellowCardOfficeName('City Example Office')).toBe('City Example Office');
  });
});

describe('no Yellow Card office hardcoded into a page', () => {
  const CLAIMS = ['City Social Welfare Office', 'City Health Office'];

  /**
   * `contact-info.ts` is exempt, and that exemption is the point rather than a
   * loophole: it is the one place a nominated office may be written down. Without
   * it, answering SCRUM-105 with "City Health Office" would fail this very test,
   * so the guard would block the fix it exists to wait for.
   *
   * Known limit: substring matching, so an abbreviation or a longer official form
   * would slip through. Widening it risks false positives on ordinary words, and
   * the pages now read through `yellowCardOfficeName()` anyway — this catches a
   * literal going back into a page, which is how issue #12 happened.
   */
  const OFFICE_NAME_HOME = join(PORTAL, 'lib', 'contact-info.ts');

  it('leaves the office name to one module, and names it in no page', () => {
    const offenders: string[] = [];
    for (const file of citizenSourceFiles()) {
      if (file === OFFICE_NAME_HOME) continue;
      const text = readFileSync(file, 'utf8');
      for (const claim of CLAIMS) {
        if (text.includes(claim)) offenders.push(`${file}: ${claim}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is scanning the pages that carried the claim', () => {
    const scanned = citizenSourceFiles();
    expect(scanned).toContain(join(APP, 'verify', 'page.tsx'));
    expect(scanned).toContain(join(APP, 'profile', 'page.tsx'));
  });
});

describe('resolveTrunkline', () => {
  it('prefers the LGU value and falls back when it is absent or blank', () => {
    expect(resolveTrunkline('(042) 788-2298')).toBe('(042) 788-2298');
    expect(resolveTrunkline(null)).toBe('(042) 373-1121');
    expect(resolveTrunkline('   ')).toBe('(042) 373-1121');
  });
});

describe('telHref', () => {
  it('rewrites a leading 0 to +63 so the link dials from abroad', () => {
    expect(telHref('(042) 373-1121')).toBe('tel:+63423731121');
  });

  it('leaves an already-international number alone', () => {
    expect(telHref('+63 917 123 4567')).toBe('tel:+639171234567');
  });
});
