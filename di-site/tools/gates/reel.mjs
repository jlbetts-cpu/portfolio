// Gate: the reel. One thin row of photographs between the hero and the first section (2026-10-13: "a horizonatal band
// spliting up the hero and the next section"). It drifts sideways on its own; the pointer holds it so a photograph can
// be clicked; a wheel over it scrolls the PAGE and never the row (the row stays a pure function of the flow); it wraps
// inside its own loop length; three runs, the second and third the loop's copies, so a wide screen never sees the
// seam; every photograph is 4:5; it is a band, not a section (at most 240px since "make the band a little thicker"), full bleed, uncut by any fade, and it comes straight
// after the hero.
// Since 2026-10-14 it is drawn as a film strip ("I would love if it was designed kinda like a film strip").
// It replaced gallery.mjs, the gate of the four-to-six columns that rose under the hero and then at the page's foot.
// --self-test: gives the reel the wheel handler a scrubbable version would have, which "pageMoved" must catch.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
for (const [w, h] of (selfTest ? [[1440, 900]] : [[1440, 900], [820, 1180], [390, 844]])) {
  const pg = await open(b, w, h);
  await pg.evaluate(() => document.querySelector('.reel').scrollIntoView({ block: 'center' }));
  await pg.mouse.move(4, 4);
  await pg.waitForTimeout(1200);
  if (selfTest) await pg.evaluate(() => {
    document.querySelector('[data-reel]').addEventListener('wheel', (e) => { e.preventDefault(); }, { passive: false });
  });
  const xs = () => pg.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.reel__track')).transform).m41);
  const a = await xs(); await pg.waitForTimeout(800); const c = await xs();
  const d = a - c;
  // it slides left (the translate goes more negative), unless it wrapped in the window, which shows as a big jump
  const drifts = d > 2 || d < -200;
  // the pointer holds it
  const mid = await pg.evaluate(() => { const r = document.querySelector('.reel').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await pg.mouse.move(mid[0], mid[1]); await pg.waitForTimeout(1400);
  const h0 = await xs(); await pg.waitForTimeout(600); const h1 = await xs();
  const holds = Math.abs(h1 - h0) < 1.5;
  // a wheel over the reel scrolls the page, and the row stays where the flow puts it
  const y0 = await pg.evaluate(() => scrollY);
  await pg.mouse.wheel(0, 240); await pg.waitForTimeout(450);
  const check = await pg.evaluate(() => {
    const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reel-px')) || 11;
    const len = document.querySelector('.reel__run').getBoundingClientRect().width;
    const want = (((window.__di.flow.angle * px) % len) + len) % len;
    const got = -new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.reel__track')).transform).m41;
    const off = Math.min(Math.abs(want - got), len - Math.abs(want - got));
    return { off: +off.toFixed(1), scrollY };
  });
  const noScrub = check.off < 6;
  const pageMoved = check.scrollY > y0 + 100;
  await pg.mouse.move(4, 4); await pg.waitForTimeout(400);
  const geom = await pg.evaluate(() => {
    const reel = document.querySelector('.reel'), cs = getComputedStyle(reel), r = reel.getBoundingClientRect();
    const mask = cs.maskImage || cs.webkitMaskImage || '';
    const runs = [...reel.querySelectorAll('.reel__run')];
    const dx = -new DOMMatrixReadOnly(getComputedStyle(reel.querySelector('.reel__track')).transform).m41;
    const len = runs[0].getBoundingClientRect().width;
    const prev = reel.previousElementSibling;
    return {
      clips: cs.overflow === 'hidden',
      clean: !mask || mask === 'none',
      wrapped: dx >= -0.5 && dx <= len + 0.5,
      filled: 2 * len >= innerWidth,
      runs: runs.length === 3 && runs.slice(1).every(r => r.getAttribute('aria-hidden') === 'true' && Math.abs(r.offsetWidth - runs[0].offsetWidth) < 1),
      ratios: [...reel.querySelectorAll('.photo')].every(p => p.classList.contains('photo--4x5')),
      thin: Math.round(r.height),
      bleed: Math.round(r.left) === 0 && Math.round(r.right) === innerWidth,
      afterHero: !!prev && prev.id === 'top',
      // drawn as film: sprocket holes at both edges of every frame, the base darker than mid-grey, and a frame exactly
      // eight holes wide in whole pixels, or the holes double up where two frames meet (they did, before the fix)
      film: (() => { const it = reel.querySelector('.reel__item'), cs = getComputedStyle(it), w = it.getBoundingClientRect().width; const pitch = parseFloat(cs.backgroundSize); const m = cs.backgroundColor.match(/[\d.]+/g).map(Number); return (cs.backgroundImage.match(/url\(/g) || []).length === 2 && (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255 < 0.2 && Number.isInteger(pitch) && Math.abs(w - 8 * pitch) < 0.01; })(),
    };
  });
  const ok = drifts && holds && noScrub && pageMoved && geom.clips && geom.clean && geom.wrapped && geom.filled && geom.runs && geom.ratios && geom.thin <= 240 && geom.bleed && geom.afterHero && geom.film;
  report(`reel ${w}×${h}`, ok, JSON.stringify({ drifts, holds, noScrub, offBy: check.off, pageMoved, ...geom }));
  await pg.close();
}
await b.close();
if (selfTest) { const caught = process.exitCode === 1; console.log(caught ? 'SELF-TEST OK: the injected scrub was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
