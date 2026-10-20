// One-shot: re-encode oversized public/ rasters in place.
// Usage (from the repo root): node src/portals/citizen/scripts/optimize-images.mjs
import { readdir, stat, rename } from 'node:fs/promises';
import { join, extname } from 'node:path';
import sharp from 'sharp';

const ROOT = 'public';
const MAX_WIDTH = 1920;
const TARGET_BYTES = 300 * 1024;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

for await (const file of walk(ROOT)) {
  const ext = extname(file).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;
  const before = (await stat(file)).size;
  if (before <= TARGET_BYTES) continue;
  const tmp = file + '.opt';
  const img = sharp(file).resize({ width: MAX_WIDTH, withoutEnlargement: true });
  if (ext === '.png') await img.png({ compressionLevel: 9, palette: true }).toFile(tmp);
  else await img.jpeg({ quality: 78, mozjpeg: true }).toFile(tmp);
  const after = (await stat(tmp)).size;
  if (after < before) {
    await rename(tmp, file);
    console.log(`${file}: ${(before / 1024) | 0} KB -> ${(after / 1024) | 0} KB`);
  } else {
    const { unlink } = await import('node:fs/promises');
    await unlink(tmp);
  }
}
