// Gate: the quote ring, across a full slot step at three viewports — no photograph pixel under the quote's text, no
// photograph on photograph, every item inside the stage, hover eases the drift to a stop and leaving resumes it, and
// scrolling turns it faster than the drift. The hero's bento used to be half this gate; it is gone from the page, so
// its assertions are gone from here rather than left to pass on nothing.
// --self-test: sets --ring-r to 90 and expects the photo-on-photo check to fail at 1440×900.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const VP = selfTest ? [[1440, 900]] : [[1440, 900], [1024, 768], [390, 844], [320, 640]];
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
  // "away" has to be computed, not guessed: at 1024×768 the stage is 770px tall, so the top centre of the viewport —
  // where this used to move the pointer — is another ring photograph, and the flow stays held, correctly. Anything
  // further from the stage's centre than r + item/2 is clear of every item; the stage's corners always are.
  const away = await pg.evaluate(() => {
    const s = document.querySelector('.ring__stage').getBoundingClientRect();
    // the stage is two radii plus one circle tall, so half of it is the reach. Reading --ring-r and --ring-item gave
    // NaN on a phone, where the item is a clamp() and getPropertyValue hands back the unresolved string — every
    // corner then failed the test and the pointer was parked at [4,4] by the fallback, which only passed by luck.
    const reach = s.height / 2;
    const cx = s.left + s.width / 2, cy = s.top + s.height / 2;
    const corners = [[s.left + 4, s.top + 4], [s.right - 4, s.top + 4], [s.left + 4, s.bottom - 4], [s.right - 4, s.bottom - 4]];
    return corners.find(([x, y]) => Math.hypot(x - cx, y - cy) > reach + 8 && x > 0 && y > 0 && x < innerWidth && y < innerHeight) || [4, 4];
  });
  await pg.mouse.move(away[0], away[1]); await pg.waitForTimeout(900);
  const r0 = await angle(); await pg.waitForTimeout(400); const r1 = await angle();
  const resumes = r1 - r0 > 0.5;
  const s0 = await angle(); await pg.evaluate(() => scrollBy(0, -300)); await pg.waitForTimeout(700); const s1 = await angle();
  const scrollTurns = Math.abs(s1 - s0) > 12;
  const ok = res.copyHits === 0 && res.photoHits === 0 && res.outside === 0 && drifts && hoverStops && resumes && scrollTurns;
  allOk = allOk && ok;
  report(`ring ${w}×${h}`, ok, JSON.stringify({ ...res, drifts, hoverStops, resumes, scrollTurn: +(Math.abs(s1 - s0)).toFixed(1) }));
  await pg.close();
}
await b.close();
if (selfTest) { const caught = !allOk; console.log(caught ? 'SELF-TEST OK: the injected overlap was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
