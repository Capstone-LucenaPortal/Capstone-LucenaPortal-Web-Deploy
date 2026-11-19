import { describe, expect, it } from 'vitest';
import { cardColumns, cardGridColumns } from './card-columns';

describe('cardColumns', () => {
  it.each([
    [8, 4],
    [10, 5],
    [5, 5],
    [6, 3],
    [9, 3],
  ])('lays %i cards out in full rows of %i', (count, columns) => {
    expect(cardColumns(count)).toBe(columns);
  });

  it('puts three cards or fewer on one row', () => {
    expect(cardColumns(3)).toBe(3);
    expect(cardColumns(2)).toBe(2);
    expect(cardColumns(1)).toBe(1);
  });

  it('leaves the fullest last row when no column count divides evenly', () => {
    // 7: rows of 4 leave 3 on the last row; rows of 5 leave 2; rows of 3 leave 1.
    expect(cardColumns(7)).toBe(4);
    // 11: rows of 4 leave 3; rows of 5 leave 1.
    expect(cardColumns(11)).toBe(4);
  });

  it('never goes past five columns', () => {
    expect(cardColumns(12)).toBe(4);
    expect(cardColumns(30)).toBe(5);
  });
});

describe('cardGridColumns', () => {
  it('gives equal columns that let a long card name wrap rather than widen its column', () => {
    expect(cardGridColumns(8)).toBe('repeat(4, minmax(0, 1fr))');
    expect(cardGridColumns(10)).toBe('repeat(5, minmax(0, 1fr))');
  });
});
