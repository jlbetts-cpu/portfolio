// Gate: the curtain. On the first load of a session two halves of sky cover the page and part within three seconds,
// leaving nothing behind and a page that scrolls; a second load in the same session shows no curtain at all; under
// reduced motion it never appears. The worst bug this could have is a site stranded behind it, so the timings are
// asserted from the DOM at the centre of the viewport, not from a class name.
// --self-test: pins the curtain visible with CSS and expects the "it parts" check to fail.
import { browser, report } from './_lib.mjs';
import { chromium } from '/tmp/claude-0/-home-user/79ec7a48-7fc9-53b7-8531-63853d88b158/scratchpad/pw/node_modules/playwright/index.mjs';
const URL = process.env.DI_URL || 'http://127.0.0.1:4611/index.html';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const pg = await ctx.newPage();
await pg.addInitScript(() => { try { sessionStorage.setItem('di:nl-shown', '1'); } catch {} });
// the injected bug is the only one that matters: the curtain never leaves. Both of its exits are broken —
// the halves cannot travel and the node cannot be removed — and the gate must notice.
if (selfTest) await pg.addInitScript(() => {
  const rm = Element.prototype.remove;
  Element.prototype.remove = function () { if (this.classList && this.classList.contains('curtain')) return; return rm.call(this); };
  addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.curtain,.curtaining .curtain{display:block !important} .curtain__half{transform:none !important}'; document.head.appendChild(st); });
});
await pg.goto(URL);
// covered at once, before anything has settled. NOT elementsFromPoint: the curtain is pointer-events:none by design,
// and hit testing skips it — this asks the geometry instead.
const covers = () => pg.evaluate(() => {
  const halves = [...document.querySelectorAll('.curtain__half')];
  if (!halves.length) return false;
  return halves.some(h => { const cs = getComputedStyle(h); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = h.getBoundingClientRect(); return r.left <= innerWidth / 2 && r.right >= innerWidth / 2 && r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; });
});
const early = await covers();
const locked = await pg.evaluate(() => getComputedStyle(document.documentElement).overflow === 'hidden');
report('curtain: covers the page on the first load, and the page cannot scroll behind it', early && locked, JSON.stringify({ early, locked }));
await pg.waitForTimeout(3000);
const late = await covers();
const gone = await pg.evaluate(() => !document.querySelector('.curtain') && getComputedStyle(document.documentElement).overflow !== 'hidden');
report('curtain: parts within 3s and leaves nothing behind', !late && gone, JSON.stringify({ stillCovering: late, removed: gone }));
// the same session again: no curtain. It has to be a RELOAD, not a second tab — sessionStorage is per tab.
await pg.reload(); await pg.waitForTimeout(400);
const second = await pg.evaluate(() => ({ curtaining: document.documentElement.classList.contains('curtaining'), stored: !!sessionStorage.getItem('di:curtain') }));
second.covered = await covers();
report('curtain: a second load in the same session shows none', !second.curtaining && !second.covered && second.stored, JSON.stringify(second));
await ctx.close();
// reduced motion: never
const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const pg3 = await ctx2.newPage();
await pg3.goto(URL); await pg3.waitForTimeout(400);
const reduced = await pg3.evaluate(() => document.documentElement.classList.contains('curtaining'));
report('curtain: none under reduced motion', !reduced);
await ctx2.close();
if (selfTest) { console.log(late || !gone ? 'SELF-TEST OK: the stuck curtain was caught' : 'SELF-TEST FAILED: nothing was caught'); process.exitCode = 0; }
await b.close();
