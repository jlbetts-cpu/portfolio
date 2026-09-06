// Gate: the header leaves going down and comes back going up. At the top of the page it shows with no ground; past the
// fold a downward scroll takes it off screen and any upward scroll brings it straight back, with the ground under it;
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
    const n = document.querySelector('#nav'), r = n.getBoundingClientRect(), cs = getComputedStyle(n);
    return { hidden: n.classList.contains('is-hidden'), ground: cs.backgroundColor !== 'rgba(0, 0, 0, 0)', top: Math.round(r.top), fixed: cs.position };
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
    bareAtTop: !top.hidden && !top.ground && top.top === 0,
    leavesDown: down.hidden && down.top < -20,
    comesBackUp: !up.hidden && up.top === 0 && up.ground,
    bareBackAtTop: !back.hidden && !back.ground,
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
await b.close();
if (selfTest) { const caught = !allOk; console.log(caught ? 'SELF-TEST OK: the frozen header was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
