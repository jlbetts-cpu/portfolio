// The marks the page is seen by before it is opened: the share card a link unfurls into (iMessage, Slack, a text), the
// home-screen icon, and the browser tab's icon. Light since 2026-10-14, like the page: they were the white monogram on
// the old dark ground and the logo in its first palette with a white star, a day after the page went light only and
// took the tuned palette and the gold star.
//   og.png              1200×630, the hero's mark, whole and in the tuned palette, on the page's white
//   apple-touch-icon    180, and icon-192 / icon-512 for the manifest: the "di" monogram, sky with the gold star, on
//                       white. The monogram, as before, because the whole mark's circle of figures is mush at 60pt
//   logo/favicon.svg    the same monogram on nothing. Sky and gold read on a white tab, a grey tab strip and a dark one
//                       alike (rendered at 16 and 32 on all three), so it needs no dark-scheme variant; the ink
//                       monogram vanished on a dark tab strip, and the old white one vanished on every light one
// The colours come from tokens.css, so a change to --logo-* reaches these on the next run of this script.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const tokens = await readFile(path.join(root, 'css/tokens.css'), 'utf8');
const tok = (name) => { const m = tokens.match(new RegExp(`--logo-${name}:\\s*(#[0-9A-Fa-f]{6})`)); if (!m) throw new Error(`no --logo-${name}`); return m[1]; };
// each colour the logo files were drawn in, to the name its token has (build-html.py's LOGO_PART, the same eight)
const PART = { '#F0895B': 'orange', '#FB9BC9': 'pink', '#E744E2': 'magenta', '#FEE79B': 'yellow', '#7358FC': 'violet', '#51E596': 'green', '#58CDFC': 'sky', 'white': 'star' };
const tune = (svg) => svg.replace(/fill="(#[0-9A-Fa-f]{6}|white)"/g, (m, f) => { const p = PART[f.toUpperCase()] || PART[f]; if (!p) throw new Error(`a logo colour with no name: ${f}`); return `fill="${tok(p)}"`; });
const mark = tune(await readFile(path.join(root, 'assets/logo/dilogocolor.svg'), 'utf8'));
const mono = tune(await readFile(path.join(root, 'assets/logo/di.svg'), 'utf8'));
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const render = (svg, w, h) => sharp(Buffer.from(svg), { density: 600 }).resize({ width: w, height: h, fit: 'inside' }).png().toBuffer();

for (const size of [192, 512, 180]) {
  const inner = Math.round(size * 0.6);
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: await render(mono, inner, inner), gravity: 'centre' }])
    .png().toFile(path.join(root, size === 180 ? 'assets/apple-touch-icon.png' : `assets/icon-${size}.png`));
}
await sharp({ create: { width: 1200, height: 630, channels: 4, background: WHITE } })
  .composite([{ input: await render(mark, null, 420), gravity: 'centre' }])
  .png().toFile(path.join(root, 'assets/og.png'));
await writeFile(path.join(root, 'assets/logo/favicon.svg'), mono);
console.log('icons, favicon + og written');
