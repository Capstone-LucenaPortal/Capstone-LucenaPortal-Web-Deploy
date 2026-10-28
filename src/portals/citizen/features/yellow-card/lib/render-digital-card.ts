/**
 * The Digital Card's art: draws a card face and its verification link onto the
 * blank card template and returns the result as a PNG data URL.
 *
 * Everything about how the card LOOKS lives here — the template image, where
 * each item sits on it, fonts and colours. The profile only displays what this
 * returns, so a new card design replaces this module and the template, and
 * nothing else. What is printed (`DigitalCardFace`) and how text is fitted
 * (`fitText`) are pure and tested in `digital-card.ts`; this module needs a real
 * canvas, so it is checked in the browser rather than under jsdom.
 *
 * The template (`public/citizen/yellow-card-blank.png`, 1011 × 638) is the
 * printed card with its photo, signature and text removed. The Digital Card
 * carries no photo, so the photo frame is painted over with the background.
 */
import QRCode from 'qrcode';
import { fitText, type DigitalCardFace, type FitBox } from '@/portals/citizen/features/yellow-card/lib/digital-card';

const CARD_TEMPLATE_SRC = '/citizen/yellow-card-blank.png';

/** Template size, in template pixels. Every position below is in these. */
const CARD_WIDTH = 1011;
const CARD_HEIGHT = 638;

/** For a placeholder the same shape as the card while it is being drawn. */
export const CARD_ASPECT_RATIO = `${CARD_WIDTH} / ${CARD_HEIGHT}`;
/** Drawn at twice the template size so text and QR stay sharp when the card is
 * shown full screen or printed from the download. */
const SCALE = 2;

const FONT_FAMILY = 'Arial, Helvetica, sans-serif';
const INK = '#1A1A1A';

const LAYOUT = {
  /** The grey left panel's colour, sampled from the template. */
  background: '#DDE0CB',
  /** The yellow-bordered photo frame (20,131)–(359,459), with a margin. */
  photoFrame: { x: 14, y: 125, width: 352, height: 341 },
  /** After the template's own "PLC -", whose caps end at x 163, baseline 501;
   * the blue band starts near x 405. */
  cardNumber: {
    x: 176,
    baseline: 501,
    box: { maxWidth: 225, maxLines: 1, maxFontSize: 36, minFontSize: 18 } satisfies FitBox,
  },
  /** Right of the logo (ends x 784), inside the yellow header (y 0–237). */
  qr: { x: 794, y: 12, size: 212 },
  /** The white panel (480,239)–(1010,604); text is centred in it. */
  panel: { left: 480, top: 239, right: 1010, bottom: 604 },
  name: { maxWidth: 470, maxLines: 3, maxFontSize: 40, minFontSize: 20 } satisfies FitBox,
  address: { maxWidth: 470, maxLines: 2, maxFontSize: 26, minFontSize: 16 } satisfies FitBox,
  lineHeight: 1.18,
  /** Space between the name block and the address block. */
  gap: 22,
};

function loadTemplate(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the card template.'));
    img.src = CARD_TEMPLATE_SRC;
  });
}

/** Draws the QR module by module, so it stays crisp at any scale. A white
 * quiet zone keeps it scannable against the yellow header. */
function drawQr(ctx: CanvasRenderingContext2D, link: string) {
  const { x, y, size } = LAYOUT.qr;
  // Level M tolerates a scuffed phone screen without inflating the module
  // count to the point of being hard to scan.
  const qr = QRCode.create(link, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  // The QR spec's four-module quiet zone: phone cameras are less forgiving
  // than decoders, and the header around it is a busy yellow.
  const quiet = 4;
  const cell = size / (count + quiet * 2);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = INK;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.modules.get(row, col)) {
        // A hair of overlap hides the seams anti-aliasing leaves between cells.
        ctx.fillRect(x + (col + quiet) * cell, y + (row + quiet) * cell, cell + 0.4, cell + 0.4);
      }
    }
  }
}

/**
 * The card number as this template prints it: the template already carries
 * "PLC -", so only what follows the issued number's `LC-` prefix is drawn. A
 * number without that prefix is printed whole.
 */
export function printedCardNumber(cardNumber: string): string {
  return cardNumber.replace(/^LC-/, '');
}

/** The canvas's own text measure, for `fitText`. */
function measureAt(ctx: CanvasRenderingContext2D, weight: string) {
  return (text: string, fontSize: number) => {
    ctx.font = `${weight} ${fontSize}px ${FONT_FAMILY}`;
    return ctx.measureText(text).width;
  };
}

/** Name, then address, as one block centred in the white panel. */
function drawPanelText(ctx: CanvasRenderingContext2D, face: DigitalCardFace) {
  const name = fitText(face.name, measureAt(ctx, 'bold'), LAYOUT.name);
  // Every address line is drawn at one size, so the block reads as one: fit
  // each line under a shared cap and lower the cap until every line fits at
  // exactly that size. The cap only falls, so this ends.
  const measureAddress = measureAt(ctx, 'normal');
  let addressSize = LAYOUT.address.maxFontSize;
  let addressFits = face.addressLines.map((line) => fitText(line, measureAddress, LAYOUT.address));
  while (addressFits.some((f) => f.fontSize < addressSize)) {
    addressSize = Math.min(...addressFits.map((f) => f.fontSize));
    addressFits = face.addressLines.map((line) =>
      fitText(line, measureAddress, { ...LAYOUT.address, maxFontSize: addressSize }),
    );
  }
  const addressLines = addressFits.flatMap((f) => f.lines);

  const nameHeight = name.lines.length * name.fontSize * LAYOUT.lineHeight;
  const addressHeight = addressLines.length * addressSize * LAYOUT.lineHeight;
  const blockHeight = nameHeight + (addressLines.length ? LAYOUT.gap + addressHeight : 0);

  const { left, right, top, bottom } = LAYOUT.panel;
  const centreX = (left + right) / 2;
  let y = top + (bottom - top - blockHeight) / 2;

  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.font = `bold ${name.fontSize}px ${FONT_FAMILY}`;
  for (const line of name.lines) {
    ctx.fillText(line, centreX, y);
    y += name.fontSize * LAYOUT.lineHeight;
  }

  y += LAYOUT.gap;
  ctx.font = `normal ${addressSize}px ${FONT_FAMILY}`;
  for (const line of addressLines) {
    ctx.fillText(line, centreX, y);
    y += addressSize * LAYOUT.lineHeight;
  }
}

/**
 * Renders a Digital Card as a PNG data URL.
 *
 * `verificationLink` is the absolute `/verify?token=…` URL the QR encodes, so a
 * Verifier's phone camera opens Verification directly.
 */
export async function renderDigitalCard(
  face: DigitalCardFace,
  verificationLink: string,
): Promise<string> {
  const template = await loadTemplate();

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * SCALE;
  canvas.height = CARD_HEIGHT * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the card.');
  ctx.scale(SCALE, SCALE);

  ctx.drawImage(template, 0, 0, CARD_WIDTH, CARD_HEIGHT);

  const { x, y, width, height } = LAYOUT.photoFrame;
  ctx.fillStyle = LAYOUT.background;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const number = fitText(printedCardNumber(face.cardNumber), measureAt(ctx, 'bold'), LAYOUT.cardNumber.box);
  ctx.font = `bold ${number.fontSize}px ${FONT_FAMILY}`;
  ctx.fillText(number.lines[0] ?? '', LAYOUT.cardNumber.x, LAYOUT.cardNumber.baseline);

  drawQr(ctx, verificationLink);
  drawPanelText(ctx, face);

  return canvas.toDataURL('image/png');
}
