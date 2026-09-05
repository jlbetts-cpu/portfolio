// Gate: under reduced motion nothing drifts (ring, strip, shapes), nothing animates after 300ms and reveals still reach opacity 1;
// without it the ring drifts, the strip drifts, the stack scales the covered card, and the header's ring and the shapes turn with the scroll.
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
  const ring = document.querySelector('.nav .logo__ring'); const shape = document.querySelector('[data-flow]'); const t0 = ring.style.transform, sh0 = shape.style.transform;
  scrollBy(0, 400); await new Promise(r => setTimeout(r, 600));
  const ringTurns = ring.style.transform !== t0; const shapesMove = shape.style.transform !== sh0;
  const cards = [...document.querySelectorAll('.stack__card')];
  cards[1].scrollIntoView(); scrollBy(0, -200); await new Promise(r => setTimeout(r, 300));
  const stackScales = /scale\(0\.9/.test(cards[0].style.transform);
  return { drifts, ringTurns, shapesMove, stackScales };
});
report('motion (full)', r2.drifts && r2.ringTurns && r2.shapesMove && r2.stackScales, JSON.stringify(r2));
await pg.close(); await b.close();
