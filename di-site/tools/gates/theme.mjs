// Gate: the theme. The page answers to its own switch and to nothing else.
//   default     with no choice made the page is DARK, whatever the visitor's system says (2026-10-12: "keep it in
//               dark mode, it looks better for this specific site")
//   choice      a choice from the switch beats the system, and survives a reload
//   the host    a host that writes data-theme="dark" onto the page (the claude.ai preview does, for anyone whose
//               claude.ai is dark) changes nothing — that attribute is not ours, and keying the dark tokens on it is
//               what kept the page dark after the toggle was taken away
//   the switch  two options in the footer, aria-pressed on the chosen one, both 44px targets
// --self-test: keys a light ground on the host's attribute, which the check must catch.
import { browser, report, URL } from './_lib.mjs';
const selfTest = process.argv.includes('--self-test');
const b = await browser();
const LIGHT = 'rgb(250, 250, 251)', DARK = 'rgb(11, 11, 15)';
const page = async (scheme, stored) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  const pg = await ctx.newPage();
  // the stored choice is seeded on the FIRST load only — an init script runs again on reload, and clearing the choice
  // there would test the seed, not the page's memory
  await pg.addInitScript((t) => { try { sessionStorage.setItem('di:nl-shown', '1'); sessionStorage.setItem('di:curtain', '1'); if (!sessionStorage.getItem('gate:seeded')) { if (t) localStorage.setItem('di:mode', t); else localStorage.removeItem('di:mode'); sessionStorage.setItem('gate:seeded', '1'); } } catch {} }, stored);
  await pg.goto(URL); await pg.waitForTimeout(400);
  return { ctx, pg };
};
const bg = (pg) => pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
let ok = true;
const check = (name, pass, detail) => { if (!selfTest) report(`theme: ${name}`, pass, detail); ok = ok && pass; };

// dark for everyone: a light system, a light choice stored by an older version, and a host writing data-theme="light"
// all leave the page dark — and there is no switch anywhere to change it
const results = [];
for (const [scheme, stored] of [['light', null], ['dark', null], ['light', 'light']]) {
  const { ctx, pg } = await page(scheme, stored);
  await pg.evaluate(() => { localStorage.setItem('di:theme', 'light'); localStorage.setItem('di:mode', 'light'); });
  await pg.reload(); await pg.waitForTimeout(300);
  if (selfTest) await pg.addStyleTag({ content: ':root[data-theme="light"] { --bg: #FAFAFB; }' });   // the bug, back
  await pg.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); await pg.waitForTimeout(150);
  results.push(await pg.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme, switches: document.querySelectorAll('[data-theme-set], [data-theme-toggle], .switch').length })));
  await ctx.close();
}
check('dark for everyone, whatever the system, an old stored choice or the host says; no switch', results.every(r => r.bg === DARK && r.scheme === 'dark' && r.switches === 0), JSON.stringify(results));
await b.close();
if (selfTest) { const caught = !ok; console.log(caught ? 'SELF-TEST OK: the host-keyed light ground was caught' : 'SELF-TEST FAILED: gate cannot fail'); process.exitCode = caught ? 0 : 1; }
