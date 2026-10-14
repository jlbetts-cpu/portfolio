// Gate: the photograph opens out of its frame (2026-10-14, his pick). For a section photograph, a frame in the film
// strip and a circle in the ring, at 1440: clicked by the pointer, the one box the view transition moves starts on the
// frame as it was at that moment (within 1.5px on every edge) and ends on the viewer's image; its corner travels from
// the frame's to the viewer's; only the large image is drawn while it moves (the page's crop is hidden from the first
// frame, so there is never a double image). Esc sends it back the same way, into the frame. Under reduced motion
// nothing moves: it opens and closes as it always did.
// The box is read from the browser's own keyframes for ::view-transition-group(lb-photo), not from the page's code;
// the group is transformed about its centre, so its drawn box is the matrix applied to width and height about it.
// --self-test: takes view transitions away ("gone"), and draws the page's crop under the large image ("double"); each
// must fail.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const results = {};
const watch = (pg) => pg.evaluate(() => {
  window.__vt = []; window.__src = []; window.__dst = [];
  const seen = new WeakSet();
  const o = document.startViewTransition && document.startViewTransition.bind(document);
  // observation only: the rect of whichever image carries the shared name at the moment the transition starts
  if (o) document.startViewTransition = (cb) => { const el = [...document.querySelectorAll('img')].find(i => i.style.viewTransitionName === 'lb-photo'); if (el) { const rec = { r: null, corner: getComputedStyle(el.closest('.photo') || el).borderTopLeftRadius }; window.__src.push(rec); const read = () => { const r = el.getBoundingClientRect(); rec.r = [r.x, r.y, r.width, r.height]; }; read(); requestAnimationFrame(read); }
    // and where it lands: whichever image carries the name once the page has changed, read the same way
    return o(() => { const res = cb(); const to = [...document.querySelectorAll('img')].find(i => i.style.viewTransitionName === 'lb-photo'); if (to) { const rec = { r: null }; window.__dst.push(rec); const read = () => { const r = to.getBoundingClientRect(); rec.r = [r.x, r.y, r.width, r.height]; }; read(); requestAnimationFrame(read); } return res; }); };   // read again in the frame the browser captures it, after the strip's and the ring's own frame has moved them
  const tick = () => {
    for (const a of document.getAnimations()) {
      const pe = a.effect && a.effect.pseudoElement;
      if (pe === '::view-transition-group(lb-photo)' && !seen.has(a)) {
        seen.add(a);
        const css = getComputedStyle(document.documentElement, '::view-transition-old(lb-photo)').opacity, cssNew = getComputedStyle(document.documentElement, '::view-transition-new(lb-photo)').opacity;
        window.__vt.push({ kf: a.effect.getKeyframes().map(k => ({ width: k.width, height: k.height, transform: k.transform, borderRadius: k.borderRadius })), closing: document.documentElement.classList.contains('lb-closing'), oldOp: css, newOp: cssNew });
      }
    }
    requestAnimationFrame(tick);
  };
  tick();
});
const box = (k) => { const [a, , , d, e, f] = (k.transform.match(/-?[\d.e-]+/g) || []).map(Number), w = parseFloat(k.width), h = parseFloat(k.height); return [e + (1 - a) * w / 2, f + (1 - d) * h / 2, w * a, h * d]; };   // matrix(a, b, c, d, e, f), scale and translate only
const near = (p, q, t = 1.5) => p.every((v, i) => Math.abs(v - q[i]) <= t);
const run = async (label, sel, scrollFn, bug, reduced) => {
  const pg = await open(b, 1440, 900, { reduced });
  if (bug === 'gone') await pg.evaluate(() => { delete Document.prototype.startViewTransition; });
  if (bug === 'double') await pg.addStyleTag({ content: ':root::view-transition-old(lb-photo), :root::view-transition-new(lb-photo) { opacity: 1 !important; }' });
  await pg.evaluate(scrollFn); await pg.waitForTimeout(900);
  await watch(pg);
  const c = await pg.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  await pg.mouse.move(c[0], c[1]); await pg.waitForTimeout(500);
  await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(1300);
  const opened = await pg.evaluate(() => { const i = document.querySelector('#lightbox img').getBoundingClientRect(); return { open: document.querySelector('#lightbox').open, big: [i.x, i.y, i.width, i.height], corner: getComputedStyle(document.querySelector('#lightbox img')).borderTopLeftRadius }; });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(1000);
  const st = await pg.evaluate(() => ({ vt: window.__vt, src: window.__src, dst: window.__dst, open: document.querySelector('#lightbox').open }));
  await pg.close();
  const [o, cl] = [st.vt.find(v => v.kf[0].width && !v.closing), st.vt.find(v => v.kf[0].width && v.closing)];
  const radii = st.vt.filter(v => v.kf[0].borderRadius);
  let r;
  if (reduced) r = { still: st.vt.length === 0, opened: opened.open, closed: !st.open };
  else {
    const from = st.src[0] && st.src[0].r, back = st.dst[1] && st.dst[1].r;
    const srcCorner = st.src[0] ? (st.src[0].corner.endsWith('%') ? Math.min(from[2], from[3]) * parseFloat(st.src[0].corner) / 100 : parseFloat(st.src[0].corner)) : NaN;
    r = {
      fromFrame: !!(o && from && near(box(o.kf[0]), from)),
      toViewer: !!(o && near(box(o.kf[o.kf.length - 1]), opened.big)),
      corner: !!(radii[0] && Math.abs(parseFloat(radii[0].kf[0].borderRadius) - srcCorner) < 1 && Math.abs(parseFloat(radii[0].kf[radii[0].kf.length - 1].borderRadius) - parseFloat(opened.corner)) < 1),
      oneImage: !!(o && o.oldOp === '0' && cl && cl.newOp === '0'),
      backToFrame: !!(cl && back && near(box(cl.kf[0]), opened.big) && near(box(cl.kf[cl.kf.length - 1]), back)),
      closed: !st.open,
    };
    if (o) r.start = box(o.kf[0]).map(v => Math.round(v)).join(',');
    if (cl) { r.cStart = box(cl.kf[0]).map(v => Math.round(v)).join(','); r.cEnd = box(cl.kf[cl.kf.length - 1]).map(v => Math.round(v)).join(','); r.big = opened.big.map(v => Math.round(v)).join(','); }
    if (back) r.back = back.map(v => Math.round(v)).join(',');
    if (from) r.frame = from.map(v => Math.round(v)).join(',');
  }
  const ok = Object.entries(r).filter(([k]) => !['start', 'frame', 'cStart', 'cEnd', 'big', 'back'].includes(k)).every(([, v]) => v === true);
  report(`morph: ${label}${bug ? ' [' + bug + ']' : ''}`, ok, JSON.stringify(r));
  return ok;
};
const tell = () => document.querySelector('.tell__figure .photo').scrollIntoView({ block: 'center' });
const reel = () => document.querySelector('.reel').scrollIntoView({ block: 'center' });
const ring = () => { const s = document.querySelector('.ring__stage'); scrollTo(0, scrollY + s.getBoundingClientRect().top + s.offsetHeight / 2 - innerHeight / 2); };
// the strip frame nearest the middle of the screen, so the whole frame is on screen
const reelSel = '.reel__run:not([aria-hidden]) .reel__item:nth-child(6) .photo__open';
if (selfTest) {
  const gone = !(await run('a section photograph', '.tell__figure .photo__open', tell, 'gone'));
  const double = !(await run('a section photograph', '.tell__figure .photo__open', tell, 'double'));
  const caught = gone && double;
  console.log(caught ? 'SELF-TEST OK: the missing transition and the double image were each caught' : 'SELF-TEST FAILED: ' + JSON.stringify({ gone, double }));
  process.exitCode = caught ? 0 : 1;
} else {
  await run('a section photograph', '.tell__figure .photo__open', tell);
  await run('a frame in the strip', reelSel, reel);
  await run('a circle in the ring', '.ring__item:nth-child(2) .photo__open', ring);
  await run('reduced motion: nothing moves', '.tell__figure .photo__open', tell, null, true);
}
await b.close();
