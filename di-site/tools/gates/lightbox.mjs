// Gate: every photograph opens in the lightbox. A click on a strip card opens that photograph; a drag does not; the arrows and
// the keys move through the set; Esc closes and focus returns to the card; the scrim closes it; the image served is ≥ 960px wide.
// Since 2026-10-14 the viewer is Apple Photos' ("it should be like apples photos where you can see the previews"), so it
// also holds: a row of previews, one per photograph and each at least 44px; the one showing is opened out to its own
// shape and held at the centre (within 2px); a preview opens its photograph; a burst of key presses never leaves two
// photographs stacked; the stage is solid. On a phone: the photograph runs the screen's width, the arrows give way to the
// swipe, a finger thrown sideways goes to the next photograph without closing the viewer, and a short one springs back.
// --self-test: "stacked" keeps every old photograph, "adrift" stops the row from following; each must fail.
import { browser, open, report, URL } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const viewer = async (bug) => {
  const pg = await open(b, 1440, 900);
  if (bug === 'stacked') await pg.evaluate(() => { HTMLPictureElement.prototype.remove = function () {}; });
  if (bug === 'adrift') await pg.evaluate(() => { const r = document.querySelector('.lightbox__rail'); r.scrollTo = () => {}; });
  await pg.evaluate(() => document.querySelector('.tell__figure .photo').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(700);
  const c = await pg.evaluate(() => { const r = document.querySelector('.tell__figure .photo__open').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(1300);
  const read = () => pg.evaluate(() => {
    const thumbs = [...document.querySelectorAll('.lightbox__thumb')], cur = thumbs.filter(t => t.hasAttribute('aria-current'));
    const big = document.querySelector('.lightbox__figure picture.is-current img'), name = (big.currentSrc || big.src).split('/').pop().replace(/-\d+\.\w+$/, '');
    const r = cur[0] && cur[0].getBoundingClientRect(), d = JSON.parse(document.querySelector('#lbData').textContent)[name];
    return {
      count: thumbs.length, photos: new Set([...document.querySelectorAll('[data-photo]')].map(b => b.dataset.photo)).size,
      small: thumbs.filter(t => { const q = t.getBoundingClientRect(); return q.width < 44 || q.height < 44; }).length,
      current: cur.length, same: !!(cur[0] && cur[0].querySelector('img').src.includes(name + '-160')),
      shape: r ? Math.abs(r.width - Math.max(44, Math.round(55 * d.w / d.h))) : 99, centre: r ? Math.abs(r.left + r.width / 2 - innerWidth / 2) : 99,
      pictures: document.querySelectorAll('.lightbox__figure picture').length,
      solid: getComputedStyle(document.querySelector('#lightbox'), '::backdrop').backgroundColor,
      arrows: getComputedStyle(document.querySelector('.lightbox__next')).display !== 'none',
    };
  });
  const s0 = await read();
  for (let i = 0; i < 5; i++) { await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(40); }
  await pg.waitForTimeout(1000);
  const s1 = await read();
  const t = await pg.evaluate(() => { const r = document.querySelectorAll('.lightbox__thumb')[12].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await pg.mouse.click(t[0], t[1]); await pg.waitForTimeout(1000);
  const s2 = await read();
  const picked = await pg.evaluate(() => document.querySelectorAll('.lightbox__thumb')[12].hasAttribute('aria-current'));
  await pg.close();
  const r = {
    row: s0.count === s0.photos && s0.small === 0,
    one: [s0, s1, s2].every(s => s.current === 1 && s.same),
    shape: [s0, s1, s2].every(s => s.shape <= 1),
    centred: [s0, s1, s2].every(s => s.centre <= 2),
    picks: picked,
    unstacked: [s0, s1, s2].every(s => s.pictures === 1),
    solid: /^rgb\(/.test(s0.solid) || /, 1\)$/.test(s0.solid),
    arrows: s0.arrows,
  };
  const ok = Object.values(r).every(Boolean);
  report(`lightbox: the viewer is Photos' 1440${bug ? ' [' + bug + ']' : ''}`, ok, JSON.stringify({ ...r, centreOff: [s0, s1, s2].map(s => +s.centre.toFixed(1)), pictures: [s0, s1, s2].map(s => s.pictures) }));
  return ok;
};
if (selfTest) {
  const caught = !(await viewer('stacked')) && !(await viewer('adrift'));
  console.log(caught ? 'SELF-TEST OK: the stacked photographs and the drifting row were each caught' : 'SELF-TEST FAILED: gate cannot fail');
  await b.close(); process.exit(caught ? 0 : 1);
}
await viewer();
// on a phone, with a finger through the browser's own touch input
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const tp = await ctx.newPage();
  await tp.addInitScript(() => { try { sessionStorage.setItem('di:curtain', '1'); } catch {} });
  await tp.goto(URL); await tp.waitForTimeout(700);
  await tp.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.tell__figure .photo').scrollIntoView({ block: 'center' }); }); await tp.waitForTimeout(700);
  const c = await tp.evaluate(() => { const r = document.querySelector('.tell__figure .photo__open').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await tp.touchscreen.tap(c[0], c[1]); await tp.waitForTimeout(1300);
  const cdp = await ctx.newCDPSession(tp);
  const name = () => tp.evaluate(() => { const i = document.querySelector('.lightbox__figure picture.is-current img'); return (i.currentSrc || i.src).split('/').pop().replace(/-\d+\.\w+$/, ''); });
  const swipe = async (dx, steps, gap) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 420 }] });
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195 + dx * i / steps, y: 420 }] }); await tp.waitForTimeout(gap); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await tp.waitForTimeout(900);
  };
  const m0 = await tp.evaluate(() => ({ w: Math.round(document.querySelector('.lightbox__figure picture.is-current img').getBoundingClientRect().width), vw: innerWidth, arrows: getComputedStyle(document.querySelector('.lightbox__next')).display }));
  const n0 = await name(); await swipe(-40, 8, 40); const n1 = await name();
  const back = await tp.evaluate(() => getComputedStyle(document.querySelector('.lightbox__figure picture.is-current')).transform);
  await swipe(-160, 8, 12); const n2 = await name();
  const still = await tp.evaluate(() => document.querySelector('#lightbox').open);
  await ctx.close();
  const r = { fullWidth: m0.w === m0.vw, noArrows: m0.arrows === 'none', springsBack: n1 === n0 && (back === 'none' || back === 'matrix(1, 0, 0, 1, 0, 0)'), swipes: n2 !== n0, staysOpen: still };
  report('lightbox: the viewer on a phone', Object.values(r).every(Boolean), JSON.stringify({ ...r, names: [n0, n1, n2] }));
}
const pg = await open(b, 1440, 900);
const count = await pg.evaluate(() => document.querySelectorAll('[data-photo]').length);
const names = await pg.evaluate(() => new Set([...document.querySelectorAll('[data-photo]')].map(b => b.dataset.photo)).size);
// a section photograph: it does not move, so it is simply scrolled to and clicked
await pg.evaluate(() => document.querySelector('.tell__figure .photo').scrollIntoView({ block: 'center' }));
await pg.waitForTimeout(700);
const pick = await pg.evaluate(() => {
  const el = document.querySelector('.tell__figure .photo__open');
  const r = el.getBoundingClientRect();
  return { name: el.dataset.photo, x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
const firstName = pick.name;
await pg.mouse.click(pick.x, pick.y); await pg.waitForTimeout(500);
await pg.evaluate(() => { const img = document.querySelector('#lightbox img'); return img && !img.complete ? new Promise(r => { img.onload = img.onerror = r; }) : null; });
const s1 = await pg.evaluate(() => { const d = document.querySelector('#lightbox'); const img = d.querySelector('img'); return { open: d.open, modal: d.matches(':modal'), src: (img && img.currentSrc) || '', natural: img ? img.naturalWidth : 0, focus: (document.activeElement && document.activeElement.className) || '' }; });
report('lightbox: a click opens the photograph, modal, focus on close', s1.open && s1.modal && s1.src.includes(firstName) && s1.focus.includes('lightbox__close'), JSON.stringify({ src: s1.src.split('/').pop(), natural: s1.natural, focus: s1.focus }));
report('lightbox: serves the large file', s1.natural >= 960, `${s1.natural}px`);
await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(500);
const s2 = await pg.evaluate(() => document.querySelector('#lightbox img').currentSrc.split('/').pop());
await pg.click('.lightbox__prev'); await pg.waitForTimeout(500);
const s3 = await pg.evaluate(() => document.querySelector('#lightbox img').currentSrc.split('/').pop());
report('lightbox: the key advances, the arrow goes back', !s2.includes(firstName) && s3.includes(firstName), `${s2} → ${s3}`);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
const s4 = await pg.evaluate(() => ({ open: document.querySelector('#lightbox').open, focus: document.activeElement && document.activeElement.dataset.photo }));
report('lightbox: Esc closes and focus returns to the photograph', !s4.open && s4.focus === firstName, JSON.stringify(s4));
// the scrim closes; a ring photograph opens too
await pg.evaluate(() => { const s = document.querySelector('.ring__stage'); scrollTo(0, scrollY + s.getBoundingClientRect().top + s.offsetHeight / 2 - innerHeight / 2); }); await pg.waitForTimeout(500);
const rb = await pg.locator('.ring__item .photo__open').nth(1).boundingBox(); await pg.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2); await pg.waitForTimeout(900);
const rb2 = await pg.locator('.ring__item .photo__open').nth(1).boundingBox(); await pg.mouse.click(rb2.x + rb2.width / 2, rb2.y + rb2.height / 2); await pg.waitForTimeout(600);
const ringOpen = await pg.evaluate(() => document.querySelector('#lightbox').open);
// the photograph opens out of its frame over half a second (since 2026-10-14) and a click during that is dropped, so
// the scrim is clicked once it has opened
await pg.waitForTimeout(600);
await pg.mouse.click(20, 120); await pg.waitForTimeout(600);   // the scrim, clear of the arrows
const scrimClosed = await pg.evaluate(() => !document.querySelector('#lightbox').open);
report('lightbox: a ring photograph opens; the scrim closes', ringOpen && scrimClosed, `${count} buttons over ${names} photographs`);
await pg.close(); await b.close();
