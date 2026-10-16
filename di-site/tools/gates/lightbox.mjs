// Gate: every photograph opens in the lightbox. A click on a strip card opens that photograph; a drag does not; the arrows and
// the keys move through the set; Esc closes and focus returns to the card; the scrim closes it; the image served is ≥ 960px wide.
// Since 2026-10-14 the viewer is Apple Photos' ("it should be like apples photos where you can see the previews"), so it
// also holds: a row of previews, one per photograph and each at least 44px; the one showing is opened out to its own
// shape and held at the centre (within 2px); a preview opens its photograph; a burst of key presses never leaves two
// photographs stacked; the stage is solid. On a phone: the photograph runs the screen's width, the arrows give way to the
// swipe, a finger thrown sideways goes to the next photograph without closing the viewer, and a short one springs back;
// held halfway, the next photograph rides in beside the one being dragged, 24px behind its edge, as Photos pages.
// Since 2026-10-16 the phone's paging keeps docs/apple-design.md's rules: a slow drag to 35% that stops goes back and a
// 60px throw goes on (where the throw lands decides, §6), and a touch while a page is settling catches both photographs
// where they are, then settles the nearer one home (§3).
// Also since 2026-10-16: the first tap after a swipe is heard. A swipe on a phone sends no click, so the eater it armed
// for the click it might leave waited, and swallowed the next tap on a preview or the close button. And a sideways
// drag begun while a pull is still springing back follows the finger: the spring held the photograph still under it
// for the whole 120px until it finished.
// --self-test: "stacked" keeps every old photograph, "adrift" stops the row from following, "uncatchable" makes a page
// in flight impossible to stop, "ghost" never empties the frame, "deaf" keeps a tap's touch from reaching the viewer
// (so the eater is never disarmed), "sticky" lets the spring run on under a new touch; each must fail.
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
// on a phone, with a finger through the browser's own touch input
const phone = async (bug) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const tp = await ctx.newPage();
  await tp.addInitScript(() => { try { sessionStorage.setItem('di:curtain', '1'); } catch {} });
  // the bug: a page in flight that a finger cannot catch, which is what "paging" locked out until 2026-10-16
  if (bug === 'uncatchable') await tp.addInitScript(() => { Animation.prototype.cancel = function () {}; });
  // the bug: a frame that is never emptied, so a pulled photograph is seen twice
  // the bug: the viewer never hears a touch on its previews or its close button, which is what left a swipe's eater armed
  if (bug === 'deaf') await tp.addInitScript(() => { addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('.lightbox__rail, .lightbox__close')) e.stopPropagation(); }, true); });
  // the bug: a new touch that does not land what is still settling, so a running spring outranks the finger
  if (bug === 'sticky') await tp.addInitScript(() => { const f = Animation.prototype.finish; Animation.prototype.finish = function () { if (this.effect && this.effect.target && this.effect.target.tagName === 'PICTURE') return; return f.call(this); }; });
  if (bug === 'ghost') await tp.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.photo { visibility: visible !important; }'; document.head.appendChild(st); }); });
  await tp.goto(URL); await tp.waitForTimeout(700);
  await tp.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.tell__figure .photo').scrollIntoView({ block: 'center' }); }); await tp.waitForTimeout(700);
  const c = await tp.evaluate(() => { const r = document.querySelector('.tell__figure .photo__open').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await tp.touchscreen.tap(c[0], c[1]); await tp.waitForTimeout(1300);
  const cdp = await ctx.newCDPSession(tp);
  const T = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y: 420 }] });
  const name = () => tp.evaluate(() => { const i = document.querySelector('.lightbox__figure picture.is-current img'); return (i.currentSrc || i.src).split('/').pop().replace(/-\d+\.\w+$/, ''); });
  const pics = () => tp.evaluate(() => [...document.querySelectorAll('.lightbox__figure picture')].map(p => Math.round(new DOMMatrixReadOnly(getComputedStyle(p).transform).m41)));
  const swipe = async (from, dx, steps, gap, pause = 0) => {
    await T('touchStart', from);
    for (let i = 1; i <= steps; i++) { await T('touchMove', from + dx * i / steps); await tp.waitForTimeout(gap); }
    if (pause) await tp.waitForTimeout(pause);
    await T('touchEnd'); await tp.waitForTimeout(900);
  };
  const m0 = await tp.evaluate(() => ({ w: Math.round(document.querySelector('.lightbox__figure picture.is-current img').getBoundingClientRect().width), vw: innerWidth, arrows: getComputedStyle(document.querySelector('.lightbox__next')).display }));
  // halfway and held: the next photograph rides in beside the one being dragged, 24px behind its edge
  await T('touchStart', 300);
  for (let i = 1; i <= 10; i++) { await T('touchMove', 300 - i * 16); await tp.waitForTimeout(30); }
  await tp.waitForTimeout(150);
  const ride = await tp.evaluate(() => { const ps = [...document.querySelectorAll('.lightbox__figure picture')], cur = ps.find(p => p.classList.contains('is-current')), peek = ps.find(p => p !== cur); if (!cur || !peek) return null; const s = document.querySelector('.lightbox__stage'); return { curL: cur.getBoundingClientRect().left, gap: peek.getBoundingClientRect().left - (cur.getBoundingClientRect().left + s.clientWidth) }; });
  await T('touchEnd'); await tp.waitForTimeout(900);
  const paged = (await pics()).length;
  // where a throw lands decides it (docs/apple-design.md §6): 35% dragged slowly and stopped goes back; 60px thrown goes on
  let n = await name(); await swipe(300, -136, 14, 40, 200); const slow = { n0: n, n1: await name(), xs: await pics() };
  n = await name(); await swipe(300, -60, 5, 10); const flick = { n0: n, n1: await name() };
  // the first tap after a swipe: a preview two along opens its photograph
  const at = () => tp.evaluate(() => [...document.querySelectorAll('.lightbox__thumb')].findIndex(t => t.hasAttribute('aria-current')));
  const i0 = await at(), tb = await tp.evaluate((k) => { const r = document.querySelectorAll('.lightbox__thumb')[k].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, i0 + 2);
  await tp.touchscreen.tap(tb[0], tb[1]); await tp.waitForTimeout(900);
  const tapAfter = { from: i0, to: await at() };
  // a touch while a page is still settling catches it where it is (§3): both hold still under the finger, then the
  // nearer one settles home when it lets go
  await T('touchStart', 330); for (let i = 1; i <= 12; i++) { await T('touchMove', 330 - i * 19.5); await tp.waitForTimeout(30); } await tp.waitForTimeout(120); await T('touchEnd');
  await tp.waitForTimeout(60); await T('touchStart', 200); await tp.waitForTimeout(40);
  const h0 = await pics(); await tp.waitForTimeout(120); const h1 = await pics();
  await T('touchEnd'); await tp.waitForTimeout(900);
  const settled = await pics(), still = await tp.evaluate(() => document.querySelector('#lightbox').open);
  // pull down to close (2026-10-16), as Photos does. A short pull that stops springs back; held halfway, the stage
  // fades and the photograph's own frame on the page is empty, so it is never seen twice; thrown on, it closes and its
  // frame is whole again; an upward drag does nothing
  const frameShown = () => tp.evaluate(() => { const f = [...document.querySelectorAll('.tell__figure .photo')][0]; return getComputedStyle(f).visibility !== 'hidden'; });
  // back to the first photograph, so its frame is the section's, on screen behind
  await tp.evaluate(() => { const d = document.querySelector('#lightbox'); if (d.open) d.close(); }); await tp.waitForTimeout(500);
  await tp.evaluate(() => document.querySelector('.tell__figure').scrollIntoView({ block: 'center' })); await tp.waitForTimeout(400);
  const c2 = await tp.evaluate(() => { const r = document.querySelector('.tell__figure .photo__open').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await tp.touchscreen.tap(c2[0], c2[1]); await tp.waitForTimeout(1300);
  const Ty = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y }] });
  await Ty('touchStart', 195, 380); for (let i = 1; i <= 7; i++) { await Ty('touchMove', 195, 380 + i * 10); await tp.waitForTimeout(30); } await tp.waitForTimeout(150); await Ty('touchEnd'); await tp.waitForTimeout(600);
  const shortPull = await tp.evaluate(() => ({ open: document.querySelector('#lightbox').open, tf: getComputedStyle(document.querySelector('.lightbox__figure picture.is-current')).transform }));
  const shortFrame = await frameShown();
  // the same short pull, and 30ms into its spring a sideways drag of 60px that stops and goes back: it follows the finger
  const cx = () => tp.evaluate(() => Math.round(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.lightbox__figure picture.is-current')).transform).m41));
  await Ty('touchStart', 195, 380); for (let i = 1; i <= 7; i++) { await Ty('touchMove', 195, 380 + i * 10); await tp.waitForTimeout(30); } await tp.waitForTimeout(150); await Ty('touchEnd');
  await tp.waitForTimeout(30); await Ty('touchStart', 300, 420); const follow = [];
  for (let i = 1; i <= 3; i++) { await Ty('touchMove', 300 - i * 20, 420); await tp.waitForTimeout(16); follow.push(await cx()); }
  await tp.waitForTimeout(200); await Ty('touchEnd'); await tp.waitForTimeout(700);
  await Ty('touchStart', 195, 380); for (let i = 1; i <= 10; i++) { await Ty('touchMove', 195 + i * 3, 380 + i * 22); await tp.waitForTimeout(30); } await tp.waitForTimeout(100);
  const midPull = await tp.evaluate(() => ({ k: parseFloat(document.querySelector('#lightbox').style.getPropertyValue('--dismiss')) || 0 }));
  midPull.frameEmpty = !(await frameShown());
  for (let i = 11; i <= 14; i++) { await Ty('touchMove', 195 + i * 3, 380 + i * 22); await tp.waitForTimeout(10); } await Ty('touchEnd'); await tp.waitForTimeout(1200);
  const thrown = { open: await tp.evaluate(() => document.querySelector('#lightbox').open), frame: await frameShown() };
  await tp.touchscreen.tap(c2[0], c2[1]); await tp.waitForTimeout(1300);
  await Ty('touchStart', 195, 500); for (let i = 1; i <= 8; i++) { await Ty('touchMove', 195, 500 - i * 20); await tp.waitForTimeout(16); } await Ty('touchEnd'); await tp.waitForTimeout(800);
  const upward = await tp.evaluate(() => document.querySelector('#lightbox').open);
  await ctx.close();
  const r = {
    rides: !!ride && ride.curL < -100 && Math.abs(ride.gap - 24) <= 2 && paged === 1,
    fullWidth: m0.w === m0.vw, noArrows: m0.arrows === 'none',
    slowGoesBack: slow.n1 === slow.n0 && slow.xs.length === 1 && slow.xs[0] === 0,
    flickGoesOn: flick.n1 !== flick.n0,
    tapAfterSwipe: tapAfter.to === tapAfter.from + 2,
    caught: h0.length === 2 && h0.every((x, i) => Math.abs(x - h1[i]) <= 1) && h0.some(x => Math.abs(x) > 20),
    settles: settled.length === 1 && settled[0] === 0 && still,
    pullSpringsBack: shortPull.open && (shortPull.tf === 'none' || shortPull.tf === 'matrix(1, 0, 0, 1, 0, 0)') && shortFrame,
    swipeAfterPull: follow.every((x, i) => Math.abs(x + (i + 1) * 20) <= 2),
    pullEmptiesFrame: midPull.k > .3 && midPull.frameEmpty,
    pullCloses: !thrown.open && thrown.frame,
    upwardStays: upward,
  };
  const ok = Object.values(r).every(Boolean);
  report(`lightbox: the viewer on a phone${bug ? ' [' + bug + ']' : ''}`, ok, JSON.stringify({ ...r, held: [h0, h1], settled, tapAfter, follow }));
  return ok;
};
if (selfTest) {
  const caught = !(await viewer('stacked')) && !(await viewer('adrift')) && !(await phone('uncatchable')) && !(await phone('ghost')) && !(await phone('deaf')) && !(await phone('sticky'));
  console.log(caught ? 'SELF-TEST OK: the stacked photographs, the drifting row, the page a finger cannot catch, the photograph seen twice, the swallowed tap and the sticky spring were each caught' : 'SELF-TEST FAILED: gate cannot fail');
  await b.close(); process.exit(caught ? 0 : 1);
}
await viewer();
await phone();
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
