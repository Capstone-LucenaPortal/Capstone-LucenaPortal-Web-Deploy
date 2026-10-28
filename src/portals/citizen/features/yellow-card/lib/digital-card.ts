/**
 * Pure helpers for the Digital Card — what text goes on it, and how that text
 * is fitted into the space the card art gives it. The art itself (template,
 * positions, colours) lives in `render-digital-card.ts`; nothing here touches a
 * canvas, so all of it is unit-tested.
 */
import type { MyYellowCard, MyYellowCardApplication } from '@/portals/citizen/features/yellow-card/types';

/** Everything printed on a Digital Card besides the QR. */
export interface DigitalCardFace {
  /** `LAST, FIRST MIDDLE SUFFIX`, in capitals — the printed card's form. */
  name: string;
  /** The card number as issued, e.g. `LC-2026-000123`. How it is printed is
   * the card art's business. */
  cardNumber: string;
  /** Street address, then barangay, in capitals. */
  addressLines: string[];
}

function joinWords(...parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * The card face for an issued card, from the application it was issued from.
 *
 * Both are frozen at issuance: `yellow_cards.holder_name` is built from the
 * application's own name fields (DB l12a), so reading the parts back from the
 * application gives the same name in the printed card's order, and a later
 * profile edit changes neither.
 */
export function digitalCardFace(
  card: MyYellowCard,
  application: MyYellowCardApplication | null | undefined,
): DigitalCardFace {
  const name = application
    ? `${joinWords(application.last_name)}, ${joinWords(application.first_name, application.middle_name, application.suffix)}`
    : card.holder_name;
  const addressLines = (
    application
      ? [application.complete_address, application.barangay_name]
      : [card.barangay_name]
  )
    .map((line) => joinWords(line).toUpperCase())
    .filter(Boolean);
  return {
    name: name.toUpperCase(),
    cardNumber: card.card_number,
    addressLines,
  };
}

/** Width of `text` at `fontSize`, in the same units as the box. On the card
 * this is the canvas's own `measureText`; under test, a stand-in. */
export type MeasureText = (text: string, fontSize: number) => number;

export interface FitBox {
  maxWidth: number;
  maxLines: number;
  maxFontSize: number;
  minFontSize: number;
}

export interface FittedText {
  fontSize: number;
  lines: string[];
}

/** Greedy word wrap. A single word wider than the box is broken by character,
 * so no line can come out wider than `maxWidth`. */
function wrap(text: string, fits: (line: string) => boolean): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (fits(candidate)) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    let rest = word;
    while (rest.length > 1 && !fits(rest)) {
      // At least one character per line, so a box narrower than one glyph
      // still terminates (that line then overflows; fitText's ellipsis pass
      // is the guard against overflow, not this loop).
      let cut = rest.length - 1;
      while (cut > 1 && !fits(rest.slice(0, cut))) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Fits `text` into a box of at most `maxLines` lines: the largest font size
 * (whole pixels, from `maxFontSize` down to `minFontSize`) at which it wraps
 * into the box at word breaks. A name is never cut off while any size can hold
 * it; only text the smallest size cannot hold is truncated, with an ellipsis,
 * so it still never overflows the card art.
 */
export function fitText(text: string, measure: MeasureText, box: FitBox): FittedText {
  const words = text.trim();
  for (let size = box.maxFontSize; size >= box.minFontSize; size--) {
    const fits = (line: string) => measure(line, size) <= box.maxWidth;
    const lines = wrap(words, fits);
    const brokeAWord = lines.join(' ') !== words.split(/\s+/).join(' ');
    if (lines.length <= box.maxLines && !brokeAWord) return { fontSize: size, lines };
  }

  const size = box.minFontSize;
  const fits = (line: string) => measure(line, size) <= box.maxWidth;
  const lines = wrap(words, fits);
  if (lines.length <= box.maxLines) return { fontSize: size, lines };

  const kept = lines.slice(0, box.maxLines);
  let last = kept[kept.length - 1];
  while (last.length > 0 && !fits(`${last}…`)) last = last.slice(0, -1);
  kept[kept.length - 1] = `${last.trimEnd()}…`;
  return { fontSize: size, lines: kept };
}
