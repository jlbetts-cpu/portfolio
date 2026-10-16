// Gate: the reader's own settings (2026-10-16, docs/apple-design.md §14 and §15, WCAG 1.4.11).
//   contrast      with "increase contrast" on, an outlined control's edge and the email field's edge are 3:1 or more
//                 against the ground they sit on (they are 1.28:1 and none by default, which is the look, and stays)
//   transparency  with "reduce transparency" on, the viewer's controls are solid and the dialog's scrim is not blurred
//   text size     with the browser's text at 24px, a phone's page does not scroll sideways ("understanding" in the claim
//                 ran 392px in a 358px column until the display size's floor was held to the screen's width)
// --self-test: puts the quiet ring back under "increase contrast" and the blur back under "reduce transparency", and
// lets the claim's floor grow with the text; each must fail.
import { browser, report, URL } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const fails = {};
const check = (name, ok, detail) => { report(`prefs: ${name}`, ok, detail); if (!ok) fails[name] = true; };
const page = async (opts, css) => {
  const ctx = await b.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, contrast: opts.contrast || 'no-preference' });
  const pg = await ctx.newPage();
  if (opts.transparency) { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] }); }
  await pg.addInitScript((f) => { try { sessionStorage.setItem('di:curtain', '1'); } catch {} if (f) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = f + 'px'; }); }, opts.font || 0);
  await pg.goto(URL); await pg.waitForTimeout(700);
  if (css) await pg.addStyleTag({ content: css });
  return { ctx, pg };
};
const edges = (pg) => pg.evaluate(() => {
  const lum = (c) => { const v = c.map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const ratio = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((p, q) => q - p); return +((x + .05) / (y + .05)).toFixed(2); };
  const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const over = ([r, g, bl, a = 1], gr) => [r, g, bl].map((v, i) => Math.round(v * a + gr[i] * (1 - a)));
  const ring = (el) => { const m = getComputedStyle(el).boxShadow.match(/rgba?\([^)]*\)/); return m ? parse(m[0]) : null; };
  const ground = (el) => { let e = el.parentElement; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length && (c[3] === undefined || c[3] > 0)) return c.slice(0, 3); e = e.parentElement; } return [255, 255, 255]; };
  const edge = (el) => { const r = ring(el), g = ground(el); return r ? ratio(over(r, g), g) : 0; };
  return { button: edge(document.querySelector('.hero__act .btn')), field: edge(document.querySelector('#nl-email')) };
});

// contrast
{
  const { ctx, pg } = await page({ contrast: 'more' }, selfTest ? ':root { --ring: rgba(21,20,29,.12) !important; } .input { box-shadow: none !important; }' : '');
  const e = await edges(pg); await ctx.close();
  check('increase contrast: control edges 3:1 or more', e.button >= 3 && e.field >= 3, JSON.stringify(e));
}
{
  const { ctx, pg } = await page({});
  const e = await edges(pg); await ctx.close();
  check('by default the quiet edges are as they were', Math.abs(e.button - 1.28) < 0.05 && e.field === 0, JSON.stringify(e));
}
// transparency
{
  const { ctx, pg } = await page({ transparency: true }, selfTest ? '.dialog::backdrop { backdrop-filter: blur(16px) !important; } .lightbox .dialog__close { background: rgba(255,255,255,.12) !important; }' : '');
  await pg.evaluate(() => document.querySelector('.hero__act .btn').click()); await pg.waitForTimeout(700);
  const scrim = await pg.evaluate(() => getComputedStyle(document.querySelector('#newsletterDialog'), '::backdrop').backdropFilter);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
  await pg.evaluate(() => document.querySelector('.tell__figure').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(500);
  const c = await pg.evaluate(() => { const r = document.querySelector('.tell__figure .photo__open').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await pg.mouse.click(c[0], c[1]); await pg.waitForTimeout(1300);
  const control = await pg.evaluate(() => getComputedStyle(document.querySelector('.lightbox__close')).backgroundColor);
  await ctx.close();
  const solid = /^rgb\(/.test(control) || /, 1\)$/.test(control);
  check('reduce transparency: solid controls, no blurred scrim', scrim === 'none' && solid, JSON.stringify({ scrim, control }));
}
// text size
{
  const { ctx, pg } = await page({ viewport: { width: 390, height: 844 }, font: 24 }, selfTest ? ':root { --fs-display: clamp(2.5rem, 1rem + 4.2vw, 4.5rem) !important; }' : '');
  const over = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await ctx.close();
  check('text at 24px: a phone does not scroll sideways', over <= 0, `${over}px`);
}
await b.close();
if (selfTest) {
  const caught = fails['increase contrast: control edges 3:1 or more'] && fails['reduce transparency: solid controls, no blurred scrim'] && fails['text at 24px: a phone does not scroll sideways'];
  console.log(caught ? 'SELF-TEST OK: the quiet ring, the blur and the growing claim were each caught' : 'SELF-TEST FAILED: ' + JSON.stringify(fails));
  process.exitCode = caught ? 0 : 1;
}
