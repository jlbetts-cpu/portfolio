// Developmental Improvisation — image pipeline.
// Reads images/src/*, writes AVIF + WebP at 160/320/480/960/1440 (never upscaling), a JPEG fallback at 960,
// and a 24px blurred WebP placeholder as a data URI, into images/. Writes images/manifest.json.
import sharp from 'sharp';
import { readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../images/src');
const OUT = path.resolve(import.meta.dirname, '../images');
const WIDTHS = [160, 320, 480, 960, 1440];   // 160 is for the hero shapes and the ring: a 74px circle should not pull a 320px file
const SKIP = /^(letters|\.)/;
// Per-photograph grading, applied on the way out so images/src keeps the untouched original. Measured, not eyeballed:
// linda-portrait is a studio portrait on a black backdrop and 87% of its pixels sat in the bottom sixteenth of the
// luminance range, which left her a floating head and a shoe in a row of four bright classroom pictures. A gamma lift
// opens the jacket without touching the white point — a linear stretch was tried and clipped her face and the shoe.
const GRADE = { 'linda-portrait': img => img.gamma(2.2) };

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter(f => /\.(jpe?g|png|heic)$/i.test(f) && !SKIP.test(f));
const manifest = {};
for (const file of files) {
  const name = file.replace(/\.[^.]+$/, '');
  const graded = GRADE[name] || (i => i);
  const input = graded(sharp(path.join(SRC, file)).rotate()); // EXIF orientation, then any per-photograph grade
  const meta = await input.metadata();
  const w = meta.width, h = meta.height;
  const entry = { source: file, width: w, height: h, sizes: [], placeholder: '' };
  for (const tw of WIDTHS) {
    if (tw > w) continue;
    const base = `${name}-${tw}`;
    await input.clone().resize({ width: tw, withoutEnlargement: true }).avif({ quality: 55, effort: 4 }).toFile(path.join(OUT, `${base}.avif`));
    await input.clone().resize({ width: tw, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(OUT, `${base}.webp`));
    entry.sizes.push(tw);
  }
  const jw = Math.min(960, w);
  await input.clone().resize({ width: jw, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, `${name}-960.jpg`));
  const ph = await input.clone().resize({ width: 24 }).blur(1).webp({ quality: 40 }).toBuffer();
  entry.placeholder = `data:image/webp;base64,${ph.toString('base64')}`;
  entry.jpeg = `${name}-960.jpg`;
  manifest[name] = entry;
  const size = (await stat(path.join(OUT, `${name}-${entry.sizes[entry.sizes.length-1]}.avif`))).size;
  console.log(`${name.padEnd(20)} ${w}×${h} → ${entry.sizes.join('/')}  largest avif ${(size/1024).toFixed(0)} KB`);
}
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`${files.length} photographs, manifest written`);
