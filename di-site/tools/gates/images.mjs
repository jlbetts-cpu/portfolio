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
  // groups: the two sections, the ring and the reel's first run (its second and third runs are the loop's copies by
  // design). Each unique within itself, and no photograph is used in two places.
  const groups = [imgs.filter(i => i.closest('.tell')), imgs.filter(i => i.closest('.ring')), imgs.filter(i => i.closest('.reel__run:not([aria-hidden])'))].map(g => g.map(i => i.getAttribute('src')));
  const all = groups.flat();
  const dupes = all.filter((s, i) => all.indexOf(s) !== i);
  return { count: imgs.length, missing, oversized, dupes };
});
report('images', r.missing === 0 && r.oversized.length === 0 && r.dupes.length === 0, `${r.count} images; missing attrs ${r.missing}; oversized ${r.oversized.length ? r.oversized.join(', ') : 0}; dupes ${r.dupes.length}`);
// every photograph fades in over its placeholder once it has decoded (2026-10-14), which means each one starts at
// opacity 0: a photograph that never gets its mark is a photograph nobody sees. After a walk down the page, every one
// that has loaded is marked and fully opaque, on each of the sections, the ring and the reel.
const fade = await pg.evaluate(async () => {
  for (const sel of ['#about', '#founder', '#quote', '.reel']) { document.querySelector(sel).scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 900)); }
  const imgs = [...document.querySelectorAll('.tell .photo img, .ring .photo img, .reel__run:not([aria-hidden]) .photo img')].filter(i => i.complete && i.naturalWidth);
  const hidden = imgs.filter(i => !i.classList.contains('is-loaded') || parseFloat(getComputedStyle(i).opacity) < 0.99).map(i => i.currentSrc.split('/').pop());
  return { loaded: imgs.length, hidden };
});
report('images: every loaded photograph is shown, none left at the fade\'s opacity 0', fade.loaded >= 10 && fade.hidden.length === 0, JSON.stringify(fade));
await b.close();
