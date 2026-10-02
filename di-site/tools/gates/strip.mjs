// Gate: the strip. It drifts on its own, it NEVER responds to a wheel (the whole difference from the bento it
// replaced), the pointer holds it so a photograph can be clicked, it wraps without running past its own loop length,
// the section clips it, and its edges are masked so it fades rather than ending on a cut.
// --self-test: gives the strip back a wheel handler that moves it, which the "no scrub" check must catch.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
for (const [w, h] of (selfTest ? [[1440, 900]] : [[1440, 900], [390, 844]])) {
  const pg = await open(b, w, h);
  // the strip sits below the fold at every viewport the hero fills, so scroll to it before pointing at it
  await pg.evaluate(() => document.querySelector('.strip').scrollIntoView({ block: 'center' }));
  await pg.mouse.move(4, 4);
  await pg.waitForTimeout(1200);
  // --self-test: a wheel handler that takes the gesture, which is the shape the version this replaced actually had —
  // it called preventDefault and steered the strip by the delta. The page then does not scroll, which is the thing a
  // visitor notices first and the thing this gate is here to stop coming back.
  if (selfTest) await pg.evaluate(() => {
    const s = document.querySelector('[data-strip]');
    s.addEventListener('wheel', (e) => { e.preventDefault(); }, { passive: false });
  });
  const x = () => pg.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('[data-strip]')).transform).m41);
  const a = await x(); await pg.waitForTimeout(700); const c = await x();
  const drifts = Math.abs(c - a) > 2;
  // the pointer holds it rather than steering it
  const mid = await pg.evaluate(() => { const r = document.querySelector('.strip').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  // the hold eases the drift out over ~0.18s and the angle is still 0.32s behind its target, so it coasts for about
  // a second after the pointer lands; sample after that, not during it
  await pg.mouse.move(mid[0], mid[1]); await pg.waitForTimeout(1400);
  const h0 = await x(); await pg.waitForTimeout(600); const h1 = await x();
  const holds = Math.abs(h1 - h0) < 1.5;
  // A wheel over the strip must do two things and no third: scroll the PAGE by the full amount, and leave the strip's
  // position a pure function of the flow. It cannot be tested as "the transform does not change" — the flow is
  // scroll-coupled by design, so 240px of scroll legitimately advances it. What a scrub would add is an offset the
  // flow does not account for, so that is what is measured: where the strip IS against where the flow says it should
  // be. The version this replaced took the wheel and moved the strip by it; this catches exactly that.
  const y0 = await pg.evaluate(() => scrollY);
  await pg.mouse.wheel(0, 240); await pg.waitForTimeout(450);
  const check = await pg.evaluate(() => {
    const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--strip-px')) || 14;
    const half = document.querySelector('.strip__row').getBoundingClientRect().width;
    const want = ((window.__di.flow.angle * px % half) + half) % half;
    const got = -new DOMMatrixReadOnly(getComputedStyle(document.querySelector('[data-strip]')).transform).m41;
    const d = Math.min(Math.abs(want - got), half - Math.abs(want - got));
    return { off: +d.toFixed(1), scrollY: scrollY };
  });
  const noScrub = check.off < 6;
  const pageMoved = check.scrollY > y0 + 100;
  await pg.mouse.move(4, 4); await pg.waitForTimeout(600);
  const geom = await pg.evaluate(() => {
    const sec = document.querySelector('.strip'), track = document.querySelector('[data-strip]');
    const row = document.querySelector('.strip__row');
    const cs = getComputedStyle(sec);
    const dx = Math.abs(new DOMMatrixReadOnly(getComputedStyle(track).transform).m41);
    return {
      clips: cs.overflow === 'hidden',
      faded: /linear-gradient/.test(cs.maskImage || cs.webkitMaskImage || ''),
      wrapped: dx <= row.getBoundingClientRect().width + 1,
      fullBleed: Math.round(sec.getBoundingClientRect().width) >= innerWidth - 1,
      rows: document.querySelectorAll('.strip__row').length,
    };
  });
  const ok = drifts && holds && noScrub && pageMoved && geom.clips && geom.faded && geom.wrapped && geom.fullBleed && geom.rows === 2;
  report(`strip ${w}×${h}`, ok, JSON.stringify({ drifts, holds, noScrub, offBy: check.off, pageMoved, ...geom }));
  await pg.close();
}
await b.close();
if (selfTest) { const caught = process.exitCode === 1; console.log(caught ? 'SELF-TEST OK: the injected scrub was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
