// Gate: the quote ring and the hero's bento. Ring, across a full slot step at three viewports: no photograph pixel under the
// quote's text, no photograph on photograph, every item inside the stage, hover eases the drift to a stop and leaving resumes it,
// scrolling turns it faster than the drift. Bento: every column moves, adjacent columns move in opposite directions, no column
// runs past its own loop length, the pointer stops THE COLUMN IT IS OVER while the others carry on (and the wheel
// scrubs that one by hand), and the panel clips columns that overrun it.
// The ring is also the testimonials: exactly one voice is on, the photograph it belongs to is the one marked active
// AND the one standing at the top of the circle, hovering another photograph hands it the centre, turning the ring
// advances it on its own, and the centre block never leaves the clear circle inside the necklace.
// --self-test: sets --ring-r to 90 and expects the photo-on-photo check to fail at 1440×900.
// --self-test-voices: takes the active mark off every photograph, which the speaker checks must catch.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const selfTestVoices = process.argv.includes('--self-test-voices');
const b = await browser();
const VP = (selfTest || selfTestVoices) ? [[1440, 900]] : [[1440, 900], [1024, 768], [390, 844]];
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
    const cs = getComputedStyle(document.documentElement);
    const reach = parseFloat(cs.getPropertyValue('--ring-r')) + parseFloat(cs.getPropertyValue('--ring-item')) / 2;
    const cx = s.left + s.width / 2, cy = s.top + s.height / 2;
    const corners = [[s.left + 4, s.top + 4], [s.right - 4, s.top + 4], [s.left + 4, s.bottom - 4], [s.right - 4, s.bottom - 4]];
    return corners.find(([x, y]) => Math.hypot(x - cx, y - cy) > reach + 8 && x > 0 && y > 0 && x < innerWidth && y < innerHeight) || [4, 4];
  });
  await pg.mouse.move(away[0], away[1]); await pg.waitForTimeout(900);
  const r0 = await angle(); await pg.waitForTimeout(400); const r1 = await angle();
  const resumes = r1 - r0 > 0.5;
  const s0 = await angle(); await pg.evaluate(() => scrollBy(0, -300)); await pg.waitForTimeout(700); const s1 = await angle();
  const scrollTurns = Math.abs(s1 - s0) > 12;
  // the hero's bento: three columns looping vertically. Each must move, adjacent columns must move in OPPOSITE
  // directions, the loop must wrap (a column never runs past its own length), and the pointer must stop all of them.
  await pg.evaluate(() => scrollTo(0, 0)); await pg.mouse.move(4, 4);
  for (let k = 0; k < 24; k++) { const a = await pg.evaluate(() => window.__di.flow.scrollAngle); await pg.waitForTimeout(300); const b = await pg.evaluate(() => window.__di.flow.scrollAngle); if (Math.abs(b - a) < 0.04) break; }
  const colY = () => pg.evaluate(() => [...document.querySelectorAll('[data-bento]')].map(c => new DOMMatrixReadOnly(getComputedStyle(c).transform).m42));
  const y0 = await colY(); await pg.waitForTimeout(600); const y1 = await colY();
  const deltas = y1.map((v, i) => v - y0[i]);
  const bentoMoves = deltas.every(d => Math.abs(d) > 1);
  const opposed = deltas.length > 1 && deltas[0] * deltas[1] < 0;
  // the loop length: no column may be translated further than its own half, in either direction
  const lengths = await pg.evaluate(() => [...document.querySelectorAll('[data-bento]')].map(c => { const m = c.querySelector('[data-mid]'); return m ? m.offsetTop : 0; }));
  const wrapped = y1.every((v, i) => Math.abs(v) <= lengths[i] + 1);
  // park the pointer in the middle of the FIRST column: that one must stop dead and the others must keep going.
  // The hold is instant now (the column freezes at the angle it was on), so there is no coast to wait out.
  // the column's own rect is NOT the place to aim: a column is four times the panel's height and is translated
  // upward, so its top edge sits above the viewport and `top + 60` lands on the fixed header. Take x from the
  // column and y from the PANEL — the only band where the two actually overlap.
  const c0 = await pg.evaluate(() => {
    const r = document.querySelectorAll('[data-bento]')[0].getBoundingClientRect();
    const p = document.querySelector('.hero__bento').getBoundingClientRect();
    return [r.x + r.width / 2, p.y + p.height / 2];
  });
  await pg.mouse.move(c0[0], c0[1]); await pg.waitForTimeout(400);
  const onCol = await pg.evaluate(([x, y]) => !!(document.elementFromPoint(x, y) || {}).closest?.('[data-bento]'), c0);
  const b0 = await colY(); await pg.waitForTimeout(600); const b1 = await colY();
  const hoveredStops = onCol && Math.abs(b1[0] - b0[0]) < 0.6;
  const othersCarryOn = b1.slice(1).some((v, i) => Math.abs(v - b0[i + 1]) > 1);
  // and the wheel scrubs the held column by hand. 120px of wheel must move it far past what the drift could have
  // done in the same 250ms (~5px) — otherwise this passes on a column that never held at all.
  const w0 = (await colY())[0];
  await pg.mouse.wheel(0, 120); await pg.waitForTimeout(250);
  const scrubs = Math.abs((await colY())[0] - w0) > 60;
  const bentoStops = hoveredStops && othersCarryOn && scrubs;
  await pg.mouse.move(4, 4); await pg.waitForTimeout(700);
  // the panel's own edge is the crop now (the soft mask was removed): the panel must clip, and a column must actually
  // overrun it — a column that fits inside the panel would never be cropped and the loop would visibly jump
  const clipped = await pg.evaluate(() => {
    const b = document.querySelector('.hero__bento'); const cs = getComputedStyle(b);
    if (cs.overflow !== 'hidden') return false;
    const br = b.getBoundingClientRect();
    return [...document.querySelectorAll('[data-bento]')].every(c => c.getBoundingClientRect().height > br.height + 40);
  });
  // ---- the ring IS the testimonials ----
  await pg.evaluate(() => { const s = document.querySelector('.ring__stage'); scrollTo(0, scrollY + s.getBoundingClientRect().top + s.offsetHeight / 2 - innerHeight / 2); });
  await pg.mouse.move(4, 4); await pg.waitForTimeout(1000);
  if (selfTestVoices) await pg.evaluate(() => document.querySelectorAll('.ring__item').forEach(e => e.classList.remove('is-active')));
  const voice = () => pg.evaluate(() => {
    const on = [...document.querySelectorAll('.ring__quote.is-on')].map(e => +e.dataset.i);
    const act = [...document.querySelectorAll('.ring__item.is-active')].map(e => +e.dataset.i);
    // which photograph is actually highest on the circle right now
    const st = document.querySelector('.ring__stage').getBoundingClientRect();
    const cy = st.top + st.height / 2;
    let top = -1, best = Infinity;
    for (const it of document.querySelectorAll('.ring__item')) { const r = it.getBoundingClientRect(); const y = r.top + r.height / 2 - cy; if (y < best) { best = y; top = +it.dataset.i; } }
    // and the centre must stay inside the clear circle the necklace leaves
    const cs = getComputedStyle(document.documentElement);
    const safe = parseFloat(cs.getPropertyValue('--ring-r')) - parseFloat(cs.getPropertyValue('--ring-item')) / 2;
    const cx = st.left + st.width / 2;
    let worst = 0;
    for (const e of document.querySelectorAll('.ring__quote.is-on *')) { const r = e.getBoundingClientRect(); if (!r.width) continue;
      for (const [x, y] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]]) worst = Math.max(worst, Math.hypot(x - cx, y - cy)); }
    // below 768 the voice sits UNDER the necklace, so there is no circle for it to stay inside — the check applies
    // exactly where the centre is actually a centre
    const centred = getComputedStyle(document.querySelector('.ring__centre')).position === 'absolute';
    return { on, act, top, inside: !centred || worst <= safe, centred, worst: Math.round(worst), safe: Math.round(safe) };
  });
  const v0 = await voice();
  const onePlace = v0.on.length === 1 && v0.act.length === 1 && v0.on[0] === v0.act[0] && v0.act[0] === v0.top;
  // hovering another photograph hands it the centre
  const other = (v0.top + 3) % 8;
  const pt = await pg.evaluate((i) => { const r = document.querySelector(`.ring__item[data-i="${i}"]`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, other);
  await pg.mouse.move(pt[0], pt[1]); await pg.waitForTimeout(500);
  const vh = await voice();
  const hoverSpeaks = vh.on[0] === other && vh.act[0] === other;
  await pg.mouse.move(4, 4); await pg.waitForTimeout(400);
  // and it advances on its own as the ring turns
  const before = (await voice()).on[0];
  await pg.evaluate(() => window.__di.flow.set(window.__di.flow.angle + 135));
  await pg.waitForTimeout(600);
  const after = await voice();
  const turnsSpeaker = after.on[0] !== before && after.on[0] === after.act[0] && after.act[0] === after.top;
  const voicesOk = onePlace && hoverSpeaks && turnsSpeaker && v0.inside;
  const ok = res.copyHits === 0 && res.photoHits === 0 && res.outside === 0 && drifts && hoverStops && resumes && scrollTurns && bentoMoves && opposed && wrapped && bentoStops && clipped && voicesOk;
  allOk = allOk && ok;
  report(`ring+bento ${w}×${h}`, ok, JSON.stringify({ ...res, drifts, hoverStops, resumes, scrollTurn: +(Math.abs(s1 - s0)).toFixed(1), bentoMoves, opposed, wrapped, hoveredStops, othersCarryOn, scrubs, clipped, onePlace, hoverSpeaks, turnsSpeaker, centreInside: v0.inside, dy: deltas.map(d => +d.toFixed(1)) }));
  await pg.close();
}
await b.close();
if (selfTest || selfTestVoices) {
  const caught = !allOk;
  console.log(caught ? `SELF-TEST OK: the ${selfTestVoices ? 'unmarked speaker' : 'injected overlap'} was caught` : 'SELF-TEST FAILED: gate cannot fail');
  process.exitCode = caught ? 0 : 1;
}
