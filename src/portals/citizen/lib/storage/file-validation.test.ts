import { describe, it, expect } from 'vitest';
import { MAX_UPLOAD_BYTES, safeExt, canonicalMime, validateUploadFile } from '@/portals/citizen/lib/storage/file-validation';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = new TextEncoder().encode('%PDF-1.7 rest');

function mk(name: string, bytes: Uint8Array | ArrayBuffer, type: string): File {
  return new File([bytes as BlobPart], name, { type });
}

describe('safeExt', () => {
  it('accepts allowlisted extensions case-insensitively', () => {
    expect(safeExt(mk('ID.JPG', JPEG, 'image/jpeg'))).toBe('jpg');
    expect(safeExt(mk('doc.pdf', PDF, 'application/pdf'))).toBe('pdf');
  });
  it('rejects traversal-shaped and unknown names instead of passing them through', () => {
    expect(safeExt(mk('x.png/../../evil', JPEG, 'image/jpeg'))).toBeNull();
    expect(safeExt(mk('script.svg', PNG, 'image/svg+xml'))).toBeNull();
    expect(safeExt(mk('noextension', JPEG, ''))).toBeNull();
  });
});

describe('validateUploadFile', () => {
  it('accepts a real JPEG/PNG under the cap', async () => {
    expect(await validateUploadFile(mk('a.jpg', JPEG, 'image/jpeg'), 'image')).toBeNull();
    expect(await validateUploadFile(mk('a.png', PNG, 'image/png'), 'image')).toBeNull();
  });
  it('rejects a PDF where only images are allowed', async () => {
    expect(await validateUploadFile(mk('a.pdf', PDF, 'application/pdf'), 'image')).not.toBeNull();
    expect(await validateUploadFile(mk('a.pdf', PDF, 'application/pdf'), 'imageOrPdf')).toBeNull();
  });
  it('rejects content that does not match its extension (spoofed MIME)', async () => {
    const htmlBytes = new TextEncoder().encode('<html><script>1</script>');
    expect(await validateUploadFile(mk('evil.png', htmlBytes, 'image/png'), 'image')).not.toBeNull();
  });
  it('rejects oversize files', async () => {
    const big = mk('big.png', new Uint8Array(MAX_UPLOAD_BYTES + 1).fill(0x89), 'image/png');
    expect(await validateUploadFile(big, 'image')).not.toBeNull();
  });
});

describe('canonicalMime', () => {
  it('maps every allowlisted ext', () => {
    expect(canonicalMime('jpg')).toBe('image/jpeg');
    expect(canonicalMime('jpeg')).toBe('image/jpeg');
    expect(canonicalMime('png')).toBe('image/png');
    expect(canonicalMime('pdf')).toBe('application/pdf');
  });
});
