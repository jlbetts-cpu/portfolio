// Gate: the header leaves going down and comes back going up. It is a floating pill (2026-10-13, his pick of five):
// the pill has its solid ground (no blur since "lets make it more clean remove the blur") and its 1px edge at the top
// of the page and wherever it shows; past the fold a
// downward scroll takes it off screen and any upward scroll brings it straight back;
// keyboard focus reveals it wherever it is, so a tab stop can never sit off screen. Both viewports.
// --self-test: raises the hide threshold past the scroll the gate makes, and expects the "leaves going down" check to fail.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
let allOk = true;
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const pg = await open(b, w, h);
  if (selfTest) await pg.evaluate(() => { const n = document.querySelector('#nav'); n.classList.remove = () => {}; n.classList.toggle = () => {}; });
  const st = () => pg.evaluate(() => {
    const n = document.querySelector('#nav'), r = n.getBoundingClientRect(), cs = getComputedStyle(n), pill = getComputedStyle(n.querySelector('.nav__bar'));
    return { hidden: n.classList.contains('is-hidden'), ground: /^rgb\(/.test(pill.backgroundColor) && pill.backdropFilter === 'none', line: pill.boxShadow !== 'none', top: Math.round(r.top), fixed: cs.position };
  });
  const at = async (y) => { await pg.evaluate(v => scrollTo(0, v), y); await pg.waitForTimeout(500); return st(); };
  const top = await st();
  const down = await at(1400);
  const up = await at(1200);
  const back = await at(0);
  await at(2000); await at(2700);
  const wasHidden = (await st()).hidden;
  await pg.evaluate(() => document.querySelector('.nav__brand').focus());
  await pg.waitForTimeout(250);
  const focusBack = wasHidden && !(await st()).hidden;
  const r = {
    fixed: top.fixed === 'fixed',
    barAtTop: !top.hidden && top.ground && top.line && top.top === 0,
    leavesDown: down.hidden && down.top < -20,
    comesBackUp: !up.hidden && up.top === 0 && up.ground,
    barBackAtTop: !back.hidden && back.ground && back.line,
    focusBack,
  };
  const ok = Object.values(r).every(Boolean);
  allOk = allOk && ok;
  report(`nav ${w}×${h}`, ok, JSON.stringify(r));
  await pg.close();
}
// under reduced motion it must still work — it just must not slide
const pg = await open(b, 1440, 900, { reduced: true });
await pg.evaluate(() => scrollTo(0, 1400)); await pg.waitForTimeout(500);
const rm = await pg.evaluate(() => { const n = document.querySelector('#nav'); const cs = getComputedStyle(n); return { hidden: n.classList.contains('is-hidden'), transform: cs.transform, top: Math.round(n.getBoundingClientRect().top) }; });
const rmOk = rm.hidden && (rm.transform === 'none' || rm.transform === 'matrix(1, 0, 0, 1, 0, 0)') && rm.top === 0;
if (!selfTest) { allOk = allOk && rmOk; report('nav (reduced): hides the class, never the slide', rmOk, JSON.stringify(rm)); }
await pg.close();
// The brand is the black-and-white logo and the name (2026-10-13, "can we just use the black and white di logo"): one
// small copy of the mark, in the ink and nothing else. It was the name alone from 2026-10-03, because the coloured
// mark at 26px beside a bold wordmark did not hold; this gate asserted that until he asked for the logo back.
if (!selfTest) {
  const lp = await open(b, 1440, 900);
  const lo = await lp.evaluate(() => ({ inHeader: document.querySelectorAll('.nav [data-theme-set], .nav [data-theme-toggle]').length, inFooter: document.querySelectorAll('#contact [data-theme-set]').length, markInBrand: document.querySelectorAll('.nav__brand svg').length, markInk: (() => { const g = document.querySelector('.nav__brand svg'); return !!g && getComputedStyle(g).color === getComputedStyle(document.querySelector('.hero__title')).color && !!g.querySelector('use[href="#mark"]'); })(), brand: document.querySelector('.nav__brand').textContent.trim() }));
  const loOk = lo.inHeader === 0 && lo.inFooter === 0 && lo.markInBrand === 1 && lo.markInk && lo.brand === 'Developmental Improvisation';
  allOk = allOk && loOk;
  report('nav: the brand is the black-and-white logo and the name; no theme switch anywhere (light only)', loOk, JSON.stringify(lo));
  await lp.close();
}
await b.close();
if (selfTest) { const caught = !allOk; console.log(caught ? 'SELF-TEST OK: the frozen header was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
