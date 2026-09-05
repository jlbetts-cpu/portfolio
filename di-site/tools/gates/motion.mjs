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
  const a0 = window.__di.flow.angle; await new Promise(r => setTimeout(r, 800)); const drifts = window.__di.flow.angle - a0 > 1;
  const cards = [...document.querySelectorAll('.stack__card')];
  cards[1].scrollIntoView(); scrollBy(0, -200); await new Promise(r => setTimeout(r, 300));
  const stackScales = /scale\(0\.9/.test(cards[0].style.transform);
  const band = document.querySelector('.aurora__band'); const b0 = getComputedStyle(band).transform; await new Promise(r => setTimeout(r, 400)); const bandDrifts = getComputedStyle(band).transform !== b0;
  return { drifts, stackScales, bandDrifts };
});
// the bloom follows how much of the card is on screen: a card 20% in shows none, a card filling the screen shows all of it, the pointer completes it
await pg.mouse.move(5, 5);
await pg.evaluate(() => { const c = document.querySelectorAll('.stack__card')[2]; scrollTo(0, scrollY + c.getBoundingClientRect().top - innerHeight * 0.8); }); await pg.waitForTimeout(500);
const bloomLow = await pg.evaluate(() => parseFloat(getComputedStyle(document.querySelectorAll('.stack__card')[2], '::after').opacity));
await pg.evaluate(() => { const c = document.querySelectorAll('.stack__card')[2]; scrollTo(0, scrollY + c.getBoundingClientRect().top - 120); }); await pg.waitForTimeout(600);
const bloomFull = await pg.evaluate(() => parseFloat(getComputedStyle(document.querySelectorAll('.stack__card')[2], '::after').opacity));
report('motion (full)', r2.drifts && r2.stackScales && r2.bandDrifts && bloomLow < 0.2 && bloomFull > 0.95, JSON.stringify({ ...r2, bloomAt20pct: bloomLow, bloomFilling: bloomFull }));
await pg.close(); await b.close();
