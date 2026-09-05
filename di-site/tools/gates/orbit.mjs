// Gate: the arch. Across a full slot step at six viewports: no card pixel under copy, no card on card,
// no photograph visible twice, top card ≥ 88px from the top, cards clear the header, hover eases the drift to a stop
// and it resumes, scrolling turns the arch faster than the drift. Drives the flow through the window.__di hook.
// --self-test: sets --cw to .5r and expects the card-on-card check to fail at 1440×900.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const VP = selfTest ? [[1440, 900]] : [[1440, 900], [1512, 850], [1280, 720], [1024, 768], [1920, 1080], [390, 844]];
let allOk = true;
for (const [w, h] of VP) {
  const pg = await open(b, w, h);
  if (selfTest) await pg.evaluate(() => document.querySelector('.hero').style.setProperty('--cw', 'calc(var(--r) * .5)'));
  const res = await pg.evaluate(() => {
    const hero = document.querySelector('.hero');
    const n = +getComputedStyle(hero).getPropertyValue('--n');
    const items = [...document.querySelectorAll('.orbit__item')];
    const boxes = [];
    for (const el of [document.querySelector('.hero__title'), document.querySelector('.hero__sub')]) { const r = document.createRange(); const tn = [...el.childNodes].find(n => n.nodeType === 3); r.selectNodeContents(tn); for (const bx of r.getClientRects()) boxes.push(bx); }
    for (const el of document.querySelectorAll('.hero__actions .btn')) boxes.push(el.getBoundingClientRect());
    const navBox = document.querySelector('.nav').getBoundingClientRect();
    const vis = it => it.style.visibility !== 'hidden' && parseFloat(it.style.opacity || 1) > 0.01;
    let copyHits = 0, cardHits = 0, repeats = 0, topMin = 1e9, navHits = 0;
    const step = 360 / n;
    for (let a = 0; a < step; a += 1) {
      window.__di.flow.set(a);
      const seen = new Set();
      for (const bx of boxes) for (let y = bx.top + 3; y < bx.bottom; y += 6) for (let x = bx.left + 3; x < bx.right; x += 6) {
        for (const e of document.elementsFromPoint(x, y)) { if (e.classList && e.classList.contains('orbit__card') && vis(e.parentElement)) { copyHits++; break; } }
      }
      for (const it of items) {
        if (!vis(it)) continue;
        const c = it.querySelector('.orbit__card'); const r = c.getBoundingClientRect();
        if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) continue;
        topMin = Math.min(topMin, r.top);
        if (r.top < navBox.bottom) navHits++;
        const key = c.querySelector('img').getAttribute('src'); if (seen.has(key)) repeats++; seen.add(key);
        const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, hw = (r.right - r.left) * .3, hh = (r.bottom - r.top) * .3;
        for (let y = cy - hh; y <= cy + hh; y += 8) for (let x = cx - hw; x <= cx + hw; x += 8) {
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
          const top = document.elementsFromPoint(x, y).find(e => e.classList && e.classList.contains('orbit__card') && vis(e.parentElement));
          if (top && top !== c && !c.contains(top)) cardHits++;
        }
      }
    }
    return { copyHits, cardHits, repeats, topMin: Math.round(topMin), navHits };
  });
  // the drift: hover over a photograph eases it to a stop, leaving resumes it
  const angle = () => pg.evaluate(() => window.__di.flow.angle);
  const a0 = await angle(); await pg.waitForTimeout(500); const a1 = await angle();
  const drifts = a1 - a0 > 0.5;
  const card = pg.locator('.orbit__item[style*="visible"] .orbit__card').first();
  await card.hover({ force: true }); await pg.waitForTimeout(1200);
  const held = await pg.evaluate(() => window.__di.flow.held);
  const h0 = await angle(); await pg.waitForTimeout(400); const h1 = await angle();
  const hoverStops = held && Math.abs(h1 - h0) < 0.05;
  await pg.mouse.move(w / 2, 5); await pg.waitForTimeout(900);
  const r0 = await angle(); await pg.waitForTimeout(400); const r1 = await angle();
  const resumes = r1 - r0 > 0.5;
  // scrolling 300px turns it well beyond what the drift alone would in that time
  const s0 = await angle(); await pg.evaluate(() => scrollBy(0, 300)); await pg.waitForTimeout(700); const s1 = await angle();
  const scrollTurns = s1 - s0 > 12;
  const ok = res.copyHits === 0 && res.cardHits === 0 && res.repeats === 0 && res.topMin >= 88 && res.navHits === 0 && drifts && hoverStops && resumes && scrollTurns;
  allOk = allOk && ok;
  report(`orbit ${w}×${h}`, ok, JSON.stringify({ ...res, drifts, hoverStops, resumes, scrollTurn: +(s1 - s0).toFixed(1) }));
  await pg.close();
}
await b.close();
if (selfTest) { const caught = !allOk; console.log(caught ? 'SELF-TEST OK: the injected overlap was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
