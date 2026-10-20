import { describe, it, expect } from 'vitest';
import { canStripMetadata, scaledDimensions, stripImageMetadata } from '@/portals/citizen/lib/storage/image-sanitizer';

describe('canStripMetadata', () => {
  // The suite runs under `environment: 'node'`, which has neither
  // createImageBitmap nor a DOM. Asserting this pins the contract that the
  // upload path degrades rather than throwing outside a browser.
  it('is false in the node test environment', () => {
    expect(canStripMetadata()).toBe(false);
  });
});

describe('scaledDimensions', () => {
  it('leaves an image inside the cap untouched', () => {
    expect(scaledDimensions(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });

  it('scales a landscape image down by its longest side, preserving aspect ratio', () => {
    const out = scaledDimensions(8192, 4096);
    expect(out.width).toBe(4096);
    expect(out.height).toBe(2048);
  });

  it('scales a portrait image down by its longest side', () => {
    const out = scaledDimensions(4096, 8192);
    expect(out.height).toBe(4096);
    expect(out.width).toBe(2048);
  });

  it('never rounds a dimension down to zero', () => {
    const out = scaledDimensions(10000, 1, 100);
    expect(out.height).toBeGreaterThanOrEqual(1);
  });
});

describe('stripImageMetadata', () => {
  // Falling back to the original is deliberate: refusing the upload would mean
  // a citizen in front of a real emergency cannot file a report because their
  // browser is old. A report carrying metadata beats no report.
  it('returns the original file when the environment cannot re-encode', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', {
      type: 'image/jpeg',
    });
    expect(await stripImageMetadata(file)).toBe(file);
  });

  it('leaves a non-image file alone', async () => {
    const file = new File([new Uint8Array([0x25, 0x50])], 'doc.pdf', { type: 'application/pdf' });
    expect(await stripImageMetadata(file)).toBe(file);
  });
});
