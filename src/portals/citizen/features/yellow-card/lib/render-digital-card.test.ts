import { describe, it, expect } from 'vitest';
import { printedCardNumber } from '@/portals/citizen/features/yellow-card/lib/render-digital-card';

// The drawing itself needs a real canvas and is checked in the browser; this
// covers the one template-specific rule that is plain text.
describe('printedCardNumber', () => {
  it('prints only what follows LC-, since the card art already says "PLC -"', () => {
    expect(printedCardNumber('LC-2026-063813')).toBe('2026-063813');
  });

  it('prints a number without the LC- prefix whole', () => {
    expect(printedCardNumber('X-1')).toBe('X-1');
  });
});
