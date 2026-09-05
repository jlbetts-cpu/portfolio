// Gate: under reduced motion nothing drifts (ring, strip, shapes), nothing animates after 300ms and reveals still reach opacity 1;
// without it the ring drifts, the strip drifts, the stack scales the covered card, and a stacked card's bloom rises under the pointer.
import { browser, open, report } from './_lib.mjs';
const b = await browser();
let pg = await open(b, 1440, 900, { reduced: true });
await pg.waitForTimeout(300);
const r1 = await pg.evaluate(async () => {
  const running = document.getAnimations().filter(a => a.playState === 'running').length;
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
  const a0 = window.__di.flow.angle; await new Promise(r => setTimeout(r, 800)); const drifts = window.__di.flow.angle - a0 > 1;
  const cards = [...document.querySelectorAll('.stack__card')];
  cards[1].scrollIntoView(); scrollBy(0, -200); await new Promise(r => setTimeout(r, 300));
  const stackScales = /scale\(0\.9/.test(cards[0].style.transform);
  return { drifts, stackScales };
});
const c = await pg.$('.stack__card:nth-child(2)'); const box = await c.boundingBox();
await pg.mouse.move(box.x + 40, box.y + 40); await pg.waitForTimeout(700);
const bloom = await pg.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.stack__card:nth-child(2)'), '::after').opacity));
await pg.mouse.move(5, 5); await pg.waitForTimeout(700);
const bloomGone = await pg.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.stack__card:nth-child(2)'), '::after').opacity));
report('motion (full)', r2.drifts && r2.stackScales && bloom === 1 && bloomGone === 0, JSON.stringify({ ...r2, bloomOnHover: bloom, bloomAfter: bloomGone }));
await pg.close(); await b.close();
