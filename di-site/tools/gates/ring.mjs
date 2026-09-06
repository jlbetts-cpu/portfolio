// Gate: the quote ring and the hero's bento. Ring, across a full slot step at three viewports: no photograph pixel under the
// quote's text, no photograph on photograph, every item inside the stage, hover eases the drift to a stop and leaving resumes it,
// scrolling turns it faster than the drift. Bento: every column moves, adjacent columns move in opposite directions, no column
// runs past its own loop length, the pointer stops all of them, and the panel clips columns that overrun it.
// --self-test: sets --ring-r to 90 and expects the photo-on-photo check to fail at 1440×900.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const VP = selfTest ? [[1440, 900]] : [[1440, 900], [1024, 768], [390, 844]];
let allOk = true;
for (const [w, h] of VP) {
  const pg = await open(b, w, h);
  if (selfTest) await pg.evaluate(() => document.documentElement.style.setProperty('--ring-r', '90'));
  await pg.evaluate(() => { const s = document.querySelector('.ring__stage'); scrollTo(0, scrollY + s.getBoundingClientRect().top + s.offsetHeight / 2 - innerHeight / 2); });
  await pg.waitForTimeout(400);
  const res = await pg.evaluate(() => {
    const n = +getComputedStyle(document.documentElement).getPropertyValue('--ring-n') || 8;
    const items = [...document.querySelectorAll('.ring__item')];
    const stage = document.querySelector('.ring__stage').getBoundingClientRect();
    const boxes = [];
    for (const el of [document.querySelector('.ring__text'), document.querySelector('.ring__who')]) { const r = document.createRange(); r.selectNodeContents(el); for (const bx of r.getClientRects()) boxes.push(bx); }
    let copyHits = 0, photoHits = 0, outside = 0;
    for (let a = 0; a < 360 / n; a += 3) {
      window.__di.flow.set(a);
      for (const bx of boxes) for (let y = bx.top + 3; y < bx.bottom; y += 6) for (let x = bx.left + 3; x < bx.right; x += 6) {
        if (document.elementsFromPoint(x, y).some(e => e.classList && e.classList.contains('photo') && e.closest('.ring__item'))) { copyHits++; break; }
      }
      for (const it of items) {
        const ph = it.querySelector('.photo'); const r = ph.getBoundingClientRect();
        if (r.top < stage.top - 1 || r.bottom > stage.bottom + 1) outside++;
        const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, hw = (r.right - r.left) * .3, hh = (r.bottom - r.top) * .3;
        for (let y = cy - hh; y <= cy + hh; y += 6) for (let x = cx - hw; x <= cx + hw; x += 6) {
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
          const top = document.elementsFromPoint(x, y).find(e => e.classList && e.classList.contains('photo') && e.closest('.ring__item'));
          if (top && top !== ph) photoHits++;
        }
      }
    }
    return { copyHits, photoHits, outside };
  });
  const angle = () => pg.evaluate(() => window.__di.flow.angle);
  const a0 = await angle(); await pg.waitForTimeout(500); const a1 = await angle();
  const drifts = a1 - a0 > 0.5;
  await pg.locator('.ring__item .photo').nth(2).hover({ force: true }); await pg.waitForTimeout(1200);
  const held = await pg.evaluate(() => window.__di.flow.held);
  const h0 = await angle(); await pg.waitForTimeout(400); const h1 = await angle();
  const hoverStops = held && Math.abs(h1 - h0) < 0.05;
  await pg.mouse.move(w / 2, 5); await pg.waitForTimeout(900);
  const r0 = await angle(); await pg.waitForTimeout(400); const r1 = await angle();
  const resumes = r1 - r0 > 0.5;
  const s0 = await angle(); await pg.evaluate(() => scrollBy(0, -300)); await pg.waitForTimeout(700); const s1 = await angle();
  const scrollTurns = Math.abs(s1 - s0) > 12;
  // the hero's bento: three columns looping vertically. Each must move, adjacent columns must move in OPPOSITE
  // directions, the loop must wrap (a column never runs past its own length), and the pointer must stop all of them.
  await pg.evaluate(() => scrollTo(0, 0)); await pg.mouse.move(w / 2, 5);
  for (let k = 0; k < 24; k++) { const a = await pg.evaluate(() => window.__di.flow.scrollAngle); await pg.waitForTimeout(300); const b = await pg.evaluate(() => window.__di.flow.scrollAngle); if (Math.abs(b - a) < 0.04) break; }
  const colY = () => pg.evaluate(() => [...document.querySelectorAll('[data-bento]')].map(c => new DOMMatrixReadOnly(getComputedStyle(c).transform).m42));
  const y0 = await colY(); await pg.waitForTimeout(600); const y1 = await colY();
  const deltas = y1.map((v, i) => v - y0[i]);
  const bentoMoves = deltas.every(d => Math.abs(d) > 1);
  const opposed = deltas.length > 1 && deltas[0] * deltas[1] < 0;
  // the loop length: no column may be translated further than its own half, in either direction
  const lengths = await pg.evaluate(() => [...document.querySelectorAll('[data-bento]')].map(c => { const m = c.querySelector('[data-mid]'); return m ? m.offsetTop : 0; }));
  const wrapped = y1.every((v, i) => Math.abs(v) <= lengths[i] + 1);
  const bb = await pg.evaluate(() => { const r = document.querySelector('.hero__bento').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  // the hold eases the drift out over ~0.18s and the angle is still 0.32s behind its target, so the columns coast
  // for about a second after the pointer arrives; sample after that, not during it
  await pg.mouse.move(bb[0], bb[1]); await pg.waitForTimeout(1500);
  const b0 = await colY(); await pg.waitForTimeout(500); const b1 = await colY();
  const bentoStops = b1.every((v, i) => Math.abs(v - b0[i]) < 0.6);
  await pg.mouse.move(w / 2, 5); await pg.waitForTimeout(700);
  // the panel's own edge is the crop now (the soft mask was removed): the panel must clip, and a column must actually
  // overrun it — a column that fits inside the panel would never be cropped and the loop would visibly jump
  const clipped = await pg.evaluate(() => {
    const b = document.querySelector('.hero__bento'); const cs = getComputedStyle(b);
    if (cs.overflow !== 'hidden') return false;
    const br = b.getBoundingClientRect();
    return [...document.querySelectorAll('[data-bento]')].every(c => c.getBoundingClientRect().height > br.height + 40);
  });
  const ok = res.copyHits === 0 && res.photoHits === 0 && res.outside === 0 && drifts && hoverStops && resumes && scrollTurns && bentoMoves && opposed && wrapped && bentoStops && clipped;
  allOk = allOk && ok;
  report(`ring+bento ${w}×${h}`, ok, JSON.stringify({ ...res, drifts, hoverStops, resumes, scrollTurn: +(Math.abs(s1 - s0)).toFixed(1), bentoMoves, opposed, wrapped, bentoStops, clipped, dy: deltas.map(d => +d.toFixed(1)) }));
  await pg.close();
}
await b.close();
if (selfTest) { const caught = !allOk; console.log(caught ? 'SELF-TEST OK: the injected overlap was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
