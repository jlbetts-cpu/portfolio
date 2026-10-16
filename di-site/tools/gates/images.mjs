// Gate: every img has width/height/alt/srcset; nothing served wider than 1.5× its drawn width at 1440; and no
// photograph appears twice ANYWHERE on the page. That last rule got stricter when the gallery went: with eleven
// photographs instead of twenty-five, a repeat is the difference between a considered set and a thin one.
// SHARP, NOT ONLY SMALL (2026-10-16). A frame fills with its photograph (object-fit: cover), so a photograph wider than
// its frame is DRAWN wider than it: a 3:2 one in the strip's 4:5 frame at 1.875 times the frame's width. This gate
// measured against the frame, and asked only that nothing be too large, so it passed a page whose photographs were
// stretched a median 1.83x in the ring and 1.61x in the strip on a 2x screen. Both sides are now measured against the
// width drawn, at 1440 on 1x and 2x and on a 3x phone (served as 2x, on purpose): no file stretched past 1.25x unless
// it is already the largest there is, and none more than twice what is drawn unless it is the smallest.
// --self-test: puts back the sizes that counted the frame and not the crop; "sharp" must fail.
import { browser, open, report, URL } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const sharp = async (w, h, dpr) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => { try { sessionStorage.setItem('di:curtain', '1'); } catch {} });
  // the bug: the old sizes, the frame's width (and less, for the ring and the sections), whatever the crop
  if (selfTest) await pg.route(/index\.html$/, async (route) => {
    const res = await route.fetch(); let t = await res.text();
    t = t.replace(/sizes="([^"]*)"/g, (m, v) => /\(max-width: 959px\)/.test(v) ? 'sizes="(max-width: 767px) 90px, (max-width: 1679px) 138px, 162px"'
      : /\(max-width: 420px\)/.test(v) ? 'sizes="(max-width: 767px) 76px, (max-width: 1023px) 116px, 148px"'
      : /calc\(/.test(v) ? 'sizes="(max-width: 767px) 92vw, 44vw"' : m);
    await route.fulfill({ response: res, body: t });
  });
  await pg.goto(URL); await pg.waitForTimeout(500);
  await pg.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate((cap) => {
    const soft = [], heavy = [];
    for (const img of document.querySelectorAll('.tell .photo img, .ring .photo img, .reel__run:not([aria-hidden]) .photo img')) {
      const f = img.closest('.photo'), m = (img.currentSrc || '').match(/([a-z-]+)-(\d+)\.\w+/); if (!m) continue;
      const a = +img.getAttribute('width') / +img.getAttribute('height');
      const drawn = Math.max(f.offsetWidth, f.offsetHeight * a) * Math.min(devicePixelRatio, cap);
      const ws = img.parentElement.querySelector('source').getAttribute('srcset').match(/\d+(?=w)/g).map(Number), got = +m[2];
      if (got * 1.25 < drawn && got < Math.max(...ws)) soft.push(`${m[1]} ${got} for ${Math.round(drawn)}`);
      if (got > drawn * 2 && got > Math.min(...ws)) heavy.push(`${m[1]} ${got} for ${Math.round(drawn)}`);
    }
    return { soft, heavy };
  }, w < 768 ? 2 : 9);
  await ctx.close();
  return r;
};
const sharpness = {};
for (const [w, h, dpr] of [[1440, 900, 1], [1440, 900, 2], [390, 844, 3]]) sharpness[`${w}@${dpr}`] = await sharp(w, h, dpr);
const sharpOk = Object.values(sharpness).every(r => !r.soft.length), lightOk = Object.values(sharpness).every(r => !r.heavy.length);
report('images: sharp, every photograph\'s file at least 1/1.25 of the width drawn (or the largest there is)', sharpOk, JSON.stringify(Object.fromEntries(Object.entries(sharpness).map(([k, r]) => [k, r.soft]))));
if (selfTest) { await b.close(); console.log(!sharpOk ? 'SELF-TEST OK: the sizes that forgot the crop were caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exit(!sharpOk ? 0 : 1); }
report('images: light, no file more than twice the width drawn (or the smallest there is)', lightOk, JSON.stringify(Object.fromEntries(Object.entries(sharpness).map(([k, r]) => [k, r.heavy]))));
const pg = await open(b, 1440, 900);
await pg.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
await pg.waitForTimeout(1500);
const r = await pg.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')].filter(i => !i.closest('[aria-hidden="true"]'));
  const missing = imgs.filter(i => !i.getAttribute('width') || !i.getAttribute('height') || i.getAttribute('alt') === null || !i.closest('picture')).length;
  // the width drawn, which for a photograph filling a frame narrower than itself is wider than the frame
  const drawn = (i) => { const f = i.closest('.photo') || i; return Math.max(f.offsetWidth, f.offsetHeight * (+i.getAttribute('width') / +i.getAttribute('height'))); };
  const oversized = imgs.filter(i => i.currentSrc && i.naturalWidth > 0 && i.getBoundingClientRect().width > 0 && i.naturalWidth > drawn(i) * devicePixelRatio * 1.5 + 100).map(i => `${i.currentSrc.split('/').pop()} ${i.naturalWidth}px for ${Math.round(drawn(i))}px`);
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
