import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const mono = await readFile(path.join(root, 'assets/logo/dilogobasicwhite.svg'));
const colour = await readFile(path.join(root, 'assets/logo/dilogocolor.svg'));
const bg = { r: 24, g: 24, b: 24, alpha: 1 };
// app icons: the white monogram on the dark ground with breathing room
for (const size of [192, 512, 180]) {
  const inner = Math.round(size * 0.6);
  const glyph = await sharp(mono).resize({ width: inner, height: inner, fit: 'inside' }).png().toBuffer();
  const g = await sharp(glyph).metadata();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: glyph, left: Math.round((size - g.width) / 2), top: Math.round((size - g.height) / 2) }])
    .png().toFile(path.join(root, size === 180 ? 'assets/apple-touch-icon.png' : `assets/icon-${size}.png`));
}
// og image: the colour mark centred on the dark ground, 1200×630
const mark = await sharp(colour).resize({ height: 420, fit: 'inside' }).png().toBuffer();
const m = await sharp(mark).metadata();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: bg } })
  .composite([{ input: mark, left: Math.round((1200 - m.width) / 2), top: Math.round((630 - m.height) / 2) }])
  .png().toFile(path.join(root, 'assets/og.png'));
console.log('icons + og written');
