// Gate: under reduced motion nothing drifts (ring, strip, shapes), nothing animates after 300ms and reveals still reach opacity 1;
// without it the ring drifts, the strip drifts, the stack scales the covered card, and a stacked card's bloom rises under the pointer.
import { browser, open, report } from './_lib.mjs';
const b = await browser();
let pg = await open(b, 1440, 900, { reduced: true });
await pg.waitForTimeout(300);
const r1 = await pg.evaluate(async () => {
  const running = document.getAnimations().filter(a => a.playState === 'running').length;   // includes the band: under reduced motion it must not run
  const a0 = window.__di.flow.angle; const t0 = document.querySelector('[data-strip]').style.transform;
  await new Promise(r => setTimeout(r, 500));
  const still = Math.abs(window.__di.flow.angle - a0) < 0.01 && document.querySelector('[data-strip]').style.transform === t0;
  document.querySelector('#contact').scrollIntoView(); await new Promise(r => setTimeout(r, 500));
  const revealed = [...document.querySelectorAll('#contact .reveal')].every(e => getComputedStyle(e).opacity === '1');
  const stackStill = [...document.querySelectorAll('.stack__card')].every(c => !c.style.transform);
  return { running, still, revealed, stackStill };
});
report('motion (reduced)', r1.running === 0 && r1.still && r1.revealed && r1.stackStill, JSON.stringify(r1));
await pg.close();
pg = await open(b, 1440, 900);
const r2 = await pg.evaluate(async () => {
  // the flow drifts while the strip or the ring is on screen: bring the strip in first
  const s = document.querySelector('.strip'); scrollTo(0, scrollY + s.getBoundingClientRect().top - 120); await new Promise(r => setTimeout(r, 1800));
  const a0 = window.__di.flow.angle; await new Promise(r => setTimeout(r, 800)); const drifts = window.__di.flow.angle - a0 > 1;
  // the stack: from the top, so the first card is stuck under the header when the second arrives
  scrollTo(0, 0); await new Promise(r => setTimeout(r, 200));
  const cards = [...document.querySelectorAll('.stack__card')];
  scrollTo(0, scrollY + cards[1].getBoundingClientRect().top - 200); await new Promise(r => setTimeout(r, 300));
  const stackScales = /scale\(0\.9/.test(cards[0].style.transform);
  const band = document.querySelector('.aurora__band'); const b0 = getComputedStyle(band).transform; await new Promise(r => setTimeout(r, 400)); const bandDrifts = getComputedStyle(band).transform !== b0;
  return { drifts, stackScales, bandDrifts };
});
// the band also returns at the foot of the page and drifts there
await pg.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await pg.waitForTimeout(300);
const footBand = await pg.evaluate(async () => { const el = document.querySelector('.footer .aurora__band'); const t0 = getComputedStyle(el).transform; await new Promise(r => setTimeout(r, 400)); return getComputedStyle(el).transform !== t0; });
report('motion (full)', r2.drifts && r2.stackScales && r2.bandDrifts && footBand, JSON.stringify({ ...r2, footerBandDrifts: footBand }));
await pg.close(); await b.close();
