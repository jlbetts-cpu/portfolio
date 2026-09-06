// Gate: under reduced motion nothing drifts (ring, bento), nothing animates after 300ms and reveals still reach opacity 1;
// without it the ring drifts and the bento drifts. The cards lift on hover, which is a transform the gate reads directly.
import { browser, open, report } from './_lib.mjs';
const b = await browser();
let pg = await open(b, 1440, 900, { reduced: true });
await pg.waitForTimeout(300);
const r1 = await pg.evaluate(async () => {
  const running = document.getAnimations().filter(a => a.playState === 'running').length;
  const a0 = window.__di.flow.angle; const t0 = document.querySelector('[data-bento]').style.transform;
  await new Promise(r => setTimeout(r, 500));
  const still = Math.abs(window.__di.flow.angle - a0) < 0.01 && document.querySelector('[data-bento]').style.transform === t0;
  document.querySelector('#contact').scrollIntoView(); await new Promise(r => setTimeout(r, 500));
  const revealed = [...document.querySelectorAll('#contact .reveal')].every(e => getComputedStyle(e).opacity === '1');
  const cardStill = getComputedStyle(document.querySelector('.brief')).transform;
  return { running, still, revealed, cardStill };
});
report('motion (reduced)', r1.running === 0 && r1.still && r1.revealed && (r1.cardStill === 'none' || r1.cardStill === 'matrix(1, 0, 0, 1, 0, 0)'), JSON.stringify(r1));
await pg.close();
pg = await open(b, 1440, 900);
const r2 = await pg.evaluate(async () => {
  // the flow drifts while the bento or the ring is on screen; the bento is in the hero, so start at the top
  scrollTo(0, 0); await new Promise(r => setTimeout(r, 1800));
  const a0 = window.__di.flow.angle; await new Promise(r => setTimeout(r, 800)); const drifts = window.__di.flow.angle - a0 > 1;
  return { drifts };
});
report('motion (full)', r2.drifts, JSON.stringify(r2));
await pg.close(); await b.close();
