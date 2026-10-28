import { describe, it, expect } from 'vitest';
import type { MyYellowCard, MyYellowCardApplication } from '@/portals/citizen/features/yellow-card/types';
import { digitalCardFace, fitText } from '@/portals/citizen/features/yellow-card/lib/digital-card';

const card: MyYellowCard = {
  id: 'CARD-1',
  card_number: 'LC-2026-063813',
  verification_token: 'tok-1',
  status: 'active',
  application_id: 'APP-1',
  holder_name: 'Monaliza Cochangco Panganiban',
  barangay_name: 'Ilayang Iyam',
  valid_from: '2026-10-01',
  expires_at: null,
  revoked_reason: null,
};

/** Only the fields the card face reads; the rest of the row is irrelevant here. */
function issuedFrom(
  fields: Partial<MyYellowCardApplication>,
): MyYellowCardApplication {
  return {
    id: 'APP-1',
    first_name: 'Monaliza',
    middle_name: 'Cochangco',
    last_name: 'Panganiban',
    suffix: null,
    barangay_name: 'Ilayang Iyam',
    complete_address: '132 Daleon St. Torres Subd.',
    ...fields,
  } as MyYellowCardApplication;
}

describe('digitalCardFace', () => {
  it('writes the name as the printed card does: LAST, FIRST MIDDLE in capitals', () => {
    expect(digitalCardFace(card, issuedFrom({})).name).toBe('PANGANIBAN, MONALIZA COCHANGCO');
  });

  it('puts a suffix after the given names and skips a missing middle name', () => {
    const face = digitalCardFace(
      card,
      issuedFrom({ first_name: 'Juan', middle_name: null, last_name: 'Dela Cruz', suffix: 'Jr.' }),
    );
    expect(face.name).toBe('DELA CRUZ, JUAN JR.');
  });

  it('falls back to the stored holder name when the issuing application is not loaded', () => {
    expect(digitalCardFace(card, null).name).toBe('MONALIZA COCHANGCO PANGANIBAN');
  });

  it('carries the card number as issued', () => {
    expect(digitalCardFace(card, issuedFrom({})).cardNumber).toBe('LC-2026-063813');
  });

  it('gives the address as the street address, then the barangay, in capitals', () => {
    expect(digitalCardFace(card, issuedFrom({})).addressLines).toEqual([
      '132 DALEON ST. TORRES SUBD.',
      'ILAYANG IYAM',
    ]);
  });

  it('falls back to the card\'s barangay alone when the issuing application is not loaded', () => {
    expect(digitalCardFace(card, null).addressLines).toEqual(['ILAYANG IYAM']);
  });
});

describe('fitText', () => {
  // A stand-in for canvas measureText: every character is 0.6em wide.
  const measure = (text: string, fontSize: number) => text.length * fontSize * 0.6;
  const box = { maxWidth: 300, maxLines: 3, maxFontSize: 40, minFontSize: 16 };
  const fitsBox = (fitted: { fontSize: number; lines: string[] }) =>
    fitted.lines.every((line) => measure(line, fitted.fontSize) <= box.maxWidth);

  it('keeps a short name on one line at full size', () => {
    expect(fitText('CRUZ, ANA', measure, box)).toEqual({ fontSize: 40, lines: ['CRUZ, ANA'] });
  });

  it('wraps a long name at word breaks, at most three lines, every line inside the box', () => {
    const fitted = fitText('DELA CRUZ-SANTIAGO, MARIA CONCEPCION BEATRIZ ESPERANZA JR.', measure, box);
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
    expect(fitted.lines.join(' ')).toBe('DELA CRUZ-SANTIAGO, MARIA CONCEPCION BEATRIZ ESPERANZA JR.');
    expect(fitsBox(fitted)).toBe(true);
  });

  it('shrinks a name that three lines at full size cannot hold', () => {
    const name = 'VILLANUEVA-MACARAEG, MARIA CONCEPCION BEATRIZ ESPERANZA DOLORES JR.';
    const fitted = fitText(name, measure, box);
    expect(fitted.fontSize).toBeLessThan(40);
    expect(fitted.fontSize).toBeGreaterThanOrEqual(16);
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
    expect(fitted.lines.join(' ')).toBe(name);
    expect(fitsBox(fitted)).toBe(true);
  });

  it('never overflows, even for text the smallest size cannot hold whole', () => {
    const fitted = fitText('X'.repeat(200), measure, box);
    expect(fitted.fontSize).toBe(16);
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
    expect(fitsBox(fitted)).toBe(true);
    expect(fitted.lines.at(-1)).toMatch(/…$/);
  });

  it('terminates even when the box is narrower than a single character', () => {
    const fitted = fitText('AB', measure, { maxWidth: 1, maxLines: 3, maxFontSize: 20, minFontSize: 16 });
    expect(fitted.fontSize).toBe(16);
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
  });
});
