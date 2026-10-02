// Gate: the hero mark turns to face the pointer, anywhere on the page. Pointer right of it → it faces right; left →
// left; above → it looks up. It never passes ±30° across or ±20° up and down (past that a flat mark shows its edge),
// it comes back to face the visitor when the pointer leaves the window, and under reduced motion it does not turn.
// The angle is read from the COMPUTED transform of the element that turns, not from the custom property the script
// writes — a property that is set but never applied is exactly the failure a var-only check would wave through.
// --self-test: pins the turning element's transform to none, which "turns" must catch.
import { browser, open, report } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const pg = await open(b, 1440, 900, { theme: 'light' });
if (selfTest) await pg.addStyleTag({ content: '.hero__mark__spin { transform: none !important; }' });
// the turn, recovered from the matrix of rotateX(a)·rotateY(b): m31 = sin(b), and m23/m22 = tan(a)
const angles = () => pg.evaluate(() => {
  const t = getComputedStyle(document.querySelector('.hero__mark__spin')).transform;
  if (!t || t === 'none') return { y: 0, x: 0, none: true };
  const m = new DOMMatrixReadOnly(t);
  const y = Math.asin(Math.max(-1, Math.min(1, m.m31))) * 180 / Math.PI;
  const x = Math.atan2(m.m23, m.m22) * 180 / Math.PI;
  return { y: +y.toFixed(1), x: +x.toFixed(1), none: false };
});
const at = async (px, py) => { await pg.mouse.move(px, py, { steps: 4 }); await pg.waitForTimeout(1100); return angles(); };
const c = await pg.evaluate(() => { const r = document.querySelector('[data-mark]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
const right = await at(1430, c[1]);
const left = await at(10, c[1]);
const up = await at(c[0], 4);
const down = await at(c[0], 896);
const all = [right, left, up, down];
const turns = !right.none && right.y > 15 && left.y < -15;
const looks = up.x > 15 && down.x < -15;
const held = all.every(a => Math.abs(a.y) <= 30.5 && Math.abs(a.x) <= 20.5);
await pg.mouse.move(c[0] + 300, c[1]); await pg.waitForTimeout(600);
await pg.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent('mouseleave')));
await pg.waitForTimeout(1300);
const rest = await angles();
const returns = Math.abs(rest.y) < 1 && Math.abs(rest.x) < 1;
report('mark faces the pointer', turns && looks && held && returns, JSON.stringify({ right, left, up, down, rest, turns, looks, held, returns }));
await pg.close();
if (!selfTest) {
  const rp = await open(b, 1440, 900, { reduced: true });
  await rp.mouse.move(1430, 200, { steps: 4 }); await rp.waitForTimeout(900);
  const t = await rp.evaluate(() => getComputedStyle(document.querySelector('.hero__mark__spin')).transform);
  const still = t === 'none' || new DOMMatrixReadOnly(t).isIdentity;
  report('mark still under reduced motion', still, t);
  await rp.close();
}
await b.close();
if (selfTest) { const caught = process.exitCode === 1; console.log(caught ? 'SELF-TEST OK: the pinned mark was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
