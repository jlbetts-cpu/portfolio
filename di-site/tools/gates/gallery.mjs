// Gate: the gallery. Four columns of photographs rising on their own (three on a tablet, two on a phone). Every
// visible column drifts, they do NOT all travel at one rate (that is what makes one-shape photographs read as
// masonry), the pointer holds them so a photograph can be clicked, a wheel over them scrolls the PAGE and never the
// columns, each column wraps inside its own loop length, the stage clips them, and the top and the bottom are masked
// so the photographs fade rather than ending on a cut.
// --self-test: gives the gallery the wheel handler the scrubbable version had, which "pageMoved" must catch.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
for (const [w, h] of (selfTest ? [[1440, 900]] : [[1440, 900], [820, 1180], [390, 844]])) {
  const pg = await open(b, w, h);
  await pg.evaluate(() => document.querySelector('.gallery__stage').scrollIntoView({ block: 'center' }));
  await pg.mouse.move(4, 4);
  await pg.waitForTimeout(1200);
  if (selfTest) await pg.evaluate(() => {
    document.querySelector('[data-gallery]').addEventListener('wheel', (e) => { e.preventDefault(); }, { passive: false });
  });
  const ys = () => pg.evaluate(() => [...document.querySelectorAll('.gallery__col')].filter(c => c.offsetParent).map(c => new DOMMatrixReadOnly(getComputedStyle(c).transform).m42));
  const a = await ys(); await pg.waitForTimeout(800); const c = await ys();
  const deltas = a.map((v, i) => { let d = v - c[i]; return d; });
  // every column rises (the translate goes more negative), unless it wrapped in the window, which shows as a big jump
  const drifts = deltas.every(d => d > 2 || d < -200);
  const rising = deltas.filter(d => d > 0 && d < 200);
  const rates = new Set(rising.map(d => Math.round(d)));
  const uneven = rates.size > 1;
  // the pointer holds them
  const mid = await pg.evaluate(() => { const r = document.querySelector('.gallery__stage').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await pg.mouse.move(mid[0], mid[1]); await pg.waitForTimeout(1400);
  const h0 = await ys(); await pg.waitForTimeout(600); const h1 = await ys();
  const holds = h0.every((v, i) => Math.abs(h1[i] - v) < 1.5);
  // A wheel over the gallery scrolls the page, and each column stays a pure function of the flow — the flow is
  // scroll-coupled by design, so the columns legitimately move; what a scrub would add is an offset the flow does not
  // account for, and the self-test's preventDefault shows up as a page that did not move.
  const y0 = await pg.evaluate(() => scrollY);
  await pg.mouse.wheel(0, 240); await pg.waitForTimeout(450);
  const check = await pg.evaluate(() => {
    const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gallery-px')) || 11;
    const SPEED = [1, 1.18, .9, 1.1], START = [.08, .52, .3, .78];
    let worst = 0;
    [...document.querySelectorAll('.gallery__col')].forEach((col, i) => {
      if (!col.offsetParent) return;
      const len = col.querySelector('.gallery__run').getBoundingClientRect().height;
      const n = col.querySelectorAll('.gallery__item').length / 2;
      const want = (((window.__di.flow.angle * px * SPEED[i] + START[i] * len / n) % len) + len) % len;
      const got = -new DOMMatrixReadOnly(getComputedStyle(col).transform).m42;
      const d = Math.min(Math.abs(want - got), len - Math.abs(want - got));
      worst = Math.max(worst, d);
    });
    return { off: +worst.toFixed(1), scrollY };
  });
  const noScrub = check.off < 6;
  const pageMoved = check.scrollY > y0 + 100;
  await pg.mouse.move(4, 4); await pg.waitForTimeout(400);
  const geom = await pg.evaluate(() => {
    const st = document.querySelector('.gallery__stage'), cs = getComputedStyle(st);
    const mask = cs.maskImage || cs.webkitMaskImage || '';
    const cols = [...document.querySelectorAll('.gallery__col')].filter(c => c.offsetParent);
    const wrapped = cols.every(c => { const dy = -new DOMMatrixReadOnly(getComputedStyle(c).transform).m42; return dy >= -0.5 && dy <= c.querySelector('.gallery__run').getBoundingClientRect().height + 0.5; });
    // a column's run must be at least as tall as the stage, or the loop shows its own seam: the second copy ends
    // before the stage does and there is ground under the last photograph
    const filled = cols.every(c => c.querySelector('.gallery__run').getBoundingClientRect().height >= st.getBoundingClientRect().height);
    const runs = cols.every(c => { const r = c.querySelectorAll('.gallery__run'); return r.length === 2 && r[1].getAttribute('aria-hidden') === 'true' && Math.abs(r[0].offsetHeight - r[1].offsetHeight) < 1; });
    const ratios = [...st.querySelectorAll('.photo')].every(p => p.classList.contains('photo--4x5'));
    return { clips: cs.overflow === 'hidden', faded: /linear-gradient/.test(mask) && (mask.match(/transparent|rgba\(0, 0, 0, 0\)/g) || []).length >= 2, wrapped, filled, runs, ratios, columns: cols.length };
  });
  const want = w >= 1024 ? 4 : w >= 768 ? 3 : 2;
  const ok = drifts && uneven && holds && noScrub && pageMoved && geom.clips && geom.faded && geom.wrapped && geom.filled && geom.runs && geom.ratios && geom.columns === want;
  report(`gallery ${w}×${h}`, ok, JSON.stringify({ drifts, uneven, holds, noScrub, offBy: check.off, pageMoved, ...geom, want }));
  await pg.close();
}
await b.close();
if (selfTest) { const caught = process.exitCode === 1; console.log(caught ? 'SELF-TEST OK: the injected scrub was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
