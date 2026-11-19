const MIN_COLUMNS = 3;
const MAX_COLUMNS = 5;

/**
 * How many columns a row of picture cards gets on a wide screen, so the rows
 * come out full instead of leaving one card alone under a long row (8 cards
 * make two rows of 4, not a row of 7 and a row of 1).
 *
 * Picks the count between 3 and 5 that fills the last row best — a count that
 * divides evenly fills it completely — and the larger count on a tie, so cards
 * stay as compact as the layout allows. Three cards or fewer share one row.
 */
export function cardColumns(count: number): number {
  if (count <= MIN_COLUMNS) return Math.max(count, 1);

  let best = MIN_COLUMNS;
  let bestFill = -1;
  for (let columns = MIN_COLUMNS; columns <= MAX_COLUMNS; columns++) {
    const lastRow = count % columns;
    const fill = lastRow === 0 ? 1 : lastRow / columns;
    if (fill >= bestFill) {
      best = columns;
      bestFill = fill;
    }
  }
  return best;
}

/**
 * The wide-screen `grid-template-columns` for a row of `count` picture cards.
 * Pair it with the `card-grid` class, whose media query lets narrower screens
 * fit as many cards as their width takes instead.
 */
export function cardGridColumns(count: number): string {
  return `repeat(${cardColumns(count)}, minmax(0, 1fr))`;
}
