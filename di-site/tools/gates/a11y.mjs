// Gate: axe-core, zero violations; one h1; skip link first; every section labelled.
import { browser, open, report } from './_lib.mjs';
import { readFileSync } from 'node:fs';
const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const b = await browser();
for (const [w, h, theme] of [[1440, 900, 'light'], [1440, 900, 'dark'], [390, 844, 'light']]) {
  const pg = await open(b, w, h);
  await pg.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await pg.waitForTimeout(900);
  await pg.addScriptTag({ content: axe });
  const res = await pg.evaluate(async () => { const r = await axe.run(document, { rules: { 'color-contrast': { enabled: true } } }); return r.violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target[0]}`); });
  const basics = await pg.evaluate(() => ({ h1: document.querySelectorAll('h1').length, skipFirst: [...document.body.children].find(e => e.tagName !== 'SCRIPT').classList.contains('skip'), unlabelled: [...document.querySelectorAll('section')].filter(s => !s.getAttribute('aria-label') && !s.getAttribute('aria-labelledby')).length }));
  report(`a11y ${w}×${h} ${theme}`, res.length === 0 && basics.h1 === 1 && basics.skipFirst && basics.unlabelled === 0, res.length ? res.join(' | ') : JSON.stringify(basics));
  await pg.close();
}
await b.close();
