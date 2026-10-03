// Gate: the theme. The page answers to its own switch and to nothing else.
//   default     with no choice made it follows the visitor's system: dark system → dark page, light → light
//   choice      a choice from the switch beats the system, and survives a reload
//   the host    a host that writes data-theme="dark" onto the page (the claude.ai preview does, for anyone whose
//               claude.ai is dark) changes nothing — that attribute is not ours, and keying the dark tokens on it is
//               what kept the page dark after the toggle was taken away
//   the switch  two options in the footer, aria-pressed on the chosen one, both 44px targets
// --self-test: keys a dark ground on the host's attribute again, which "the host" must catch.
import { browser, report, URL } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const LIGHT = 'rgb(250, 250, 251)', DARK = 'rgb(11, 11, 15)';
const page = async (scheme, stored) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  const pg = await ctx.newPage();
  // the stored choice is seeded on the FIRST load only — an init script runs again on reload, and clearing the choice
  // there would test the seed, not the page's memory
  await pg.addInitScript((t) => { try { sessionStorage.setItem('di:nl-shown', '1'); sessionStorage.setItem('di:curtain', '1'); if (!sessionStorage.getItem('gate:seeded')) { if (t) localStorage.setItem('di:theme', t); else localStorage.removeItem('di:theme'); sessionStorage.setItem('gate:seeded', '1'); } } catch {} }, stored);
  await pg.goto(URL); await pg.waitForTimeout(400);
  return { ctx, pg };
};
const bg = (pg) => pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
let ok = true;
const check = (name, pass, detail) => { if (!selfTest) report(`theme: ${name}`, pass, detail); ok = ok && pass; };

let { ctx, pg } = await page('dark', null);
const d0 = await bg(pg); await ctx.close();
({ ctx, pg } = await page('light', null));
const l0 = await bg(pg); await ctx.close();
check('no choice made → the visitor\'s system', d0 === DARK && l0 === LIGHT, JSON.stringify({ darkSystem: d0, lightSystem: l0 }));

({ ctx, pg } = await page('dark', null));
await pg.evaluate(() => document.querySelector('#contact').scrollIntoView());
const sw = await pg.evaluate(() => [...document.querySelectorAll('#contact [data-theme-set]')].map(b => { const r = b.getBoundingClientRect(); return { t: b.dataset.themeSet, pressed: b.getAttribute('aria-pressed'), h: Math.round(r.height) }; }));
await pg.click('#contact [data-theme-set="light"]'); await pg.waitForTimeout(400);
const afterClick = await bg(pg);
const pressed = await pg.evaluate(() => document.querySelector('#contact [data-theme-set="light"]').getAttribute('aria-pressed'));
await pg.reload(); await pg.waitForTimeout(400);
const afterReload = await bg(pg);
check('the footer switch beats the system and survives a reload', sw.length === 2 && sw.every(x => x.h >= 44) && sw.find(x => x.t === 'dark').pressed === 'true' && afterClick === LIGHT && pressed === 'true' && afterReload === LIGHT, JSON.stringify({ sw, afterClick, pressed, afterReload }));
// the host: the visitor chose light; a dark host marks the page dark
if (selfTest) await pg.addStyleTag({ content: ':root[data-theme="dark"] { --bg: #0B0B0F; }' });   // the bug, back
await pg.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.classList.add('dark'); }); await pg.waitForTimeout(200);
const hosted = await pg.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme }));
check('a host\'s data-theme="dark" changes nothing', hosted.bg === LIGHT && hosted.scheme === 'light', JSON.stringify(hosted));
await ctx.close();
await b.close();
if (selfTest) { const caught = !ok; console.log(caught ? 'SELF-TEST OK: the host-keyed dark ground was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
