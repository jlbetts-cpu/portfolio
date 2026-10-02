// Gate: the page on a phone, emulated as one — touch, no hover, a coarse pointer, 3x pixels — at 320, 360 and 390.
// What a desktop viewport squeezed to 390px cannot show:
//   sticky hover   every :hover rule sits inside @media (hover: hover), read from the live CSSOM, and a photograph
//                  that was tapped open is not left scaled once the lightbox closes
//   no zoom        the email fields are 16px on a coarse pointer, or iOS zooms the page in on focus and stays there
//   no flash       the system tap highlight is off; every control has its own press
//   the ring       all eight circles whole and inside the screen, at every turn of the slot
//   the footer     the closing field is not a panel; the sign-up card runs the column's full width
//   the gallery    a touch does not freeze it (a phone's scroll gestures start on it)
//   scroll lock    the page under an open modal does not scroll, and scrolls again once it closes
// --self-test: adds an ungated :hover rule, which the sticky-hover check must catch.
import { browser, report, URL } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
for (const [w, h] of (selfTest ? [[390, 844]] : [[390, 844], [360, 780], [320, 640]])) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  await pg.addInitScript(() => { try { sessionStorage.setItem('di:nl-shown', '1'); sessionStorage.setItem('di:curtain', '1'); } catch {} });
  await pg.goto(URL); await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  if (selfTest) await pg.addStyleTag({ content: '.btn--primary:hover { background: red; }' });
  await pg.waitForTimeout(500);
  const env = await pg.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, noHover: matchMedia('(hover: none)').matches }));
  // every :hover selector in a style rule that is not inside a (hover: hover) media block. The one exception is the
  // --t timing rule, which changes no appearance and so cannot stick.
  const ungated = await pg.evaluate(() => {
    const out = [];
    const walk = (rules, gated) => { for (const r of rules) {
      if (r.media) walk(r.cssRules, gated || /hover:\s*hover/.test(r.media.mediaText));
      else if (r.cssRules && !r.selectorText) walk(r.cssRules, gated);
      else if (r.selectorText && /:hover/.test(r.selectorText) && !gated && !/^\s*--t:/.test(r.style.cssText)) out.push(r.selectorText.slice(0, 60));
    } };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules, false); } catch {} }
    return out;
  });
  const inputs = await pg.evaluate(() => [...document.querySelectorAll('.input')].map(i => parseFloat(getComputedStyle(i).fontSize)));
  const tapHL = await pg.evaluate(() => getComputedStyle(document.documentElement).webkitTapHighlightColor);
  // tap a section photograph open, close the lightbox, and look at the photograph that opened it
  await pg.evaluate(() => document.querySelector('.tell__figure').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(400);
  await pg.tap('.tell__figure .photo__open'); await pg.waitForTimeout(700);
  const locked = await pg.evaluate(() => getComputedStyle(document.documentElement).overflowY === 'hidden');
  await pg.tap('.lightbox__close'); await pg.waitForTimeout(700);
  const unlocked = await pg.evaluate(() => getComputedStyle(document.documentElement).overflowY !== 'hidden');
  const after = await pg.evaluate(() => getComputedStyle(document.querySelector('.tell__figure .photo img')).transform);
  const notStuck = after === 'none' || new DOMMatrixReadOnly(after).isIdentity;
  // the ring, across one slot of its turn
  const ring = await pg.evaluate(async () => {
    document.querySelector('.ring__stage').scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 300));
    let out = 0;
    for (let a = 0; a < 45; a += 5) { window.__di.flow.set(a); for (const p of document.querySelectorAll('.ring__item .photo')) { const r = p.getBoundingClientRect(); if (r.left < 0 || r.right > innerWidth) out++; } }
    return out;
  });
  const foot = await pg.evaluate(() => {
    const f = getComputedStyle(document.querySelector('.close__field')), col = document.querySelector('#contact .container');
    const pad = parseFloat(getComputedStyle(col).paddingLeft) + parseFloat(getComputedStyle(col).paddingRight);
    return { panel: f.backgroundColor !== 'rgba(0, 0, 0, 0)' || f.boxShadow !== 'none', card: Math.round(document.querySelector('.close__sign').getBoundingClientRect().width), column: Math.round(col.getBoundingClientRect().width - pad) };
  });
  // a touch on the gallery must not hold the flow
  const held = await pg.evaluate(async () => {
    const g = document.querySelector('[data-gallery]'); g.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 200));
    const rc = g.getBoundingClientRect();
    return { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 };
  });
  await pg.touchscreen.tap(held.x, held.y); await pg.waitForTimeout(300);
  const lbOpen = await pg.evaluate(() => document.querySelector('#lightbox').open);
  if (lbOpen) { await pg.tap('.lightbox__close'); await pg.waitForTimeout(500); }
  const keys = await pg.evaluate(() => window.__di.flow.holdKeys.filter(k => k !== 'offscreen'));
  const ok = env.coarse && env.noHover && ungated.length === 0 && inputs.every(f => f >= 16) && /rgba\(0, 0, 0, 0\)|transparent/.test(tapHL) && locked && unlocked && notStuck && ring === 0 && !foot.panel && Math.abs(foot.card - foot.column) <= 1 && keys.length === 0;
  report(`mobile ${w}×${h}`, ok, JSON.stringify({ ...env, ungated, inputs, tapHL, locked, unlocked, notStuck, ringOut: ring, ...foot, holds: keys }));
  await ctx.close();
}
await b.close();
if (selfTest) { const caught = process.exitCode === 1; console.log(caught ? 'SELF-TEST OK: the ungated hover was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
