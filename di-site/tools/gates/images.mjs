// Gate: every img has width/height/alt/srcset; nothing served wider than 1.5× its rendered width at 1440; and no
// photograph appears twice ANYWHERE on the page. That last rule got stricter when the gallery went: with eleven
// photographs instead of twenty-five, a repeat is the difference between a considered set and a thin one.
import { browser, open, report } from './_lib.mjs';
const b = await browser();
const pg = await open(b, 1440, 900);
await pg.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
await pg.waitForTimeout(1500);
const r = await pg.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')].filter(i => !i.closest('[aria-hidden="true"]'));
  const missing = imgs.filter(i => !i.getAttribute('width') || !i.getAttribute('height') || i.getAttribute('alt') === null || !i.closest('picture')).length;
  const oversized = imgs.filter(i => i.currentSrc && i.naturalWidth > 0 && i.getBoundingClientRect().width > 0 && i.naturalWidth > i.getBoundingClientRect().width * devicePixelRatio * 1.5 + 100).map(i => `${i.currentSrc.split('/').pop()} ${i.naturalWidth}px for ${Math.round(i.getBoundingClientRect().width)}px`);
  // groups: the two sections, the ring and the gallery's first runs (the second run of every column is the loop's copy
  // by design). Each unique within itself, and no photograph is used in two places.
  const groups = [imgs.filter(i => i.closest('.tell')), imgs.filter(i => i.closest('.ring')), imgs.filter(i => i.closest('.gallery__run:not([aria-hidden])'))].map(g => g.map(i => i.getAttribute('src')));
  const all = groups.flat();
  const dupes = all.filter((s, i) => all.indexOf(s) !== i);
  return { count: imgs.length, missing, oversized, dupes };
});
report('images', r.missing === 0 && r.oversized.length === 0 && r.dupes.length === 0, `${r.count} images; missing attrs ${r.missing}; oversized ${r.oversized.length ? r.oversized.join(', ') : 0}; dupes ${r.dupes.length}`);
await b.close();
