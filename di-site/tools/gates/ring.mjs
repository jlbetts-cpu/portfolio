// Gate: the quote ring and the hero strip. Ring, across a full slot step at three viewports: no photograph pixel under the
// quote's text, no photograph on photograph, every item inside the stage, hover eases the drift to a stop and leaving resumes it,
// scrolling turns it faster than the drift. Strip: it drifts, the arrows step exactly one card, dragging moves it.
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
  // the strip
  // back to the top; the scroll coupling settles in five time constants (1.6s) before the drift is measured
  await pg.evaluate(() => scrollTo(0, 0)); await pg.mouse.move(w / 2, 5);
  await pg.waitForFunction(() => Math.abs(window.__di.flow.scrollAngle) < 0.05, null, { timeout: 8000 }); await pg.waitForTimeout(200);
  const trackX = () => pg.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('[data-strip]')).transform).m41);
  const pitch = await pg.evaluate(() => { const c = document.querySelectorAll('.strip__card'); return c[1].getBoundingClientRect().left - c[0].getBoundingClientRect().left; });
  const x0 = await trackX(); await pg.waitForTimeout(500); const x1 = await trackX();
  const stripDrifts = x0 - x1 > 3;
  await pg.mouse.move(w / 2, 5);
  const stepBefore = await pg.evaluate(() => window.__di.flow.angle);
  const t0 = await trackX(); await pg.click('[data-strip-next]'); await pg.waitForTimeout(900); const t1 = await trackX();
  const stepAfter = await pg.evaluate(() => window.__di.flow.angle);
  const driftPx = (stepAfter - stepBefore) * 6;
  const stepped = Math.abs((t0 - t1) - driftPx - pitch) < 3;
  const ok = res.copyHits === 0 && res.photoHits === 0 && res.outside === 0 && drifts && hoverStops && resumes && scrollTurns && stripDrifts && stepped;
  allOk = allOk && ok;
  report(`ring+strip ${w}×${h}`, ok, JSON.stringify({ ...res, drifts, hoverStops, resumes, scrollTurn: +(Math.abs(s1 - s0)).toFixed(1), stripDrifts, stepPx: +(t0 - t1 - driftPx).toFixed(1), pitch: +pitch.toFixed(1) }));
  await pg.close();
}
await b.close();
if (selfTest) { const caught = !allOk; console.log(caught ? 'SELF-TEST OK: the injected overlap was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
