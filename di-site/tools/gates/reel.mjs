// Gate: the reel. One thin row of photographs between the hero and the first section (2026-10-13: "a horizonatal band
// spliting up the hero and the next section"). It drifts sideways on its own; the pointer holds it so a photograph can
// be clicked; an up-and-down wheel over it scrolls the PAGE and never the row (the row stays a pure function of the flow
// and of how far the hand has moved it); since 2026-10-14 it can be moved by hand ("make it so you are able to
// horizonatal scroll on the film strip carousel if you want"): a sideways wheel moves it one to one and not the page, a
// mouse drag moves it and opens nothing, a plain click still opens the lightbox, a finger moving sideways moves it and
// not the page, and a finger moving up it scrolls the page and not the row; it wraps
// inside its own loop length; three runs, the second and third the loop's copies, so a wide screen never sees the
// seam; every photograph is 4:5; it is a band, not a section (at most 240px since "make the band a little thicker"), full bleed, uncut by any fade, and it comes straight
// after the hero.
// Since 2026-10-14 it is drawn as a film strip ("I would love if it was designed kinda like a film strip").
// It replaced gallery.mjs, the gate of the four-to-six columns that rose under the hero and then at the page's foot.
// --self-test: three bugs, each run on its own page and each must be caught. "block" gives the reel a wheel handler
// that eats every wheel, the page's up-and-down one too, which "pageMoved" must catch; "deaf" stops the wheel and the
// pointer reaching the reel, which "swipes" and "drags" must catch; "pinned" sets touch-action:none, so a finger moving
// up the strip cannot scroll the page, which "fingerUp" must catch.
import { browser, open, report, URL } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const INJECT = {
  block: () => document.querySelector('[data-reel]').addEventListener('wheel', (e) => { e.preventDefault(); }, { passive: false }),
  deaf: () => { for (const t of ['wheel', 'pointerdown', 'pointermove', 'pointerup']) addEventListener(t, (e) => { if (e.target.closest && e.target.closest('[data-reel]')) e.stopImmediatePropagation(); }, { capture: true, passive: false }); },
  pinned: () => { document.querySelector('[data-reel]').style.touchAction = 'none'; },
};
const b = await browser();
const caught = {};
const runs = selfTest ? [[1440, 900, 'block'], [1440, 900, 'deaf'], [390, 844, 'pinned']] : [[1440, 900], [820, 1180], [390, 844]];
for (const [w, h, bug] of runs) {
  const pg = await open(b, w, h);
  await pg.evaluate(() => document.querySelector('.reel').scrollIntoView({ block: 'center' }));
  await pg.mouse.move(4, 4);
  await pg.waitForTimeout(1200);
  if (bug && bug !== 'pinned') await pg.evaluate(INJECT[bug]);
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
    const want = (((window.__di.flow.angle * px + window.__di.reel.by) % len) + len) % len;
    const got = -new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.reel__track')).transform).m41;
    const off = Math.min(Math.abs(want - got), len - Math.abs(want - got));
    return { off: +off.toFixed(1), scrollY };
  });
  const noScrub = check.off < 6;
  const pageMoved = check.scrollY > y0 + 100;
  // the hand. Back to the reel, held under the pointer, then a sideways wheel, a drag, and a click
  await pg.evaluate(() => document.querySelector('.reel').scrollIntoView({ block: 'center' }));
  const at = await pg.evaluate(() => { const r = document.querySelector('.reel').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await pg.mouse.move(at[0], at[1]); await pg.waitForTimeout(1400);
  const hand = () => pg.evaluate(() => ({ by: window.__di.reel.by, x: new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.reel__track')).transform).m41, len: window.__di.reel.len, y: scrollY, sx: scrollX, lb: document.querySelector('#lightbox').open }));
  const s0 = await hand();
  await pg.mouse.wheel(300, 0); await pg.waitForTimeout(300);
  const s1 = await hand();
  // the row moved left by the wheel's 300 (modulo the loop), and the page did not move either way
  const moved = (((s0.x - s1.x) % s1.len) + s1.len) % s1.len;
  const swipes = Math.abs(moved - 300) < 8 && s1.y === s0.y && s1.sx === 0;
  // from 100px left of the middle to 100px right of it, so a phone-wide page keeps the whole drag on screen
  await pg.mouse.move(at[0] - 100, at[1]); await pg.mouse.down();
  for (let i = 1; i <= 20; i++) { await pg.mouse.move(at[0] - 100 + i * 10, at[1]); await pg.waitForTimeout(16); }
  await pg.waitForTimeout(150); await pg.mouse.up(); await pg.waitForTimeout(500);
  const s2 = await hand();
  // a 200px drag right moves the row right by the drag less the 8px it takes to become one, and opens nothing
  const dragged = s1.by - s2.by;
  const drags = dragged > 170 && dragged <= 200 && !s2.lb;
  // on the middle of the frame nearest the middle: where the strip stops is wherever the drift left it, and the 6px of
  // film between two frames opens nothing (this read false once in a full run, on the gap)
  const fr = await pg.evaluate((cx) => { const bs = [...document.querySelectorAll('.reel .photo__open')].map(b => b.getBoundingClientRect()).sort((p, q) => Math.abs(p.x + p.width / 2 - cx) - Math.abs(q.x + q.width / 2 - cx)); return [bs[0].x + bs[0].width / 2, bs[0].y + bs[0].height / 2]; }, at[0]);
  await pg.mouse.move(fr[0], fr[1]); await pg.mouse.down(); await pg.mouse.up(); await pg.waitForTimeout(500);
  const clicks = (await hand()).lb;
  if (clicks) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(400); }
  // a finger, on a phone-sized page only: emulated touch through the browser's own input, so pan-y is really applied
  let finger = {};
  if (w < 768) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const tp = await ctx.newPage();
    await tp.addInitScript(() => { try { sessionStorage.setItem('di:curtain', '1'); } catch {} });
    await tp.goto(URL); await tp.waitForTimeout(800);
    if (bug === 'pinned') await tp.evaluate(INJECT.pinned);
    await tp.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.reel').scrollIntoView({ block: 'center' }); });
    await tp.waitForTimeout(600);
    const cdp = await ctx.newCDPSession(tp);
    const p = await tp.evaluate(() => { const r = document.querySelector('.reel').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const read = () => tp.evaluate(() => ({ by: window.__di.reel.by, y: scrollY }));
    const swipe = async (dx, dy) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p[0], y: p[1] }] });
      for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p[0] + dx * i / 12, y: p[1] + dy * i / 12 }] }); await tp.waitForTimeout(16); }
      await tp.waitForTimeout(120);   // still before letting go, so nothing glides and the reading is the drag alone
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await tp.waitForTimeout(500);
    };
    const f0 = await read(); await swipe(-160, 0); const f1 = await read(); await swipe(0, -240); const f2 = await read();
    finger = { sideBy: +(f1.by - f0.by).toFixed(1), sideY: f1.y - f0.y, upY: f2.y - f1.y, upBy: +(f2.by - f1.by).toFixed(1) };
    finger.fingerSide = finger.sideBy > 120 && finger.sideY === 0;
    finger.fingerUp = finger.upY > 150 && finger.upBy === 0;
    await ctx.close();
  }
  const fingers = w >= 768 || (finger.fingerSide && finger.fingerUp);
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
  const ok = drifts && holds && noScrub && pageMoved && swipes && drags && clicks && fingers && geom.clips && geom.clean && geom.wrapped && geom.filled && geom.runs && geom.ratios && geom.thin <= 240 && geom.bleed && geom.afterHero && geom.film;
  report(`reel ${w}×${h}${bug ? ' [' + bug + ']' : ''}`, ok, JSON.stringify({ drifts, holds, noScrub, offBy: check.off, pageMoved, swipes, moved: +moved.toFixed(1), drags, dragged: +dragged.toFixed(1), clicks, ...finger, ...geom }));
  if (bug) caught[bug] = !ok;
  await pg.close();
}
await b.close();
if (selfTest) { const all = Object.keys(INJECT).every(k => caught[k]); console.log(all ? 'SELF-TEST OK: all three injected bugs were caught' : 'SELF-TEST FAILED: not caught: ' + Object.keys(INJECT).filter(k => !caught[k]).join(', ')); process.exitCode = all ? 0 : 1; }
