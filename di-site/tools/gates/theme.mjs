// Gate: the theme. The page answers to its own attribute and to nothing else.
//   LIGHT ONLY  since 2026-10-13 ("should we just do light mode … not dark mode?", then "Light only"). It was dark
//               only for a day before that, and the shape of this gate is the same either way round:
//   the system  a visitor whose system is dark still gets the light page
//   the past    a dark choice stored by an older version of the page changes nothing
//   the host    a host that writes data-theme="dark" onto the page (the claude.ai preview does, for anyone whose
//               claude.ai is dark) changes nothing — that attribute is not ours, and keying the dark tokens on it is
//               what once made dark mode impossible to leave ("I still only see dark mode")
//   no switch   there is none anywhere
// --self-test: keys a dark ground on the host's attribute, which the check must catch.
import { browser, report, URL } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const LIGHT = 'rgb(255, 255, 255)';   // the light ground: Apple's page white since 2026-10-13 (it was #FAFAFB)
const page = async (scheme, stored) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  const pg = await ctx.newPage();
  // the stored choice is seeded on the FIRST load only — an init script runs again on reload, and clearing the choice
  // there would test the seed, not the page's memory
  await pg.addInitScript((t) => { try { sessionStorage.setItem('di:curtain', '1'); if (!sessionStorage.getItem('gate:seeded')) { if (t) localStorage.setItem('di:mode', t); else localStorage.removeItem('di:mode'); sessionStorage.setItem('gate:seeded', '1'); } } catch {} }, stored);
  await pg.goto(URL); await pg.waitForTimeout(400);
  return { ctx, pg };
};
const bg = (pg) => pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
let ok = true;
const check = (name, pass, detail) => { if (!selfTest) report(`theme: ${name}`, pass, detail); ok = ok && pass; };

// light for everyone: a dark system, a dark choice stored by an older version, and a host writing data-theme="dark"
// all leave the page light — and there is no switch anywhere to change it
const results = [];
for (const [scheme, stored] of [['dark', null], ['light', null], ['dark', 'dark']]) {
  const { ctx, pg } = await page(scheme, stored);
  await pg.evaluate(() => { localStorage.setItem('di:theme', 'dark'); localStorage.setItem('di:mode', 'dark'); });
  await pg.reload(); await pg.waitForTimeout(300);
  if (selfTest) await pg.addStyleTag({ content: ':root[data-theme="dark"] { --bg: #0B0B0F; }' });   // the bug, back
  await pg.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await pg.waitForTimeout(150);
  results.push(await pg.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme, switches: document.querySelectorAll('[data-theme-set], [data-theme-toggle], .switch').length })));
  await ctx.close();
}
check('light for everyone, whatever the system, an old stored choice or the host says; no switch', results.every(r => r.bg === LIGHT && r.scheme === 'light' && r.switches === 0), JSON.stringify(results));
await b.close();
if (selfTest) { const caught = !ok; console.log(caught ? 'SELF-TEST OK: the host-keyed dark ground was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
