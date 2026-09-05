// Gate: the arch. Across a full slot step at six viewports: no card pixel under copy, no card on card,
// no photograph visible twice, top card ≥ 88px from the top, cards clear the nav, hover pauses.
// --self-test: sets --cw to .5 and expects the card-on-card check to fail at 1440×900.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const VP = selfTest ? [[1440, 900]] : [[1440, 900], [1512, 850], [1280, 720], [1024, 768], [1920, 1080], [390, 844]];
let allOk = true;
for (const [w, h] of VP) {
  const pg = await open(b, w, h);
  await pg.evaluate(() => { document.querySelectorAll('.orbit__item, .logo__ring').forEach(el => { el.style.animationPlayState = 'paused'; }); });
  if (selfTest) await pg.evaluate(() => document.querySelector('.hero').style.setProperty('--cw', 'calc(var(--r) * .5)'));
  const res = await pg.evaluate(() => {
    const hero = document.querySelector('.hero');
    const n = +getComputedStyle(hero).getPropertyValue('--n');
    const dur = 96000; // ms, matches --dur-orbit
    const items = [...document.querySelectorAll('.orbit__item')];
    const boxes = [];
    for (const el of [document.querySelector('.hero__title'), document.querySelector('.hero__sub')]) { const r = document.createRange(); const tn = [...el.childNodes].find(n => n.nodeType === 3); r.selectNodeContents(tn); for (const bx of r.getClientRects()) boxes.push(bx); }
    for (const el of [document.querySelector('.logo'), ...document.querySelectorAll('.hero__actions .btn')]) boxes.push(el.getBoundingClientRect());
    const navBox = document.querySelector('.nav').getBoundingClientRect();
    const vis = it => getComputedStyle(it).opacity > 0.01;
    let copyHits = 0, cardHits = 0, repeats = 0, topMin = 1e9, navHits = 0;
    const step = 360 / n;
    for (let a = 0; a < step; a += 1) {
      const t = (a / 360) * dur;
      items.forEach((it, i) => { for (const an of it.getAnimations()) an.currentTime = t; });
      const seen = new Set();
      for (const bx of boxes) for (let y = bx.top + 3; y < bx.bottom; y += 6) for (let x = bx.left + 3; x < bx.right; x += 6) {
        for (const e of document.elementsFromPoint(x, y)) { if (e.classList && e.classList.contains('orbit__card') && vis(e.parentElement)) { copyHits++; break; } }
      }
      for (const it of items) {
        if (!vis(it)) continue;
        const c = it.querySelector('.orbit__card'); const r = c.getBoundingClientRect();
        if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) continue;
        topMin = Math.min(topMin, r.top);
        if (r.top < navBox.bottom && r.bottom > navBox.top && r.right > navBox.left && r.left < navBox.right && r.top < navBox.bottom) navHits += (r.top < navBox.bottom) ? 1 : 0;
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
  // hover pauses
  const card = pg.locator('.orbit__card').first();
  await pg.evaluate(() => { document.querySelectorAll('.orbit__item, .logo__ring').forEach(el => { el.style.animationPlayState = ''; }); });
  await card.hover({ force: true });
  const paused = await pg.evaluate(() => [...document.querySelectorAll('.orbit__item')].every(it => getComputedStyle(it).animationPlayState.split(',')[0].trim() === 'paused'));
  await pg.mouse.move(5, 5);
  const resumed = await pg.evaluate(() => [...document.querySelectorAll('.orbit__item')].every(it => getComputedStyle(it).animationPlayState.split(',')[0].trim() === 'running'));
  const ok = res.copyHits === 0 && res.cardHits === 0 && res.repeats === 0 && res.topMin >= 88 && res.navHits === 0 && paused && resumed;
  allOk = allOk && ok;
  report(`orbit ${w}×${h}`, ok, JSON.stringify({ ...res, hoverPauses: paused, resumes: resumed }));
  await pg.close();
}
await b.close();
if (selfTest) { const caught = !allOk; console.log(caught ? 'SELF-TEST OK: the injected overlap was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
